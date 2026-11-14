<?php

namespace Tests\Feature;

use App\Models\PlotCell;
use App\Models\Tomb;
use App\Models\User;
use App\Models\Zone;
use App\Models\ZonePhase;
use App\Support\PlotAllocator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SeedsZones;
use Tests\TestCase;

class ZoneAndTombTest extends TestCase
{
    use RefreshDatabase;
    use SeedsZones;

    public function test_zones_list_and_phase_grid(): void
    {
        $this->seedZonesAndNpcs();
        Sanctum::actingAs(User::factory()->create());

        $zones = $this->getJson('/api/zones')->assertOk()->json('zones');
        $this->assertCount(6, $zones);
        $this->assertSame('public', $zones[0]['key']);
        $this->assertSame('group', $zones[5]['key']);
        $this->assertTrue($zones[5]['is_group_zone']);

        $worker = collect($zones)->firstWhere('key', 'worker');
        $phaseId = $worker['phases'][0]['id'];

        $grid = $this->getJson('/api/phases/'.$phaseId.'/grid')->assertOk()->json();
        $this->assertSame('worker', $grid['zone']['key']);
        $coder = collect($grid['cells'])->first(fn ($c) => ($c['tomb']['name'] ?? null) === '某程序员');
        $this->assertNotNull($coder);
        $this->assertSame(11, $coder['cell']);
    }

    public function test_bury_and_cell_conflict(): void
    {
        $this->seedZonesAndNpcs();
        $phase = $this->publicPhase();

        $userA = User::factory()->create(['timezone' => 'Asia/Shanghai']);
        Sanctum::actingAs($userA);

        $payload = $this->tombPayload($phase->id, 1);
        $this->postJson('/api/me/tomb', $payload)->assertOk()->assertJsonPath('tomb.cell', 1);

        $userB = User::factory()->create(['timezone' => 'Asia/Shanghai']);
        Sanctum::actingAs($userB);
        $this->postJson('/api/me/tomb', $this->tombPayload($phase->id, 1))
            ->assertStatus(409)
            ->assertJsonPath('message', '这块刚被人占了');
    }

    public function test_auto_open_second_phase(): void
    {
        $this->seedZonesAndNpcs();
        $zone = Zone::query()->where('key', 'student')->firstOrFail();
        $phase = ZonePhase::query()->where('zone_id', $zone->id)->where('number', 1)->firstOrFail();

        for ($i = 0; $i < 60; $i++) {
            if (PlotCell::query()->where('zone_phase_id', $phase->id)->where('cell', $i)->exists()) {
                continue;
            }
            $tomb = Tomb::factory()->create(['home_zone_id' => $zone->id]);
            PlotCell::query()->create([
                'zone_phase_id' => $phase->id,
                'cell' => $i,
                'tomb_id' => $tomb->id,
            ]);
        }

        $spot = PlotAllocator::findEarliestEmpty($zone);
        $this->assertTrue($spot['opened']);
        $this->assertSame(2, $spot['phase']->number);
        $this->assertSame(0, $spot['cell']);
    }

    public function test_move_tomb_increments_count(): void
    {
        $this->seedZonesAndNpcs();
        $phase = $this->publicPhase();
        $user = User::factory()->create(['timezone' => 'Asia/Shanghai']);
        Sanctum::actingAs($user);

        $this->postJson('/api/me/tomb', $this->tombPayload($phase->id, 2))->assertOk();

        $tomb = $user->fresh()->tomb;
        $tomb->zhashi_until = now()->addMinutes(10);
        $tomb->save();
        $user->unsetRelation('tomb');
        Sanctum::actingAs($user->fresh());

        $worker = $this->zonePhase('worker');
        $res = $this->postJson('/api/me/tomb/move', [
            'zone_phase_id' => $worker->id,
            'cell' => 4,
        ])->assertOk();

        $this->assertSame(1, $res->json('tomb.move_count'));
        $this->assertSame(4, $res->json('tomb.cell'));
        $this->assertSame('worker', $res->json('tomb.zone.key'));
    }

    /**
     * @return array<string, mixed>
     */
    private function tombPayload(int $phaseId, int $cell): array
    {
        return [
            'name' => '测试鬼',
            'birth_year' => 1990,
            'cause' => '过劳',
            'portrait' => 1,
            'last_words' => 'bye',
            'style' => 'qingshi',
            'zone_phase_id' => $phaseId,
            'cell' => $cell,
            'epitaph' => '躺平',
            'eulogy' => '安息吧',
            'verdict' => '此人尚可',
            'couplet' => 1,
        ];
    }
}
