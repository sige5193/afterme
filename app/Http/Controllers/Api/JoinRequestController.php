<?php

namespace App\Http\Controllers\Api;

use App\Actions\AcceptJoinRequest;
use App\Actions\DeclineJoinRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RespondJoinRequestRequest;
use App\Http\Requests\Api\StoreApplyJoinRequest;
use App\Http\Requests\Api\StoreInviteJoinRequest;
use App\Models\Dream;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\JoinBlock;
use App\Models\JoinRequest;
use App\Models\Tomb;
use App\Support\DayNight;
use App\Support\OfferingStats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JoinRequestController extends Controller
{
    public function invite(StoreInviteJoinRequest $request, string $code): JsonResponse
    {
        $user = $request->user();
        $from = $user->tomb;
        if (! $from) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }
        if (! DayNight::ghostOut($user, $from)) {
            return response()->json(['message' => '夜里才能递结伴帖'], 422);
        }

        $to = Tomb::query()->where('code', $code)->first();
        if (! $to) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }
        if ($to->group_id) {
            return response()->json(['message' => 'TA 已经和别人合葬了，得先迁出来'], 422);
        }
        if (JoinBlock::query()->where('blocker_tomb_id', $to->id)->where('blocked_tomb_id', $from->id)->exists()) {
            return response()->json(['message' => '对方不想再收到你的结伴帖'], 422);
        }
        if ($from->group_id) {
            $count = GroupMember::query()->where('group_id', $from->group_id)->whereNull('left_at')->count();
            if ($count >= (int) config('afterme.group_max_members', 6)) {
                return response()->json(['message' => '满员了'], 422);
            }
        }

        $pending = JoinRequest::query()
            ->where('from_tomb_id', $from->id)
            ->where('to_tomb_id', $to->id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->exists();
        if ($pending) {
            return response()->json(['message' => '上一份结伴帖还没回音'], 422);
        }

        $data = $request->validated();
        if (! $from->group_id && (empty($data['relation']) || empty($data['group_name']))) {
            return response()->json(['message' => '新建合葬墓需要墓名和关系'], 422);
        }

        $join = JoinRequest::query()->create([
            'type' => 'invite',
            'from_tomb_id' => $from->id,
            'to_tomb_id' => $to->id,
            'group_id' => $from->group_id,
            'relation' => $from->group_id ? null : ($data['relation'] ?? null),
            'group_name' => $from->group_id ? null : ($data['group_name'] ?? null),
            'message' => $data['message'] ?? null,
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
            'created_at' => now(),
        ]);

        if ($to->is_npc && $to->npc_key) {
            $text = (string) config('afterme.npc_join_decline.'.$to->npc_key, '说了没人。');
            $join->status = 'declined';
            $join->reply_text = $text;
            $join->reply_style = 'plain';
            $join->responder_tomb_id = $to->id;
            $join->responded_at = now();
            $join->save();

            Dream::query()->create([
                'offering_id' => null,
                'kind' => 'join_result',
                'join_request_id' => $join->id,
                'tomb_id' => $to->id,
                'to_user_id' => $user->id,
                'text' => $text,
                'style' => 'plain',
                'visible_at' => now()->addSeconds(random_int(6, 11)),
                'read_at' => null,
                'created_at' => now(),
            ]);
        }

        return response()->json([
            'join_request' => $join->fresh(['fromTomb', 'toTomb', 'group'])->toApiArray(),
        ]);
    }

    public function apply(StoreApplyJoinRequest $request, string $code): JsonResponse
    {
        $user = $request->user();
        $from = $user->tomb;
        if (! $from) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }
        if ($from->group_id) {
            return response()->json(['message' => '你已经在合葬墓里了'], 422);
        }
        if (! DayNight::ghostOut($user, $from)) {
            return response()->json(['message' => '夜里才能递结伴帖'], 422);
        }

        $group = Group::query()->where('code', $code)->whereNull('disbanded_at')->first();
        if (! $group) {
            return response()->json(['message' => '这座合葬墓已经拆了'], 404);
        }

        $count = GroupMember::query()->where('group_id', $group->id)->whereNull('left_at')->count();
        if ($count >= (int) config('afterme.group_max_members', 6)) {
            return response()->json(['message' => '满员了'], 422);
        }

        if (JoinBlock::query()->where('blocker_tomb_id', $group->founder_tomb_id)->where('blocked_tomb_id', $from->id)->exists()) {
            return response()->json(['message' => '对方不想再收到你的结伴帖'], 422);
        }

        $pending = JoinRequest::query()
            ->where('from_tomb_id', $from->id)
            ->where('group_id', $group->id)
            ->where('type', 'apply')
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->exists();
        if ($pending) {
            return response()->json(['message' => '上一份结伴帖还没回音'], 422);
        }

        $join = JoinRequest::query()->create([
            'type' => 'apply',
            'from_tomb_id' => $from->id,
            'to_tomb_id' => null,
            'group_id' => $group->id,
            'relation' => null,
            'group_name' => null,
            'message' => $request->input('message'),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
            'created_at' => now(),
        ]);

        return response()->json([
            'join_request' => $join->fresh(['fromTomb', 'group'])->toApiArray(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $tomb = $request->user()->tomb;
        if (! $tomb) {
            return response()->json(['incoming' => [], 'outgoing' => []]);
        }

        $incoming = JoinRequest::query()
            ->with(['fromTomb', 'toTomb', 'group'])
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->where(function ($q) use ($tomb) {
                $q->where('to_tomb_id', $tomb->id);
                if ($tomb->group_id) {
                    $founderId = Group::query()->whereKey($tomb->group_id)->value('founder_tomb_id');
                    if ((int) $founderId === (int) $tomb->id) {
                        $q->orWhere(function ($qq) use ($tomb) {
                            $qq->where('type', 'apply')->where('group_id', $tomb->group_id);
                        });
                    }
                }
            })
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (JoinRequest $r) => $r->toApiArray())
            ->values();

        $outgoing = JoinRequest::query()
            ->with(['fromTomb', 'toTomb', 'group'])
            ->where('from_tomb_id', $tomb->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (JoinRequest $r) => $r->toApiArray())
            ->values();

        return response()->json([
            'incoming' => $incoming,
            'outgoing' => $outgoing,
        ]);
    }

    public function respond(
        RespondJoinRequestRequest $request,
        int $id,
        AcceptJoinRequest $accept,
        DeclineJoinRequest $decline
    ): JsonResponse {
        $user = $request->user();
        $tomb = $user->tomb;
        if (! $tomb) {
            return response()->json(['message' => '阴间服务器开小差了…'], 422);
        }
        if (! DayNight::ghostOut($user, $tomb)) {
            return response()->json(['message' => '夜里才能回结伴帖'], 422);
        }

        $join = JoinRequest::query()->find($id);
        if (! $join) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        $decision = $request->string('decision')->toString();
        if ($decision === 'accept') {
            $group = $accept->handle(
                $join,
                $tomb,
                $request->input('reply_text'),
                $request->input('reply_style')
            );

            return response()->json([
                'join_request' => $join->fresh(['fromTomb', 'toTomb', 'group'])->toApiArray(),
                'group' => [
                    'code' => $group->code,
                    'name' => $group->name,
                ],
                'tomb' => $tomb->fresh(['plotCell.phase.zone', 'group.phase.zone', 'pastGroupMemberships'])
                    ->toDetailArray(OfferingStats::forTomb($tomb)),
            ]);
        }

        $join = $decline->handle(
            $join,
            $tomb,
            $request->input('reply_text'),
            $request->input('reply_style'),
            (bool) $request->boolean('block')
        );

        return response()->json([
            'join_request' => $join->toApiArray(),
        ]);
    }
}
