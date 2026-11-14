<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\DayNight;
use App\Support\OfferingStats;
use App\Support\ResurrectCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $timezone = $request->query('timezone');
        $user->touchSeen(is_string($timezone) ? $timezone : null);
        $user->refresh();
        $user->load(['tomb.plotCell.phase.zone', 'tomb.group.phase.zone', 'tomb.pastGroupMemberships']);

        $tomb = $user->tomb;
        $tombPayload = null;
        $groupPayload = null;

        if ($tomb) {
            $stats = OfferingStats::forTomb($tomb);
            $tombPayload = $tomb->toDetailArray($stats);
            if ($tomb->group) {
                $groupPayload = $tomb->group->toSummaryArray();
            }
        }

        return response()->json([
            'user' => $user->toApiArray(),
            'tomb' => $tombPayload,
            'group' => $groupPayload,
            'is_night' => DayNight::isNight($user->timezone),
            'ghost_out' => DayNight::ghostOut($user, $tomb),
        ]);
    }

    public function regenerateResurrectCode(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        $raw = ResurrectCode::generate();
        $user->forceFill([
            'resurrect_code_hash' => ResurrectCode::hash($raw),
        ])->save();

        return response()->json([
            'resurrect_code' => ResurrectCode::formatForDisplay($raw),
        ]);
    }
}
