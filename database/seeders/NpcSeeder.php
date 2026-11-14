<?php

namespace Database\Seeders;

use App\Models\PlotCell;
use App\Models\Tomb;
use App\Models\Zone;
use App\Models\ZonePhase;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class NpcSeeder extends Seeder
{
    public function run(): void
    {
        $this->ensureZonesAndPhases();

        $npcs = require base_path('_scaffold/php/npcSeederData.php');

        foreach ($npcs as $npc) {
            $zone = Zone::query()->where('key', $npc['zone_key'])->firstOrFail();
            $phase = ZonePhase::query()
                ->where('zone_id', $zone->id)
                ->where('number', 1)
                ->firstOrFail();

            $tomb = Tomb::query()->updateOrCreate(
                ['npc_key' => $npc['npc_key']],
                [
                    'user_id' => null,
                    'is_npc' => true,
                    'code' => $npc['code'],
                    'name' => $npc['name'],
                    'birth_year' => $npc['birth_year'],
                    'cause' => $npc['cause'],
                    'epitaph' => $npc['epitaph'],
                    'style' => $npc['style'],
                    'portrait' => $npc['portrait'],
                    'died_at' => Carbon::parse($npc['died_at'])->utc(),
                    'last_words' => $npc['last_words'] !== '' ? $npc['last_words'] : null,
                    'home_zone_id' => $zone->id,
                    'group_id' => null,
                    'move_count' => 0,
                    'epitaph_edits' => 0,
                    'eulogy' => '',
                    'verdict' => '此人尚可',
                    'couplet' => 0,
                    'zhashi_count' => 0,
                    'zhashi_until' => null,
                    'knock_count' => 0,
                    'last_knock_at' => null,
                    'funerals' => 1,
                ]
            );

            PlotCell::query()
                ->where('tomb_id', $tomb->id)
                ->where(function ($query) use ($phase, $npc) {
                    $query->where('zone_phase_id', '!=', $phase->id)
                        ->orWhere('cell', '!=', $npc['cell']);
                })
                ->delete();

            PlotCell::query()->updateOrCreate(
                [
                    'zone_phase_id' => $phase->id,
                    'cell' => $npc['cell'],
                ],
                [
                    'tomb_id' => $tomb->id,
                    'group_id' => null,
                ]
            );
        }
    }

    private function ensureZonesAndPhases(): void
    {
        $capacity = (int) config('afterme.phase_capacity', 60);

        foreach (config('afterme.zones', []) as $zoneConfig) {
            $zone = Zone::query()->updateOrCreate(
                ['key' => $zoneConfig['key']],
                [
                    'name' => $zoneConfig['name'],
                    'tagline' => $zoneConfig['tagline'],
                    'default_style' => $zoneConfig['default_style'],
                    'is_group_zone' => $zoneConfig['is_group_zone'],
                    'sort' => $zoneConfig['sort'],
                ]
            );

            ZonePhase::query()->firstOrCreate(
                [
                    'zone_id' => $zone->id,
                    'number' => 1,
                ],
                [
                    'capacity' => $capacity,
                    'created_at' => now(),
                ]
            );
        }
    }
}
