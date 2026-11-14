<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDreamRequest;
use App\Http\Requests\Api\StoreOfferingRequest;
use App\Models\Dream;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Offering;
use App\Models\OfferingItem;
use App\Models\Tomb;
use App\Models\User;
use App\Support\DayNight;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfferingController extends Controller
{
    public function store(StoreOfferingRequest $request, string $code): JsonResponse
    {
        /** @var User $user */
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
                'group_id' => null,
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
                        'kind' => 'reply',
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

            return $offering->load(['items', 'tomb']);
        });

        return response()->json([
            'offering' => $offering->toApiArray(true),
        ]);
    }

    public function inbox(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tomb = $user->tomb;

        if (! $tomb) {
            return response()->json(['items' => []]);
        }

        $items = [];

        $offerings = Offering::query()
            ->with(['items', 'dreams' => fn ($q) => $q->where('tomb_id', $tomb->id), 'group', 'tomb'])
            ->where('tomb_id', $tomb->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        foreach ($offerings as $offering) {
            $data = $offering->toApiArray(true);
            $dream = $offering->dreams->first();
            $data['type'] = 'offering';
            $data['has_dream'] = $dream !== null;
            $data['dream'] = $dream ? $dream->toApiArray() : null;
            $items[] = $data;
        }

        if ($tomb->group_id) {
            $joinedAt = GroupMember::query()
                ->where('group_id', $tomb->group_id)
                ->where('tomb_id', $tomb->id)
                ->whereNull('left_at')
                ->value('joined_at');

            $groupOfferings = Offering::query()
                ->with(['items', 'dreams' => fn ($q) => $q->where('tomb_id', $tomb->id), 'group'])
                ->where('group_id', $tomb->group_id)
                ->whereNull('tomb_id')
                ->when($joinedAt, fn ($q) => $q->where('created_at', '>=', $joinedAt))
                ->orderByDesc('created_at')
                ->get();

            foreach ($groupOfferings as $offering) {
                $data = $offering->toApiArray(true);
                $dream = $offering->dreams->first();
                $data['type'] = 'group_offering';
                $data['has_dream'] = $dream !== null;
                $data['dream'] = $dream ? $dream->toApiArray() : null;
                $items[] = $data;
            }
        }

        $joinRequests = JoinRequest::query()
            ->with(['fromTomb', 'toTomb', 'group'])
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->where(function ($q) use ($tomb) {
                $q->where('to_tomb_id', $tomb->id);
                if ($tomb->group_id) {
                    $founderId = Group::query()->whereKey($tomb->group_id)->value('founder_tomb_id');
                    if ((int) $founderId === (int) $tomb->id) {
                        $q->orWhere(fn ($qq) => $qq->where('type', 'apply')->where('group_id', $tomb->group_id));
                    }
                }
            })
            ->orderByDesc('created_at')
            ->get();

        foreach ($joinRequests as $join) {
            $data = $join->toApiArray();
            $data['type'] = 'join_request';
            $items[] = $data;
        }

        usort($items, function ($a, $b) {
            return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
        });

        return response()->json([
            'items' => array_values($items),
            'offerings' => array_values(array_filter($items, fn ($i) => ($i['type'] ?? '') !== 'join_request')),
        ]);
    }

    public function storeDream(StoreDreamRequest $request, int $id): JsonResponse
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

        $offering = Offering::query()->find($id);
        if (! $offering) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        $allowed = false;
        if ((int) $offering->tomb_id === (int) $tomb->id) {
            $allowed = true;
        } elseif ($offering->group_id && (int) $tomb->group_id === (int) $offering->group_id) {
            $joinedAt = GroupMember::query()
                ->where('group_id', $tomb->group_id)
                ->where('tomb_id', $tomb->id)
                ->whereNull('left_at')
                ->value('joined_at');
            $allowed = $joinedAt && $offering->created_at && $offering->created_at->gte($joinedAt);
        }

        if (! $allowed) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        if (Dream::query()->where('offering_id', $offering->id)->where('tomb_id', $tomb->id)->exists()) {
            return response()->json(['message' => '已经托过梦了'], 409);
        }

        $dream = Dream::query()->create([
            'offering_id' => $offering->id,
            'kind' => 'reply',
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
