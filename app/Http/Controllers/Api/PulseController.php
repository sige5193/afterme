<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PulseRequest;
use App\Models\Dream;
use App\Models\Offering;
use App\Models\Presence;
use App\Models\Tomb;
use App\Support\DayNight;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class PulseController extends Controller
{
    public function __invoke(PulseRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $user->touchSeen();
        $user->load('tomb');

        $now = now();
        $since = $request->input('since')
            ? Carbon::parse($request->input('since'))
            : Carbon::createFromTimestampUTC(0);

        Presence::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'mode' => $request->string('mode')->toString(),
                'plot' => $request->input('plot'),
                'viewing_tomb_id' => $request->input('viewing_tomb_id'),
                'seen_at' => $now,
            ]
        );

        $tomb = $user->tomb;
        $onlineSince = $now->copy()->subSeconds(60);

        $newOfferings = [];
        $pendingDreamsCount = 0;

        if ($tomb) {
            $newOfferings = Offering::query()
                ->with('items')
                ->where('tomb_id', $tomb->id)
                ->where('user_id', '!=', $user->id)
                ->where('created_at', '>', $since)
                ->where('created_at', '<=', $now)
                ->orderBy('created_at')
                ->get()
                ->map(fn (Offering $o) => $o->toApiArray(true))
                ->values()
                ->all();

            $pendingDreamsCount = Offering::query()
                ->where('tomb_id', $tomb->id)
                ->whereDoesntHave('dream')
                ->count();
        }

        $newDreams = Dream::query()
            ->where('to_user_id', $user->id)
            ->where('visible_at', '>', $since)
            ->where('visible_at', '<=', $now)
            ->orderBy('visible_at')
            ->get()
            ->map(fn (Dream $d) => $d->toApiArray())
            ->values()
            ->all();

        $unreadDreamsCount = Dream::query()
            ->where('to_user_id', $user->id)
            ->where('visible_at', '<=', $now)
            ->whereNull('read_at')
            ->count();

        $viewingTomb = null;
        $viewingId = $request->input('viewing_tomb_id');
        if ($viewingId) {
            $vt = Tomb::query()->find($viewingId);
            if ($vt) {
                $viewingTomb = [
                    'id' => $vt->id,
                    'last_knock_at' => optional($vt->last_knock_at)?->toIso8601String(),
                    'knock_count' => $vt->knock_count,
                ];
            }
        }

        $ghosts = Presence::query()
            ->where('mode', 'ghost')
            ->where('seen_at', '>=', $onlineSince)
            ->where('user_id', '!=', $user->id)
            ->with(['user.tomb:id,user_id,name'])
            ->get()
            ->filter(fn (Presence $p) => $p->user?->tomb !== null)
            ->map(fn (Presence $p) => [
                'tomb_id' => $p->user->tomb->id,
                'name' => $p->user->tomb->name,
                'plot' => $p->plot,
            ])
            ->values()
            ->all();

        $livingCount = Presence::query()
            ->where('mode', 'living')
            ->where('seen_at', '>=', $onlineSince)
            ->where('user_id', '!=', $user->id)
            ->count();

        $tombsVersion = Tomb::query()->max('updated_at');

        return response()->json([
            'now' => $now->toIso8601String(),
            'is_night' => DayNight::isNight($user->timezone, $now),
            'ghost_out' => DayNight::ghostOut($user, $tomb, $now),
            'tombs_version' => $tombsVersion
                ? Carbon::parse($tombsVersion)->toIso8601String()
                : null,
            'new_offerings' => $newOfferings,
            'new_dreams' => $newDreams,
            'pending_dreams_count' => $pendingDreamsCount,
            'unread_dreams_count' => $unreadDreamsCount,
            'viewing_tomb' => $viewingTomb,
            'ghosts' => $ghosts,
            'living_count' => $livingCount,
        ]);
    }
}
