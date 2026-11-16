<?php

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

class Embers
{
    /**
     * 烧完纸以后坟前的火星留多久（分钟）。
     */
    public const MINUTES = 60;

    /**
     * 某一期里最近烧过纸的墓位：单独的坟按它的格子，合葬墓（烧给全墓或烧给其中一人）按墓块的起始格。
     *
     * @return list<array{cell: int, burned_at: string}>
     */
    public static function forPhase(int $zonePhaseId, CarbonInterface $now): array
    {
        $since = $now->copy()->subMinutes(self::MINUTES);

        $tombs = DB::table('offerings')
            ->join('plot_cells', 'plot_cells.tomb_id', '=', 'offerings.tomb_id')
            ->where('plot_cells.zone_phase_id', $zonePhaseId)
            ->where('offerings.created_at', '>=', $since)
            ->groupBy('plot_cells.cell')
            ->select('plot_cells.cell')
            ->selectRaw('MAX(offerings.created_at) as burned_at')
            ->get();

        $groups = DB::table('offerings')
            ->leftJoin('tombs', 'tombs.id', '=', 'offerings.tomb_id')
            ->join('groups', function (JoinClause $join) {
                $join->on('groups.id', '=', 'offerings.group_id')
                    ->orOn('groups.id', '=', 'tombs.group_id');
            })
            ->where('groups.zone_phase_id', $zonePhaseId)
            ->whereNull('groups.disbanded_at')
            ->where('offerings.created_at', '>=', $since)
            ->groupBy('groups.start_cell')
            ->select('groups.start_cell as cell')
            ->selectRaw('MAX(offerings.created_at) as burned_at')
            ->get();

        return $tombs->concat($groups)
            ->map(fn (object $row): array => [
                'cell' => (int) $row->cell,
                'burned_at' => Carbon::parse($row->burned_at)->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
