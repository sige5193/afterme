<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GroupMember;
use App\Models\PlotCell;
use App\Models\Presence;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class ZoneController extends Controller
{
    public function index(): JsonResponse
    {
        $onlineSince = now()->subSeconds(60);

        $ghostCounts = Presence::query()
            ->where('mode', 'ghost')
            ->where('seen_at', '>=', $onlineSince)
            ->whereNotNull('zone_phase_id')
            ->join('zone_phases', 'zone_phases.id', '=', 'presences.zone_phase_id')
            ->selectRaw('zone_phases.zone_id, COUNT(*) as c')
            ->groupBy('zone_phases.zone_id')
            ->pluck('c', 'zone_id');

        $zones = Zone::query()->with('phases')->orderBy('sort')->get()->map(function (Zone $zone) use ($ghostCounts) {
            $phases = $zone->phases->map(function ($phase) {
                $used = PlotCell::query()->where('zone_phase_id', $phase->id)->count();

                return $phase->toApiArray($used);
            })->values()->all();

            $tombCount = PlotCell::query()
                ->whereIn('zone_phase_id', $zone->phases->pluck('id'))
                ->whereNotNull('tomb_id')
                ->count();

            if ($zone->is_group_zone) {
                $tombCount = GroupMember::query()
                    ->whereNull('left_at')
                    ->whereHas('group', fn ($q) => $q->whereNull('disbanded_at')->whereIn('zone_phase_id', $zone->phases->pluck('id')))
                    ->count();
            }

            return $zone->toApiArray([
                'tomb_count' => $tombCount,
                'ghosts_online' => (int) ($ghostCounts[$zone->id] ?? 0),
                'phases' => $phases,
            ]);
        })->values();

        return response()->json(['zones' => $zones]);
    }
}
