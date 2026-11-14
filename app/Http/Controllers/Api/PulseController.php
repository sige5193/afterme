<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PulseRequest;
use App\Models\Dream;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Offering;
use App\Models\PlotCell;
use App\Models\Presence;
use App\Models\Tomb;
use App\Models\User;
use App\Models\Zone;
use App\Models\ZonePhase;
use App\Support\DayNight;
use App\Support\TombAddress;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class PulseController extends Controller
{
    public function __invoke(PulseRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->touchSeen();
        $user->load('tomb');

        $now = now();
        $since = $request->input('since')
            ? Carbon::parse($request->input('since'))
            : Carbon::createFromTimestampUTC(0);

        $zonePhaseId = $request->input('zone_phase_id');

        Presence::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'mode' => $request->string('mode')->toString(),
                'zone_phase_id' => $zonePhaseId,
                'cell' => $request->input('cell'),
                'viewing_tomb_id' => $request->input('viewing_tomb_id'),
                'seen_at' => $now,
            ]
        );

        $tomb = $user->tomb;
        $onlineSince = $now->copy()->subSeconds(60);

        $newOfferings = [];
        $pendingOfferings = 0;
        $pendingJoins = 0;

        if ($tomb) {
            $personal = Offering::query()
                ->with(['items', 'group', 'tomb'])
                ->where('tomb_id', $tomb->id)
                ->where('user_id', '!=', $user->id)
                ->where('created_at', '>', $since)
                ->where('created_at', '<=', $now)
                ->get();

            $groupOfferings = collect();
            if ($tomb->group_id) {
                $joinedAt = GroupMember::query()
                    ->where('group_id', $tomb->group_id)
                    ->where('tomb_id', $tomb->id)
                    ->whereNull('left_at')
                    ->value('joined_at');

                $groupOfferings = Offering::query()
                    ->with(['items', 'group', 'tomb'])
                    ->where('group_id', $tomb->group_id)
                    ->whereNull('tomb_id')
                    ->where('user_id', '!=', $user->id)
                    ->when($joinedAt, fn ($q) => $q->where('created_at', '>=', $joinedAt))
                    ->where('created_at', '>', $since)
                    ->where('created_at', '<=', $now)
                    ->get();
            }

            $newOfferings = $personal->concat($groupOfferings)
                ->sortBy('created_at')
                ->map(fn (Offering $o) => $o->toApiArray(true))
                ->values()
                ->all();

            $pendingOfferings = Offering::query()
                ->where('tomb_id', $tomb->id)
                ->whereDoesntHave('dreams', fn ($q) => $q->where('tomb_id', $tomb->id))
                ->count();

            if ($tomb->group_id) {
                $joinedAt = GroupMember::query()
                    ->where('group_id', $tomb->group_id)
                    ->where('tomb_id', $tomb->id)
                    ->whereNull('left_at')
                    ->value('joined_at');

                $pendingOfferings += Offering::query()
                    ->where('group_id', $tomb->group_id)
                    ->whereNull('tomb_id')
                    ->when($joinedAt, fn ($q) => $q->where('created_at', '>=', $joinedAt))
                    ->whereDoesntHave('dreams', fn ($q) => $q->where('tomb_id', $tomb->id))
                    ->count();
            }

            $pendingJoins = JoinRequest::query()
                ->where('status', 'pending')
                ->where('expires_at', '>', $now)
                ->where(function ($q) use ($tomb) {
                    $q->where('to_tomb_id', $tomb->id);
                    if ($tomb->group_id) {
                        $founderId = Group::query()->whereKey($tomb->group_id)->value('founder_tomb_id');
                        if ((int) $founderId === (int) $tomb->id) {
                            $q->orWhere(fn ($qq) => $qq->where('type', 'apply')->where('group_id', $tomb->group_id));
                        }
                    }
                })
                ->count();
        }

        $newDreams = Dream::query()
            ->with('tomb:id,code,name')
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

        $newJoinRequests = [];
        if ($tomb) {
            $newJoinRequests = JoinRequest::query()
                ->with(['fromTomb', 'toTomb', 'group'])
                ->where('status', 'pending')
                ->where('expires_at', '>', $now)
                ->where('created_at', '>', $since)
                ->where(function ($q) use ($tomb) {
                    $q->where('to_tomb_id', $tomb->id);
                    if ($tomb->group_id) {
                        $founderId = Group::query()->whereKey($tomb->group_id)->value('founder_tomb_id');
                        if ((int) $founderId === (int) $tomb->id) {
                            $q->orWhere(fn ($qq) => $qq->where('type', 'apply')->where('group_id', $tomb->group_id));
                        }
                    }
                })
                ->orderBy('created_at')
                ->get()
                ->map(fn (JoinRequest $r) => $r->toApiArray())
                ->values()
                ->all();
        }

        $newPhases = ZonePhase::query()
            ->with('zone')
            ->where('created_at', '>', $since)
            ->where('created_at', '<=', $now)
            ->where('number', '>', 1)
            ->orderBy('created_at')
            ->get()
            ->map(fn (ZonePhase $p) => [
                'zone_name' => $p->zone?->name,
                'zone_key' => $p->zone?->key,
                'number' => $p->number,
                'label' => TombAddress::zoneDisplayName($p->zone, $p->number),
            ])
            ->values()
            ->all();

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

        $ghostQuery = Presence::query()
            ->where('mode', 'ghost')
            ->where('seen_at', '>=', $onlineSince)
            ->where('user_id', '!=', $user->id)
            ->with(['user.tomb:id,user_id,name,code']);

        if ($zonePhaseId) {
            $ghostQuery->where('zone_phase_id', $zonePhaseId);
        } else {
            $ghostQuery->whereRaw('1 = 0');
        }

        $ghosts = $ghostQuery->get()
            ->filter(fn (Presence $p) => $p->user?->tomb !== null)
            ->map(fn (Presence $p) => [
                'tomb_code' => $p->user->tomb->code,
                'name' => $p->user->tomb->name,
                'cell' => $p->cell,
            ])
            ->values()
            ->all();

        $livingCount = Presence::query()
            ->where('mode', 'living')
            ->where('seen_at', '>=', $onlineSince)
            ->where('user_id', '!=', $user->id)
            ->count();

        $phaseVersion = null;
        if ($zonePhaseId) {
            $phase = ZonePhase::query()->find($zonePhaseId);
            if ($phase) {
                $cellMax = PlotCell::query()->where('zone_phase_id', $phase->id)->max('updated_at');
                $groupMax = Group::query()->where('zone_phase_id', $phase->id)->max('updated_at');
                $tombIds = PlotCell::query()->where('zone_phase_id', $phase->id)->whereNotNull('tomb_id')->pluck('tomb_id');
                $tombMax = $tombIds->isEmpty() ? null : Tomb::query()->whereIn('id', $tombIds)->max('updated_at');
                $times = array_filter([$cellMax, $groupMax, $tombMax]);
                $phaseVersion = $times ? Carbon::parse(max($times))->toIso8601String() : optional($phase->created_at)?->toIso8601String();
            }
        }

        $zoneGhosts = [];
        $counts = Presence::query()
            ->where('mode', 'ghost')
            ->where('seen_at', '>=', $onlineSince)
            ->whereNotNull('zone_phase_id')
            ->join('zone_phases', 'zone_phases.id', '=', 'presences.zone_phase_id')
            ->join('zones', 'zones.id', '=', 'zone_phases.zone_id')
            ->selectRaw('zones.key as zone_key, COUNT(*) as c')
            ->groupBy('zones.key')
            ->pluck('c', 'zone_key');
        foreach (Zone::query()->pluck('key') as $key) {
            $zoneGhosts[$key] = (int) ($counts[$key] ?? 0);
        }

        return response()->json([
            'now' => $now->toIso8601String(),
            'is_night' => DayNight::isNight($user->timezone, $now),
            'ghost_out' => DayNight::ghostOut($user, $tomb, $now),
            'phase_version' => $phaseVersion,
            'new_offerings' => $newOfferings,
            'new_dreams' => $newDreams,
            'new_join_requests' => $newJoinRequests,
            'new_phases' => $newPhases,
            'pending_dreams_count' => $pendingOfferings + $pendingJoins,
            'unread_dreams_count' => $unreadDreamsCount,
            'viewing_tomb' => $viewingTomb,
            'ghosts' => $ghosts,
            'zone_ghosts' => $zoneGhosts,
            'living_count' => $livingCount,
        ]);
    }
}
