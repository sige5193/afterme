<?php

namespace Tests\Feature;

use App\Models\Dream;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\JoinBlock;
use App\Models\Tomb;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SeedsZones;
use Tests\TestCase;

class GroupJoinTest extends TestCase
{
    use RefreshDatabase;
    use SeedsZones;

    public function test_invite_accept_creates_double_plot_and_releases_cells(): void
    {
        $this->seedZonesAndNpcs();
        [$userA, $tombA] = $this->buryUser(3);
        [$userB, $tombB] = $this->buryUser(4);

        $this->actGhost($userA, $tombA);
        $joinId = $this->postJson('/api/tombs/'.$tombB->code.'/join-requests', [
            'relation' => 'roommate',
            'group_name' => '302 宿舍',
            'message' => '一起躺',
        ])->assertOk()->json('join_request.id');

        $this->actGhost($userB, $tombB);
        $res = $this->postJson('/api/join-requests/'.$joinId.'/respond', [
            'decision' => 'accept',
            'reply_text' => '来吧，挤一挤',
        ]);
        $this->assertSame(200, $res->status(), json_encode($res->json(), JSON_UNESCAPED_UNICODE));

        $this->assertSame('302 宿舍', $res->json('group.name'));
        $this->assertNull($tombA->fresh()->plotCell);
        $this->assertNull($tombB->fresh()->plotCell);
        $this->assertNotNull($tombA->fresh()->group_id);
        $this->assertSame(2, $tombA->fresh()->group->width);
    }

    public function test_expand_to_four_then_six_and_reject_seventh(): void
    {
        $this->seedZonesAndNpcs();
        $members = [];
        for ($i = 0; $i < 6; $i++) {
            $members[] = $this->buryUser(10 + $i);
        }

        [$userA, $tombA] = $members[0];
        [$userB, $tombB] = $members[1];
        $this->actGhost($userA, $tombA);
        $joinId = $this->postJson('/api/tombs/'.$tombB->code.'/join-requests', [
            'relation' => 'bestie',
            'group_name' => '六人组',
        ])->assertOk()->json('join_request.id');
        $this->actGhost($userB, $tombB);
        $groupCode = $this->postJson('/api/join-requests/'.$joinId.'/respond', [
            'decision' => 'accept',
        ])->assertOk()->json('group.code');

        for ($i = 2; $i < 6; $i++) {
            [$u, $t] = $members[$i];
            $this->actGhost($userA, $tombA->fresh());
            $id = $this->postJson('/api/tombs/'.$t->code.'/join-requests', [
                'message' => '入伙',
            ])->assertOk()->json('join_request.id');
            $this->actGhost($u, $t);
            $this->postJson('/api/join-requests/'.$id.'/respond', ['decision' => 'accept'])->assertOk();
        }

        $group = Group::query()->where('code', $groupCode)->firstOrFail();
        $this->assertSame(6, $group->fresh()->width);
        $this->assertSame(6, GroupMember::query()->where('group_id', $group->id)->whereNull('left_at')->count());

        [$user7, $tomb7] = $this->buryUser(40);
        $this->actGhost($userA, $tombA->fresh());
        $this->postJson('/api/tombs/'.$tomb7->code.'/join-requests', ['message' => '再挤'])
            ->assertStatus(422)
            ->assertJsonPath('message', '满员了');
    }

    public function test_leave_returns_home_and_remove_sends_system_dream(): void
    {
        $this->seedZonesAndNpcs();
        [$userA, $tombA] = $this->buryUser(5);
        [$userB, $tombB] = $this->buryUser(6);
        $groupCode = $this->makePair($userA, $tombA, $userB, $tombB, '测试墓');

        Sanctum::actingAs($userA->fresh());
        $this->postJson('/api/groups/'.$groupCode.'/remove', [
            'tomb_code' => $tombB->code,
        ])->assertOk();

        $this->assertNull($tombB->fresh()->group_id);
        $this->assertNotNull($tombB->fresh()->plotCell);
        $dream = Dream::query()->where('to_user_id', $userB->id)->where('kind', 'system')->first();
        $this->assertNotNull($dream);
        $this->assertStringContainsString('你被请出了 测试墓', $dream->text);
        $this->assertStringNotContainsString('被请出', $tombB->fresh()->pastGroupMemberships->first()->group_name_snapshot);
        $this->assertSame('曾与 测试墓合葬' === '曾与 测试墓合葬', true);
        $this->assertSame('测试墓', $tombB->fresh()->pastGroupMemberships->first()->group_name_snapshot);
    }

