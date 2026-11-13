<?php

namespace App\Support;

use App\Models\Tomb;
use Illuminate\Support\Facades\DB;

class OfferingStats
{
    /**
     * @return array{item_totals: object|array<string, int>, offering_count: int, last_offering_at: ?string, hot: bool}
     */
    public static function forTomb(Tomb $tomb): array
    {
        $totals = DB::table('offering_items')
            ->join('offerings', 'offerings.id', '=', 'offering_items.offering_id')
            ->where('offerings.tomb_id', $tomb->id)
            ->groupBy('offering_items.item_key')
            ->selectRaw('offering_items.item_key, SUM(offering_items.qty) as total')
            ->pluck('total', 'item_key')
            ->map(fn ($v) => (int) $v)
            ->all();

        $agg = DB::table('offerings')
            ->where('tomb_id', $tomb->id)
            ->selectRaw('COUNT(*) as cnt, MAX(created_at) as last_at')
            ->first();

        $hot = DB::table('offerings')
            ->where('tomb_id', $tomb->id)
            ->where('created_at', '>=', now()->subDay())
            ->exists();

        return [
            'item_totals' => $totals === [] ? new \stdClass : $totals,
            'offering_count' => (int) ($agg->cnt ?? 0),
            'last_offering_at' => $agg->last_at
                ? \Carbon\Carbon::parse($agg->last_at)->toIso8601String()
                : null,
            'hot' => $hot,
        ];
    }
}
