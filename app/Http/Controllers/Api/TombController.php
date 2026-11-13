<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\KnockRequest;
use App\Http\Requests\Api\StoreTombRequest;
use App\Http\Requests\Api\UpdateEpitaphRequest;
use App\Models\Tomb;
use App\Support\DayNight;
use App\Support\OfferingStats;
use App\Support\ResurrectCode;
use App\Support\TombCode;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TombController extends Controller
{
    public function index(): JsonResponse
    {
        $hotIds = DB::table('offerings')
            ->where('created_at', '>=', now()->subDay())
            ->distinct()
            ->pluck('tomb_id')
            ->all();
        $hotSet = array_fill_keys($hotIds, true);

        $tombs = Tomb::query()
            ->with('user:id,last_seen_at')
            ->orderBy('plot')
            ->get()
            ->map(fn (Tomb $tomb) => $tomb->toListArray(isset($hotSet[$tomb->id])))
            ->values();

        return response()->json(['tombs' => $tombs]);
    }

    public function show(string $code): JsonResponse
    {
        $tomb = Tomb::query()
            ->with('user:id,last_seen_at')
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
        /** @var \App\Models\User $user */
        $user = $request->user();
        $data = $request->validated();

        try {
            $result = DB::transaction(function () use ($user, $data) {
                $existing = Tomb::query()->where('user_id', $user->id)->lockForUpdate()->first();
                $resurrectCode = null;

                if ($existing) {
                    if ((int) $existing->plot !== (int) $data['plot']) {
                        $taken = Tomb::query()
                            ->where('plot', $data['plot'])
                            ->where('id', '!=', $existing->id)
                            ->exists();
                        if ($taken) {
                            throw new HttpResponseException(
                                response()->json(['message' => '这块刚被人占了'], 409)
                            );
                        }
                    }

                    $existing->fill([
                        'name' => $data['name'],
                        'birth_year' => $data['birth_year'],
                        'cause' => $data['cause'],
                        'portrait' => $data['portrait'],
                        'last_words' => $data['last_words'] ?? null,
                        'style' => $data['style'],
                        'plot' => $data['plot'],
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
                    $taken = Tomb::query()->where('plot', $data['plot'])->exists();
                    if ($taken) {
                        throw new HttpResponseException(
                            response()->json(['message' => '这块刚被人占了'], 409)
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
                        'plot' => $data['plot'],
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

                    if (! $user->resurrect_code_hash) {
                        $raw = ResurrectCode::generate();
                        $user->forceFill([
                            'resurrect_code_hash' => ResurrectCode::hash($raw),
                        ])->save();
                        $resurrectCode = ResurrectCode::formatForDisplay($raw);
                    }
                }

                return [$tomb->fresh(), $resurrectCode];
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

    public function updateEpitaph(UpdateEpitaphRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
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
            'tomb' => $tomb->fresh()->toDetailArray(OfferingStats::forTomb($tomb)),
        ]);
    }

    public function zhashi(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
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
        /** @var \App\Models\User $user */
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
