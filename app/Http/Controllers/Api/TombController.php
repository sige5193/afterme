<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\KnockRequest;
use App\Http\Requests\Api\MoveTombRequest;
use App\Http\Requests\Api\StoreTombRequest;
use App\Http\Requests\Api\UpdateEpitaphRequest;
use App\Models\Tomb;
use App\Models\User;
use App\Models\ZonePhase;
use App\Support\DayNight;
use App\Support\OfferingStats;
use App\Support\PlotAllocator;
use App\Support\ResurrectCode;
use App\Support\TombAddress;
use App\Support\TombCode;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TombController extends Controller
{
    public function show(string $code): JsonResponse
    {
        $tomb = Tomb::query()
            ->with([
                'user:id,last_seen_at',
                'plotCell.phase.zone',
                'group.phase.zone',
                'pastGroupMemberships',
            ])
            ->where('code', $code)
            ->first();

        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        $stats = OfferingStats::forTomb($tomb);

        return response()->json([
            'tomb' => $tomb->toDetailArray($stats),
        ]);
    }

    public function store(StoreTombRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validated();

        try {
            $result = DB::transaction(function () use ($user, $data) {
                $existing = Tomb::query()->where('user_id', $user->id)->lockForUpdate()->first();
                $resurrectCode = null;

                if ($existing) {
                    // 重办葬礼：位置不变
                    $existing->fill([
                        'name' => $data['name'],
                        'birth_year' => $data['birth_year'],
                        'cause' => $data['cause'],
                        'portrait' => $data['portrait'],
                        'last_words' => $data['last_words'] ?? null,
                        'style' => $data['style'],
                        'epitaph' => $data['epitaph'],
                        'epitaph_edits' => 0,
                        'eulogy' => $data['eulogy'],
                        'verdict' => $data['verdict'],
                        'couplet' => $data['couplet'],
                        'zhashi_until' => null,
                        'funerals' => $existing->funerals + 1,
                        'died_at' => now(),
                    ]);
                    $existing->save();
                    $tomb = $existing;
                } else {
                    if (! isset($data['zone_phase_id'], $data['cell'])) {
                        throw new HttpResponseException(
                            response()->json(['message' => '请选择墓位'], 422)
                        );
                    }

                    $phase = ZonePhase::query()->with('zone')->find($data['zone_phase_id']);
                    if (! $phase || $phase->zone?->is_group_zone) {
                        throw new HttpResponseException(
                            response()->json(['message' => '合葬区不能直接下葬'], 422)
                        );
                    }

                    $tomb = Tomb::query()->create([
                        'user_id' => $user->id,
                        'is_npc' => false,
                        'npc_key' => null,
                        'code' => TombCode::generate(),
                        'name' => $data['name'],
                        'birth_year' => $data['birth_year'],
                        'cause' => $data['cause'],
                        'portrait' => $data['portrait'],
                        'last_words' => $data['last_words'] ?? null,
                        'style' => $data['style'],
                        'home_zone_id' => $phase->zone_id,
                        'group_id' => null,
                        'move_count' => 0,
                        'epitaph' => $data['epitaph'],
                        'epitaph_edits' => 0,
                        'eulogy' => $data['eulogy'],
                        'verdict' => $data['verdict'],
                        'couplet' => $data['couplet'],
                        'zhashi_count' => 0,
                        'zhashi_until' => null,
                        'knock_count' => 0,
                        'last_knock_at' => null,
                        'funerals' => 1,
                        'died_at' => now(),
                    ]);

                    PlotAllocator::occupy($tomb, $phase, (int) $data['cell']);

                    if (! $user->resurrect_code_hash) {
                        $raw = ResurrectCode::generate();
                        $user->forceFill([
                            'resurrect_code_hash' => ResurrectCode::hash($raw),
                        ])->save();
                        $resurrectCode = ResurrectCode::formatForDisplay($raw);
                    }
                }

                return [$tomb->fresh(['plotCell.phase.zone', 'group', 'pastGroupMemberships']), $resurrectCode];
            });
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                return response()->json(['message' => '这块刚被人占了'], 409);
            }

            throw $e;
        }

        [$tomb, $resurrectCode] = $result;
        $stats = OfferingStats::forTomb($tomb);
        $payload = ['tomb' => $tomb->toDetailArray($stats)];

        if ($resurrectCode) {
            $payload['resurrect_code'] = $resurrectCode;
        }

        return response()->json($payload);
    }

    public function move(MoveTombRequest $request): JsonResponse
    {
        $user = $request->user();
        $tomb = $user->tomb;
        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }
        if ($tomb->group_id) {
            return response()->json(['message' => '请先迁出合葬墓'], 422);
        }
        if (! DayNight::ghostOut($user, $tomb)) {
            return response()->json(['message' => '白天扛不动棺材，夜里再迁'], 422);
        }

        $phase = ZonePhase::query()->with('zone')->find($request->integer('zone_phase_id'));
        if (! $phase || $phase->zone?->is_group_zone) {
            return response()->json(['message' => '合葬区不能单独迁坟'], 422);
        }

        try {
            $cell = PlotAllocator::moveTomb($tomb, $phase, $request->integer('cell'));
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                return response()->json(['message' => '这块刚被人占了'], 409);
            }
            throw $e;
        }

        $tomb = $tomb->fresh(['plotCell.phase.zone', 'pastGroupMemberships']);

        return response()->json([
            'tomb' => $tomb->toDetailArray(OfferingStats::forTomb($tomb)),
            'address' => TombAddress::forCell($cell),
        ]);
    }

    public function updateEpitaph(UpdateEpitaphRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tomb = $user->tomb;

        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        if (! DayNight::ghostOut($user, $tomb)) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        $epitaph = $request->string('epitaph')->toString();

        if ($epitaph !== $tomb->epitaph) {
            $tomb->epitaph = $epitaph;
            $tomb->epitaph_edits = $tomb->epitaph_edits + 1;
            $tomb->save();
        }

        return response()->json([
            'tomb' => $tomb->fresh(['plotCell.phase.zone', 'group', 'pastGroupMemberships'])->toDetailArray(OfferingStats::forTomb($tomb)),
        ]);
    }

    public function zhashi(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tomb = $user->tomb;

        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        if (DayNight::isNight($user->timezone)) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        $tomb->zhashi_count = $tomb->zhashi_count + 1;
        $tomb->zhashi_until = now()->addMinutes(10);
        $tomb->save();

        return response()->json([
            'zhashi_count' => $tomb->zhashi_count,
            'zhashi_until' => $tomb->zhashi_until->toIso8601String(),
        ]);
    }

    public function knock(KnockRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tomb = $user->tomb;

        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        $tomb->knock_count = $tomb->knock_count + (int) $request->input('count');
        $tomb->last_knock_at = now();
        $tomb->save();

        return response()->json([
            'knock_count' => $tomb->knock_count,
            'last_knock_at' => $tomb->last_knock_at->toIso8601String(),
        ]);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) $e->getCode();
        $message = $e->getMessage();

        return $code === '23000' || str_contains($message, 'Duplicate') || str_contains($message, 'UNIQUE');
    }
}
