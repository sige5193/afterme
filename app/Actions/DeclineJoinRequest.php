<?php

namespace App\Actions;

use App\Models\Dream;
use App\Models\JoinBlock;
use App\Models\JoinRequest;
use App\Models\Tomb;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class DeclineJoinRequest
{
    public function handle(
        JoinRequest $request,
        Tomb $responder,
        ?string $replyText,
        ?string $replyStyle,
        bool $block
    ): JoinRequest {
        return DB::transaction(function () use ($request, $responder, $replyText, $replyStyle, $block) {
            $locked = JoinRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $locked->markExpiredIfNeeded();

            if ($locked->status !== 'pending') {
                throw new HttpResponseException(
                    response()->json(['message' => '这份结伴帖已经失效了'], 409)
                );
            }

            if ($locked->type === 'invite') {
                if ((int) $locked->to_tomb_id !== (int) $responder->id) {
                    throw new HttpResponseException(response()->json(['message' => '阴间服务器开小差了…'], 403));
                }
            } else {
                $group = $locked->group()->lockForUpdate()->first();
                if (! $group || (int) $group->founder_tomb_id !== (int) $responder->id) {
                    throw new HttpResponseException(response()->json(['message' => '阴间服务器开小差了…'], 403));
                }
            }

            $text = $replyText ?: collect(config('afterme.join_decline_replies'))->random();
            $style = $replyStyle ?: 'plain';

            $locked->status = 'declined';
            $locked->reply_text = $text;
            $locked->reply_style = $style;
            $locked->responder_tomb_id = $responder->id;
            $locked->responded_at = now();
            $locked->save();

            if ($block) {
                JoinBlock::query()->firstOrCreate(
                    [
                        'blocker_tomb_id' => $responder->id,
                        'blocked_tomb_id' => $locked->from_tomb_id,
                    ],
                    ['created_at' => now()]
                );
            }

            $from = Tomb::query()->find($locked->from_tomb_id);
            if ($from?->user_id) {
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

            return $locked->fresh(['fromTomb', 'toTomb', 'group']);
        });
    }
}
