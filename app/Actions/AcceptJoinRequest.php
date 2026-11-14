<?php

namespace App\Actions;

use App\Models\Dream;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\JoinRequest;
use App\Models\Tomb;
use App\Models\Zone;
use App\Models\ZonePhase;
use App\Support\GroupBlockAllocator;
use App\Support\GroupCode;
use App\Support\PhaseOpener;
use App\Support\PlotAllocator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class AcceptJoinRequest
{
    public function handle(JoinRequest $request, Tomb $responder, ?string $replyText, ?string $replyStyle): Group
    {
        return DB::transaction(function () use ($request, $responder, $replyText, $replyStyle) {
            $locked = JoinRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $locked->markExpiredIfNeeded();

            if ($locked->status !== 'pending') {
                throw new HttpResponseException(
                    response()->json(['message' => '这份结伴帖已经失效了'], 409)
                );
            }

            $from = Tomb::query()->whereKey($locked->from_tomb_id)->lockForUpdate()->firstOrFail();

            if ($locked->type === 'invite') {
                $to = Tomb::query()->whereKey($locked->to_tomb_id)->lockForUpdate()->firstOrFail();
                if ((int) $to->id !== (int) $responder->id) {
                    throw new HttpResponseException(response()->json(['message' => '阴间服务器开小差了…'], 403));
                }
                if ($to->group_id) {
                    throw new HttpResponseException(
                        response()->json(['message' => 'TA 已经和别人合葬了，得先迁出来'], 409)
                    );
                }

                if ($from->group_id) {
                    $group = Group::query()->whereKey($from->group_id)->lockForUpdate()->firstOrFail();
                    $this->assertNotFull($group);
                    $this->addMember($group, $to);
                } else {
                    $group = $this->createGroup($from, $to, (string) $locked->group_name, (string) $locked->relation);
                }
            } else {
                $group = Group::query()->whereKey($locked->group_id)->lockForUpdate()->firstOrFail();
                if ((int) $group->founder_tomb_id !== (int) $responder->id) {
                    throw new HttpResponseException(response()->json(['message' => '阴间服务器开小差了…'], 403));
                }
                if ($from->group_id) {
                    throw new HttpResponseException(
                        response()->json(['message' => 'TA 已经和别人合葬了，得先迁出来'], 409)
                    );
                }
                $this->assertNotFull($group);
                $this->addMember($group, $from);
            }

            $text = $replyText ?: collect(config('afterme.join_accept_replies'))->random();
            $style = $replyStyle ?: 'warm';

            $locked->status = 'accepted';
            $locked->reply_text = $text;
            $locked->reply_style = $style;
            $locked->responder_tomb_id = $responder->id;
            $locked->responded_at = now();
            $locked->group_id = $group->id;
            $locked->save();

            if ($from->user_id) {
                Dream::query()->create([
                    'offering_id' => null,
                    'kind' => 'join_result',
                    'join_request_id' => $locked->id,
                    'tomb_id' => $responder->id,
                    'to_user_id' => $from->user_id,
                    'text' => $text,
                    'style' => $style,
                    'visible_at' => now(),
                    'read_at' => null,
                    'created_at' => now(),
                ]);
            }

            return $group->fresh(['activeMembers.tomb', 'phase.zone', 'founder']);
        });
    }

    private function assertNotFull(Group $group): void
    {
        $count = GroupMember::query()->where('group_id', $group->id)->whereNull('left_at')->count();
        if ($count >= (int) config('afterme.group_max_members', 6)) {
            throw new HttpResponseException(response()->json(['message' => '满员了'], 409));
        }
    }

    private function createGroup(Tomb $a, Tomb $b, string $name, string $relation): Group
    {
        $phase = $this->groupPhase();

        $group = Group::query()->create([
            'code' => GroupCode::generate(),
            'name' => $name,
            'relation' => $relation,
            'founder_tomb_id' => $a->id,
            'zone_phase_id' => $phase->id,
            'start_cell' => 0,
            'width' => 2,
            'epitaph' => null,
            'epitaph_edits' => 0,
            'disbanded_at' => null,
        ]);

        PlotAllocator::releaseTomb($a);
        PlotAllocator::releaseTomb($b);

        GroupMember::query()->create([
            'group_id' => $group->id,
            'tomb_id' => $a->id,
            'joined_at' => now(),
        ]);
        GroupMember::query()->create([
            'group_id' => $group->id,
            'tomb_id' => $b->id,
            'joined_at' => now()->addSecond(),
        ]);

        $a->group_id = $group->id;
        $a->save();
        $b->group_id = $group->id;
        $b->save();

        GroupBlockAllocator::allocate($group, 2);

        return $group;
    }

    private function addMember(Group $group, Tomb $tomb): void
    {
        PlotAllocator::releaseTomb($tomb);

        GroupMember::query()->create([
            'group_id' => $group->id,
            'tomb_id' => $tomb->id,
            'joined_at' => now(),
        ]);

        $tomb->group_id = $group->id;
        $tomb->save();

        $count = GroupMember::query()->where('group_id', $group->id)->whereNull('left_at')->count();
        GroupBlockAllocator::expandIfNeeded($group, $count);
    }

    private function groupPhase(): ZonePhase
    {
        $zone = Zone::query()->where('key', 'group')->firstOrFail();
        $phase = ZonePhase::query()->where('zone_id', $zone->id)->orderBy('number')->first();

        return $phase ?: PhaseOpener::openNext($zone)['phase'];
    }
}
