<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dream;
use App\Models\Offering;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DreamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $now = now();

        $offerings = Offering::query()
            ->with([
                'items',
                'tomb:id,code,name,is_npc',
                'group:id,code,name',
                'dreams' => fn ($q) => $q->with('tomb:id,code,name')->where('visible_at', '<=', $now),
            ])
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(function (Offering $offering) {
                $data = $offering->toApiArray(true);
                $data['tomb'] = $offering->tomb ? [
                    'id' => $offering->tomb->id,
                    'code' => $offering->tomb->code,
                    'name' => $offering->tomb->name,
                    'is_npc' => (bool) $offering->tomb->is_npc,
                ] : null;
                $data['group'] = $offering->group ? [
                    'code' => $offering->group->code,
                    'name' => $offering->group->name,
                ] : null;
                $data['dreams'] = $offering->dreams->map(fn (Dream $d) => $d->toApiArray())->values()->all();
                $data['dream'] = $offering->dreams->first()?->toApiArray();

                return $data;
            })
            ->values();

        $specialDreams = Dream::query()
            ->with(['tomb:id,code,name', 'joinRequest.fromTomb'])
            ->where('to_user_id', $user->id)
            ->whereIn('kind', ['join_result', 'system'])
            ->where('visible_at', '<=', $now)
            ->orderByDesc('visible_at')
            ->get()
            ->map(fn (Dream $d) => $d->toApiArray())
            ->values();

        return response()->json([
            'offerings' => $offerings,
            'special_dreams' => $specialDreams,
        ]);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $dream = Dream::query()
            ->where('id', $id)
            ->where('to_user_id', $user->id)
            ->where('visible_at', '<=', now())
            ->first();

        if (! $dream) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        if ($dream->read_at === null) {
            $dream->read_at = now();
            $dream->save();
        }

        return response()->json(['dream' => $dream->toApiArray()]);
    }
}
