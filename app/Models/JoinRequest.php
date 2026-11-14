<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JoinRequest extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'type',
        'from_tomb_id',
        'to_tomb_id',
        'group_id',
        'relation',
        'group_name',
        'message',
        'status',
        'reply_text',
        'reply_style',
        'responder_tomb_id',
        'responded_at',
        'expires_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'responded_at' => 'datetime',
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function fromTomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'from_tomb_id');
    }

    public function toTomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'to_tomb_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'responder_tomb_id');
    }

    public function isExpired(): bool
    {
        return $this->status === 'pending' && $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function markExpiredIfNeeded(): void
    {
        if ($this->isExpired()) {
            $this->status = 'expired';
            $this->save();
        }
    }

    public function toApiArray(): array
    {
        $from = $this->relationLoaded('fromTomb') ? $this->fromTomb : null;
        $to = $this->relationLoaded('toTomb') ? $this->toTomb : null;
        $group = $this->relationLoaded('group') ? $this->group : null;

        return [
            'id' => $this->id,
            'type' => $this->type,
            'from_tomb' => $from ? [
                'code' => $from->code,
                'name' => $from->name,
            ] : null,
            'to_tomb' => $to ? [
                'code' => $to->code,
                'name' => $to->name,
            ] : null,
            'group' => $group ? [
                'code' => $group->code,
                'name' => $group->name,
            ] : ($this->group_name ? [
                'code' => null,
                'name' => $this->group_name,
            ] : null),
            'relation' => $this->relation,
            'relation_label' => $this->relation
                ? (string) (config('afterme.relations.'.$this->relation) ?? $this->relation)
                : null,
            'group_name' => $this->group_name,
            'message' => $this->message,
            'status' => $this->status,
            'reply_text' => $this->reply_text,
            'reply_style' => $this->reply_style,
            'expires_at' => optional($this->expires_at)?->toIso8601String(),
            'responded_at' => optional($this->responded_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
