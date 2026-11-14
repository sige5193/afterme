<?php

namespace App\Http\Controllers\Api;

use App\Actions\LeaveGroup;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\MoveGroupRequest;
use App\Http\Requests\Api\StoreGroupOfferingRequest;
use App\Http\Requests\Api\UpdateGroupEpitaphRequest;
use App\Http\Requests\Api\UpdateGroupRequest;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Offering;
use App\Models\OfferingItem;
use App\Models\Tomb;
use App\Models\ZonePhase;
use App\Support\DayNight;
use App\Support\GroupBlockAllocator;
use App\Support\OfferingStats;
use App\Support\TombAddress;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    public function show(string $code): JsonResponse
    {
        $group = Group::query()
            ->with([
                'phase.zone',
                'founder',
                'activeMembers.tomb.user:id,last_seen_at',
                'activeMembers.tomb.pastGroupMemberships',
                'members.tomb',
            ])
            ->where('code', $code)
            ->first();

        if (! $group) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        return response()->json(['group' => $this->detail($group)]);
    }

    public function update(UpdateGroupRequest $request, string $code): JsonResponse
    {
        $group = $this->findActiveGroup($code);
        $tomb = $request->user()->tomb;
        if (! $tomb || (int) $group->founder_tomb_id !== (int) $tomb->id) {
            return response()->json(['message' => '阴间服务器开小差了…'], 403);
        }

        $data = $request->validated();
        if (isset($data['name'])) {
            $group->name = $data['name'];
        }
        if (isset($data['relation'])) {
            $group->relation = $data['relation'];
        }
        $group->save();

        return response()->json(['group' => $this->detail($group->fresh([
            'phase.zone', 'founder', 'activeMembers.tomb.pastGroupMemberships', 'members.tomb',
        ]))]);
    }

    public function updateEpitaph(UpdateGroupEpitaphRequest $request, string $code): JsonResponse
    {
        $group = $this->findActiveGroup($code);
        $user = $request->user();
        $tomb = $user->tomb;
        if (! $tomb || (int) $tomb->group_id !== (int) $group->id) {
            return response()->json(['message' => '阴间服务器开小差了…'], 403);
        }
        if (! DayNight::ghostOut($user, $tomb)) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        $epitaph = $request->string('epitaph')->toString();
        if ($epitaph !== (string) $group->epitaph) {
            $group->epitaph = $epitaph;
            $group->epitaph_edits = $group->epitaph_edits + 1;
            $group->save();
        }

        return response()->json(['group' => $this->detail($group->fresh([
            'phase.zone', 'founder', 'activeMembers.tomb.pastGroupMemberships', 'members.tomb',
        ]))]);
    }

    public function move(MoveGroupRequest $request, string $code): JsonResponse
    {
        $group = $this->findActiveGroup($code);
        $user = $request->user();
        $tomb = $user->tomb;
        if (! $tomb || (int) $group->founder_tomb_id !== (int) $tomb->id) {
            return response()->json(['message' => '阴间服务器开小差了…'], 403);
        }
        if (! DayNight::ghostOut($user, $tomb)) {
            return response()->json(['message' => '白天扛不动棺材，夜里再迁'], 422);
        }

        $phase = ZonePhase::query()->with('zone')->findOrFail($request->integer('zone_phase_id'));
        $count = $group->activeMembers()->count();

        GroupBlockAllocator::allocate($group, $count, $phase, $request->integer('start_cell'));

        return response()->json([
            'group' => $this->detail($group->fresh([
                'phase.zone', 'founder', 'activeMembers.tomb.pastGroupMemberships', 'members.tomb',
            ])),
            'address' => TombAddress::forGroup($group->fresh('phase.zone')),
        ]);
    }

    public function remove(Request $request, string $code, LeaveGroup $leaveGroup): JsonResponse
    {
        $group = $this->findActiveGroup($code);
        $founder = $request->user()->tomb;
        if (! $founder || (int) $group->founder_tomb_id !== (int) $founder->id) {
            return response()->json(['message' => '阴间服务器开小差了…'], 403);
        }

        $targetCode = (string) $request->input('tomb_code');
        $target = Tomb::query()->where('code', $targetCode)->first();
        if (! $target || (int) $target->group_id !== (int) $group->id) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }
        if ((int) $target->id === (int) $founder->id) {
            return response()->json(['message' => '墓长不能请出自己'], 422);
        }

        $result = $leaveGroup->handle($target, 'removed', true);

        return response()->json([
            'group' => $result['group'] ? $this->detail($result['group']) : null,
            'removed_address' => $result['address'],
        ]);
    }

    public function leave(Request $request, LeaveGroup $leaveGroup): JsonResponse
    {
        $tomb = $request->user()->tomb;
        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }

        $result = $leaveGroup->handle($tomb, 'left', false);

        return response()->json([
            'address' => $result['address'],
            'tomb' => $tomb->fresh(['plotCell.phase.zone', 'pastGroupMemberships'])->toDetailArray(OfferingStats::forTomb($tomb)),
            'group' => $result['group'] && ! $result['group']->isDisbanded()
                ? $this->detail($result['group'])
                : null,
        ]);
    }

    public function storeOffering(StoreGroupOfferingRequest $request, string $code): JsonResponse
    {
        $group = $this->findActiveGroup($code);
        $user = $request->user();
        $fromName = trim((string) $request->input('from_name', ''));
        if ($fromName === '') {
            $fromName = '一位路过的活人';
        }

        $targetTombCode = $request->input('tomb_code');
        $targetTomb = null;
        if ($targetTombCode) {
            $targetTomb = Tomb::query()->where('code', $targetTombCode)->where('group_id', $group->id)->first();
            if (! $targetTomb) {
                return response()->json(['message' => '阴间服务器开小差了…'], 404);
            }
        }

        $items = $request->input('items', []);
        $message = $request->input('message');

        $offering = DB::transaction(function () use ($user, $group, $targetTomb, $fromName, $items, $message) {
            $offering = Offering::query()->create([
                'tomb_id' => $targetTomb?->id,
                'group_id' => $targetTomb ? null : $group->id,
                'user_id' => $user->id,
                'from_name' => $fromName,
                'message' => $message,
                'created_at' => now(),
            ]);

            foreach ($items as $key => $qty) {
                OfferingItem::query()->create([
                    'offering_id' => $offering->id,
                    'item_key' => $key,
                    'qty' => (int) $qty,
                ]);
            }

            return $offering->load(['items', 'group', 'tomb']);
        });

        return response()->json(['offering' => $offering->toApiArray(true)]);
    }

    private function findActiveGroup(string $code): Group
    {
        $group = Group::query()->where('code', $code)->first();
        if (! $group || $group->isDisbanded()) {
            abort(response()->json(['message' => '这座合葬墓已经拆了'], 404));
        }

        return $group;
    }

    private function detail(Group $group): array
    {
        $group->loadMissing([
            'phase.zone',
            'founder',
            'activeMembers.tomb.user:id,last_seen_at',
            'activeMembers.tomb.pastGroupMemberships',
            'members.tomb',
        ]);

        $groupOfferings = Offering::query()->where('group_id', $group->id)->whereNull('tomb_id');
        $groupCount = (clone $groupOfferings)->count();
        $groupLast = (clone $groupOfferings)->max('created_at');

        $pastNames = GroupMember::query()
            ->with('tomb:id,name')
            ->where('group_id', $group->id)
            ->whereNotNull('left_at')
            ->orderByDesc('left_at')
            ->get()
            ->pluck('tomb.name')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $members = $group->activeMembers->map(function (GroupMember $member) use ($group) {
            $tomb = $member->tomb;
            $stats = $tomb ? OfferingStats::forTomb($tomb) : [];

            return [
                'tomb_code' => $tomb?->code,
                'name' => $tomb?->name,
                'cause' => $tomb?->cause,
                'portrait' => $tomb?->portrait,
                'style' => $tomb?->style,
                'last_words' => $tomb?->last_words,
                'epitaph' => $tomb?->epitaph,
                'joined_at' => optional($member->joined_at)?->toIso8601String(),
                'is_founder' => (int) $group->founder_tomb_id === (int) $member->tomb_id,
                'past_groups' => $tomb?->pastGroupMemberships->map(fn ($m) => [
                    'name_snapshot' => $m->group_name_snapshot,
                    'left_at' => optional($m->left_at)?->toIso8601String(),
                ])->values()->all() ?? [],
                'item_totals' => $stats['item_totals'] ?? new \stdClass,
                'offering_count' => $stats['offering_count'] ?? 0,
                'last_offering_at' => $stats['last_offering_at'] ?? null,
            ];
        })->values()->all();

        return [
            'code' => $group->code,
            'name' => $group->name,
            'relation' => $group->relation,
            'relation_label' => $group->relationLabel(),
            'founder_tomb_code' => $group->founder?->code,
            'founder_name' => $group->founder?->name,
            'zone' => $group->phase?->zone ? [
                'key' => $group->phase->zone->key,
                'name' => $group->phase->zone->name,
            ] : null,
            'phase' => $group->phase ? [
                'id' => $group->phase->id,
                'number' => $group->phase->number,
            ] : null,
            'start_cell' => $group->start_cell,
            'width' => $group->width,
            'address' => TombAddress::forGroup($group),
            'epitaph' => $group->epitaph,
            'epitaph_edits' => $group->epitaph_edits,
            'disbanded_at' => optional($group->disbanded_at)?->toIso8601String(),
            'members' => $members,
            'past_member_names' => $pastNames,
            'offering_count' => $groupCount,
            'last_offering_at' => $groupLast ? Carbon::parse($groupLast)->toIso8601String() : null,
        ];
    }
}
