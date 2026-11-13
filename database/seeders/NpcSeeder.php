<?php

namespace Database\Seeders;

use App\Models\Tomb;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class NpcSeeder extends Seeder
{
    public function run(): void
    {
        $npcs = require base_path('_scaffold/php/npcSeederData.php');

        foreach ($npcs as $npc) {
            Tomb::query()->updateOrCreate(
                ['npc_key' => $npc['npc_key']],
                [
                    'user_id' => null,
                    'is_npc' => true,
                    'code' => $npc['code'],
                    'plot' => $npc['plot'],
                    'name' => $npc['name'],
                    'birth_year' => $npc['birth_year'],
                    'cause' => $npc['cause'],
                    'epitaph' => $npc['epitaph'],
                    'style' => $npc['style'],
                    'portrait' => $npc['portrait'],
                    'died_at' => Carbon::parse($npc['died_at'])->utc(),
                    'last_words' => $npc['last_words'] !== '' ? $npc['last_words'] : null,
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
        }
    }
}