    public function test_block_prevents_further_invites(): void
    {
        $this->seedZonesAndNpcs();
        [$userA, $tombA] = $this->buryUser(7);
        [$userB, $tombB] = $this->buryUser(8);

        $this->actGhost($userA, $tombA);
        $joinId = $this->postJson('/api/tombs/'.$tombB->code.'/join-requests', [
            'relation' => 'rival',
            'group_name' => '冤家坟',
        ])->assertOk()->json('join_request.id');

        $this->actGhost($userB, $tombB);
        $this->postJson('/api/join-requests/'.$joinId.'/respond', [
            'decision' => 'decline',
            'block' => true,
            'reply_text' => '下辈子吧',
        ])->assertOk();

        $this->assertTrue(JoinBlock::query()->where('blocker_tomb_id', $tombB->id)->where('blocked_tomb_id', $tombA->id)->exists());

        $this->actGhost($userA, $tombA);
        $this->postJson('/api/tombs/'.$tombB->code.'/join-requests', [
            'relation' => 'rival',
            'group_name' => '冤家坟2',
        ])->assertStatus(422)->assertJsonPath('message', '对方不想再收到你的结伴帖');
    }

    public function test_npc_invite_auto_declines_with_dream(): void
    {
        $this->seedZonesAndNpcs();
        [$userA, $tombA] = $this->buryUser(9);
        $laowang = Tomb::query()->where('npc_key', 'laowang')->firstOrFail();

        $this->actGhost($userA, $tombA);
        $this->postJson('/api/tombs/'.$laowang->code.'/join-requests', [
            'relation' => 'colleague',
            'group_name' => '水管队',
        ])->assertOk()->assertJsonPath('join_request.status', 'declined');

        $dream = Dream::query()->where('to_user_id', $userA->id)->where('kind', 'join_result')->first();
        $this->assertNotNull($dream);
        $this->assertSame('我真的只是来修水管的。', $dream->text);
    }

    /**
     * @return array{0: User, 1: Tomb}
     */
    public function test_burning_for_a_group_leaves_embers_on_its_block(): void
    {
        $this->seedZonesAndNpcs();
        [$a, $ta] = $this->buryUser(2);
        [$b, $tb] = $this->buryUser(3);
        $code = $this->makePair($a, $ta, $b, $tb, '烧纸搭子');
        $group = Group::query()->where('code', $code)->firstOrFail();

        Sanctum::actingAs(User::factory()->create(['timezone' => 'Asia/Shanghai']));
        $this->postJson('/api/groups/'.$code.'/offerings', ['items' => ['juhua' => 1]])->assertOk();

        $this->postJson('/api/pulse', ['mode' => 'living', 'zone_phase_id' => $group->zone_phase_id])
            ->assertOk()
            ->assertJsonPath('embers.0.cell', $group->start_cell);
    }

    private function buryUser(int $cell): array
    {
        $user = User::factory()->create(['timezone' => 'Asia/Shanghai']);
        Sanctum::actingAs($user);
        $phase = $this->publicPhase();
        $res = $this->postJson('/api/me/tomb', [
            'name' => '鬼'.$cell,
            'birth_year' => 1991,
            'cause' => '过劳',
            'portrait' => 1,
            'style' => 'qingshi',
            'zone_phase_id' => $phase->id,
            'cell' => $cell,
            'epitaph' => '躺',
            'eulogy' => '安',
            'verdict' => '此人尚可',
            'couplet' => 1,
        ])->assertOk();

        return [$user, Tomb::query()->where('code', $res->json('tomb.code'))->firstOrFail()];
    }

    private function actGhost(User $user, Tomb $tomb): void
    {
        $tomb->zhashi_until = now()->addMinutes(30);
        $tomb->save();
        $user->unsetRelation('tomb');
        Sanctum::actingAs($user->fresh());
    }

    private function makePair(User $a, Tomb $ta, User $b, Tomb $tb, string $name): string
    {
        $this->actGhost($a, $ta);
        $joinId = $this->postJson('/api/tombs/'.$tb->code.'/join-requests', [
            'relation' => 'roommate',
            'group_name' => $name,
        ])->assertOk()->json('join_request.id');
        $this->actGhost($b, $tb);

        return $this->postJson('/api/join-requests/'.$joinId.'/respond', [
            'decision' => 'accept',
        ])->assertOk()->json('group.code');
    }
}
