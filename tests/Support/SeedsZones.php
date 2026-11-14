<?php

namespace Tests\Support;

use App\Models\Zone;
use App\Models\ZonePhase;
use Database\Seeders\NpcSeeder;

trait SeedsZones
{
    protected function seedZonesAndNpcs(): void
    {
        $this->seed(NpcSeeder::class);
    }

    protected function publicPhase(): ZonePhase
    {
        $zone = Zone::query()->where('key', 'public')->firstOrFail();

        return ZonePhase::query()->where('zone_id', $zone->id)->where('number', 1)->firstOrFail();
    }

    protected function zonePhase(string $key, int $number = 1): ZonePhase
    {
        $zone = Zone::query()->where('key', $key)->firstOrFail();

        return ZonePhase::query()->where('zone_id', $zone->id)->where('number', $number)->firstOrFail();
    }
}
