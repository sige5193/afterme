<?php

namespace App\Actions;

use App\Models\Dream;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Tomb;
use App\Support\GroupBlockAllocator;
use App\Support\PlotAllocator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class LeaveGroup
{
    /**
     * @return array{address: string, group: ?Group}
     */
    public function handle(Tomb $tomb, string $reason = 'left', bool $notify = false): array
    {
        return DB::transaction(function () use ($tomb, $reason, $notify) {
            $tomb = Tomb::query()->whereKey($tomb->id)->lockForUpdate()->firstOrFail();

            if (! $tomb->group_id) {
                throw new HttpResponseException(
                    response()->json(['message' => '你不在合葬墓里'], 422)
                );
            }

            $group = Group::query()->whereKey($tomb->group_id)->lockForUpdate()->firstOrFail();
            $member = GroupMember::query()
                ->where('group_id', $group->id)
                ->where('tomb_id', $tomb->id)
                ->whereNull('left_at')
                ->lockForUpdate()
                ->firstOrFail();

            $member->left_at = now();
            $member->left_reason = $reason;
            $member->group_name_snapshot = $group->name;
            $member->save();

            $tomb->group_id = null;
            $tomb->save();

            $remaining = GroupMember::query()
                ->where('group_id', $group->id)
                ->whereNull('left_at')
                ->orderBy('joined_at')
                ->lockForUpdate()
                ->get();

            if ($remaining->isEmpty()) {
                GroupBlockAllocator::release($group);
                $group->disbanded_at = now();
                $group->save();
                GroupMember::query()
                    ->where('group_id', $group->id)
                    ->whereNull('left_at')
                    ->update([
                        'left_at' => now(),
                        'left_reason' => 'disbanded',
                        'group_name_snapshot' => $group->name,
                    ]);
            } elseif ((int) $group->founder_tomb_id === (int) $tomb->id) {
                $group->founder_tomb_id = $remaining->first()->tomb_id;
                $group->save();
            }

            if ($notify && $tomb->user_id) {
                Dream::query()->create([
                    'offering_id' => null,
                    'kind' => 'system',
                    'join_request_id' => null,
                    'tomb_id' => null,
                    'to_user_id' => $tomb->user_id,
                    'text' => '你被请出了 '.$member->group_name_snapshot.'。',
                    'style' => 'plain',
                    'visible_at' => now(),
                    'read_at' => null,
                    'created_at' => now(),
                ]);
            }

            $placed = PlotAllocator::placeInHomeZone($tomb);

            return [
                'address' => $placed['address'],
                'group' => $group->fresh(['activeMembers.tomb', 'phase.zone', 'founder']),
            ];
        });
    }
}
