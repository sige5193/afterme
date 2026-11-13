<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDreamRequest;
use App\Http\Requests\Api\StoreOfferingRequest;
use App\Models\Dream;
use App\Models\Offering;
use App\Models\OfferingItem;
use App\Models\Tomb;
use App\Support\DayNight;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfferingController extends Controller
{
    public function store(StoreOfferingRequest $request, string $code): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $tomb = Tomb::query()->where('code', $code)->first();
        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        $fromName = trim((string) $request->input('from_name', ''));
        if ($fromName === '') {
            $fromName = '一位路过的活人';
        }

        $items = $request->input('items', []);
        $message = $request->input('message');

        $offering = DB::transaction(function () use ($user, $tomb, $fromName, $items, $message) {
            $offering = Offering::query()->create([
                'tomb_id' => $tomb->id,
                'user_id' => $user->id,
                'from_name' => $fromName,
                'message' => $message,
                'created_at' => now(),
            ]);

            foreach ($items as $key => $qty) {
                OfferingItem::query()->create([
                    'offering_id' => $offering->id,
                    'item_key' => $key,
                    'qty' => (int) $qty,
                ]);
            }

            if ($tomb->is_npc && $tomb->npc_key) {
                $dreams = config('afterme.npc_dreams.'.$tomb->npc_key, []);
                $styles = config('afterme.npc_dream_styles', ['plain', 'warm', 'mystic']);

                if ($dreams !== []) {
                    Dream::query()->create([
                        'offering_id' => $offering->id,
                        'tomb_id' => $tomb->id,
                        'to_user_id' => $user->id,
                        'text' => $dreams[array_rand($dreams)],
                        'style' => $styles[array_rand($styles)],
                        'visible_at' => now()->addSeconds(random_int(6, 11)),
                        'read_at' => null,
                        'created_at' => now(),
                    ]);
                }
            }

            return $offering->load('items');
        });

        return response()->json([
            'offering' => $offering->toApiArray(true),
        ]);
    }

    public function inbox(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $tomb = $user->tomb;

        if (! $tomb) {
            return response()->json(['offerings' => []]);
        }

        $offerings = Offering::query()
            ->with(['items', 'dream'])
            ->where('tomb_id', $tomb->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(function (Offering $offering) {
                $data = $offering->toApiArray(true);
                $dream = $offering->dream;
                $data['has_dream'] = $dream !== null;
                $data['dream'] = $dream ? $dream->toApiArray() : null;

                return $data;
            })
            ->values();

        return response()->json(['offerings' => $offerings]);
    }

    public function storeDream(StoreDreamRequest $request, int $id): JsonResponse
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

        $offering = Offering::query()->where('id', $id)->where('tomb_id', $tomb->id)->first();
        if (! $offering) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        if (Dream::query()->where('offering_id', $offering->id)->exists()) {
            return response()->json(['message' => '已经托过梦了'], 409);
        }

        $dream = Dream::query()->create([
            'offering_id' => $offering->id,
            'tomb_id' => $tomb->id,
            'to_user_id' => $offering->user_id,
            'text' => $request->string('text')->toString(),
            'style' => $request->string('style')->toString(),
            'visible_at' => now(),
            'read_at' => null,
            'created_at' => now(),
        ]);

        return response()->json(['dream' => $dream->toApiArray()]);
    }
}
