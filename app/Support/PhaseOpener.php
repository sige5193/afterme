<?php

namespace App\Support;

use App\Models\Zone;
use App\Models\ZonePhase;
use Illuminate\Support\Facades\DB;

class PhaseOpener
{
    /**
     * @return array{phase: ZonePhase, opened: bool}
     */
    public static function openNext(Zone $zone): array
    {
        return DB::transaction(function () use ($zone) {
            $lockedZone = Zone::query()->whereKey($zone->id)->lockForUpdate()->firstOrFail();

            $latest = ZonePhase::query()
                ->where('zone_id', $lockedZone->id)
                ->orderByDesc('number')
                ->lockForUpdate()
                ->first();

            $number = $latest ? $latest->number + 1 : 1;

            $phase = ZonePhase::query()->create([
                'zone_id' => $lockedZone->id,
                'number' => $number,
                'capacity' => (int) config('afterme.phase_capacity', 60),
                'created_at' => now(),
            ]);

            return [
                'phase' => $phase,
                'opened' => true,
            ];
        });
    }

    public static function ensureFirst(Zone $zone): ZonePhase
    {
        $phase = ZonePhase::query()
            ->where('zone_id', $zone->id)
            ->where('number', 1)
            ->first();

        if ($phase) {
            return $phase;
        }

        return self::openNext($zone)['phase'];
    }
}
