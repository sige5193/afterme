<?php

namespace Tests\Feature;

use App\Models\Tomb;
use App\Models\User;
use App\Models\ZonePhase;
use App\Support\Embers;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SeedsZones;
use Tests\TestCase;

class EmbersTest extends TestCase
{
    use RefreshDatabase;
    use SeedsZones;

    public function test_pulse_lists_recently_burned_plots_in_the_viewed_phase(): void
    {
        $this->seedZonesAndNpcs();
        $phase = $this->publicPhase();
        $tomb = $this->bury($phase, 3);

        Sanctum::actingAs(User::factory()->create(['timezone' => 'Asia/Shanghai']));
        $this->postJson('/api/tombs/'.$tomb->code.'/offerings', ['items' => ['mingbi' => 2]])->assertOk();

        $embers = $this->postJson('/api/pulse', ['mode' => 'living', 'zone_phase_id' => $phase->id])
            ->assertOk()
            ->json('embers');
        $this->assertSame([3], array_column($embers, 'cell'));
        $this->assertNotEmpty($embers[0]['burned_at']);

        $this->postJson('/api/pulse', ['mode' => 'living', 'zone_phase_id' => $this->zonePhase('worker')->id])
            ->assertOk()
            ->assertJsonPath('embers', []);
    }

    public function test_embers_die_out_after_an_hour(): void
    {
        $this->seedZonesAndNpcs();
        $phase = $this->publicPhase();
        $tomb = $this->bury($phase, 5);

        Sanctum::actingAs(User::factory()->create(['timezone' => 'Asia/Shanghai']));
        $this->postJson('/api/tombs/'.$tomb->code.'/offerings', ['items' => ['juhua' => 1]])->assertOk();

        $this->travel(Embers::MINUTES + 1)->minutes();

        $this->postJson('/api/pulse', ['mode' => 'living', 'zone_phase_id' => $phase->id])
            ->assertOk()
            ->assertJsonPath('embers', []);
    }

    private function bury(ZonePhase $phase, int $cell): Tomb
    {
        Sanctum::actingAs(User::factory()->create(['timezone' => 'Asia/Shanghai']));
        $code = $this->postJson('/api/me/tomb', [
            'name' => '烧纸'.$cell,
            'birth_year' => 1990,
            'cause' => '笑死',
            'portrait' => 1,
            'style' => 'qingshi',
            'zone_phase_id' => $phase->id,
            'cell' => $cell,
            'epitaph' => '躺',
            'eulogy' => '安',
            'verdict' => '此人尚可',
            'couplet' => 1,
        ])->assertOk()->json('tomb.code');

        return Tomb::query()->where('code', $code)->firstOrFail();
    }
}
