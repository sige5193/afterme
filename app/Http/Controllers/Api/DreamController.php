<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dream;
use App\Models\Offering;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DreamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $now = now();

        $offerings = Offering::query()
            ->with([
                'items',
                'tomb:id,code,name,is_npc',
                'dream' => fn ($q) => $q->where('visible_at', '<=', $now),
            ])
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(function (Offering $offering) use ($user) {
                $includeMessage = true;
                $data = $offering->toApiArray($includeMessage);
                $data['tomb'] = $offering->tomb ? [
                    'id' => $offering->tomb->id,
                    'code' => $offering->tomb->code,
                    'name' => $offering->tomb->name,
                    'is_npc' => (bool) $offering->tomb->is_npc,
                ] : null;
                $data['dream'] = $offering->dream ? $offering->dream->toApiArray() : null;

                return $data;
            })
            ->values();

        return response()->json(['offerings' => $offerings]);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
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
