<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $capacity = (int) config('afterme.phase_capacity', 60);
        $zonesConfig = config('afterme.zones', []);

        $zoneIds = [];
        $phaseIds = [];

        foreach ($zonesConfig as $zoneConfig) {
            $existingZone = DB::table('zones')->where('key', $zoneConfig['key'])->first();
            if ($existingZone) {
                $zoneId = $existingZone->id;
                DB::table('zones')->where('id', $zoneId)->update([
                    'name' => $zoneConfig['name'],
                    'tagline' => $zoneConfig['tagline'],
                    'default_style' => $zoneConfig['default_style'],
                    'is_group_zone' => $zoneConfig['is_group_zone'] ? 1 : 0,
                    'sort' => $zoneConfig['sort'],
                ]);
            } else {
                $zoneId = DB::table('zones')->insertGetId([
                    'key' => $zoneConfig['key'],
                    'name' => $zoneConfig['name'],
                    'tagline' => $zoneConfig['tagline'],
                    'default_style' => $zoneConfig['default_style'],
                    'is_group_zone' => $zoneConfig['is_group_zone'] ? 1 : 0,
                    'sort' => $zoneConfig['sort'],
                ]);
            }
            $zoneIds[$zoneConfig['key']] = $zoneId;

            $existingPhase = DB::table('zone_phases')
                ->where('zone_id', $zoneId)
                ->where('number', 1)
                ->first();
            if ($existingPhase) {
                $phaseId = $existingPhase->id;
            } else {
                $phaseId = DB::table('zone_phases')->insertGetId([
                    'zone_id' => $zoneId,
                    'number' => 1,
                    'capacity' => $capacity,
                    'created_at' => $now,
                ]);
            }
            $phaseIds[$zoneConfig['key']] = $phaseId;
        }

        $publicZoneId = $zoneIds['public'];
        $publicPhaseId = $phaseIds['public'];
        $occupied = [];

        $npcs = require base_path('_scaffold/php/npcSeederData.php');
        $npcByKey = [];
        foreach ($npcs as $npc) {
            $npcByKey[$npc['npc_key']] = $npc;
        }

        // Place / update NPCs into their new zone cells.
        foreach ($npcs as $npc) {
            $existing = DB::table('tombs')->where('npc_key', $npc['npc_key'])->first();
            $zoneId = $zoneIds[$npc['zone_key']];
            $phaseId = $phaseIds[$npc['zone_key']];
            $cell = (int) $npc['cell'];

            $diedAt = Carbon::parse($npc['died_at'])->utc()->format('Y-m-d H:i:s');

            $payload = [
                'user_id' => null,
                'is_npc' => 1,
                'npc_key' => $npc['npc_key'],
                'code' => $npc['code'],
                'name' => $npc['name'],
                'birth_year' => $npc['birth_year'],
                'cause' => $npc['cause'],
                'portrait' => $npc['portrait'],
                'last_words' => $npc['last_words'] !== '' ? $npc['last_words'] : null,
                'style' => $npc['style'],
                'epitaph' => $npc['epitaph'],
                'epitaph_edits' => 0,
                'eulogy' => '',
                'verdict' => '此人尚可',
                'couplet' => 0,
                'home_zone_id' => $zoneId,
                'group_id' => null,
                'move_count' => 0,
                'funerals' => 1,
                'died_at' => $diedAt,
                'updated_at' => $now,
            ];

            if ($existing) {
                DB::table('tombs')->where('id', $existing->id)->update($payload);
                $tombId = $existing->id;
            } else {
                $payload['created_at'] = $now;
                // Keep temporary plot unique during migration window.
                $payload['plot'] = 100000 + (int) $cell + (array_search($npc['zone_key'], array_keys($zoneIds), true) * 1000);
                $tombId = DB::table('tombs')->insertGetId($payload);
            }

            DB::table('plot_cells')->updateOrInsert(
                [
                    'zone_phase_id' => $phaseId,
                    'cell' => $cell,
                ],
                [
                    'tomb_id' => $tombId,
                    'group_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );

            $occupied[$phaseId][$cell] = true;
        }

        // Migrate non-NPC tombs into public zone.
        $hasPlotColumn = Schema::hasColumn('tombs', 'plot');

        if ($hasPlotColumn) {
            $userTombs = DB::table('tombs')
                ->where('is_npc', 0)
                ->orderBy('plot')
                ->orderBy('id')
                ->get();

            $currentPhaseId = $publicPhaseId;
            $currentPhaseNumber = (int) (DB::table('zone_phases')
                ->where('zone_id', $publicZoneId)
                ->max('number') ?: 1);

            foreach ($userTombs as $tomb) {
                if (DB::table('plot_cells')->where('tomb_id', $tomb->id)->exists()) {
                    DB::table('tombs')->where('id', $tomb->id)->update([
                        'home_zone_id' => $publicZoneId,
                        'updated_at' => $now,
                    ]);

                    continue;
                }

                $preferred = (int) $tomb->plot;
                $cell = null;

                if ($preferred < $capacity && empty($occupied[$currentPhaseId][$preferred])) {
                    $cell = $preferred;
                } else {
                    for ($i = 0; $i < $capacity; $i++) {
                        if (empty($occupied[$currentPhaseId][$i])) {
                            $cell = $i;
                            break;
                        }
                    }
                }

                if ($cell === null) {
                    $currentPhaseNumber++;
                    $currentPhaseId = DB::table('zone_phases')->insertGetId([
                        'zone_id' => $publicZoneId,
                        'number' => $currentPhaseNumber,
                        'capacity' => $capacity,
                        'created_at' => $now,
                    ]);
                    $cell = ($preferred < $capacity) ? $preferred : 0;
                }

                DB::table('plot_cells')->insert([
                    'zone_phase_id' => $currentPhaseId,
                    'cell' => $cell,
                    'tomb_id' => $tomb->id,
                    'group_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('tombs')->where('id', $tomb->id)->update([
                    'home_zone_id' => $publicZoneId,
                    'updated_at' => $now,
                ]);

                $occupied[$currentPhaseId][$cell] = true;
            }

            Schema::table('tombs', function (Blueprint $table) {
                $table->dropUnique(['plot']);
                $table->dropColumn('plot');
            });
        }
    }

    public function down(): void
    {
        Schema::table('tombs', function (Blueprint $table) {
            $table->unsignedInteger('plot')->nullable()->after('style');
        });

        $cols = (int) config('afterme.grid_cols', 6);
        $tombs = DB::table('tombs')
            ->leftJoin('plot_cells', 'plot_cells.tomb_id', '=', 'tombs.id')
            ->leftJoin('zone_phases', 'zone_phases.id', '=', 'plot_cells.zone_phase_id')
            ->select('tombs.id', 'plot_cells.cell', 'zone_phases.number')
            ->orderBy('tombs.id')
            ->get();

        $next = 0;
        foreach ($tombs as $tomb) {
            $plot = $tomb->cell !== null
                ? ((int) $tomb->number - 1) * 60 + (int) $tomb->cell
                : $next;
            DB::table('tombs')->where('id', $tomb->id)->update(['plot' => $plot]);
            $next = max($next, $plot + 1);
        }

        Schema::table('tombs', function (Blueprint $table) {
            $table->unsignedInteger('plot')->nullable(false)->unique()->change();
        });

        DB::table('plot_cells')->delete();
        DB::table('zone_phases')->delete();
        DB::table('zones')->delete();
    }
};
