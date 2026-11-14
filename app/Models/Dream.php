<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dream extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'offering_id',
        'kind',
        'join_request_id',
        'tomb_id',
        'to_user_id',
        'text',
        'style',
        'visible_at',
        'read_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'visible_at' => 'datetime',
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function offering(): BelongsTo
    {
        return $this->belongsTo(Offering::class);
    }

    public function tomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class);
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function joinRequest(): BelongsTo
    {
        return $this->belongsTo(JoinRequest::class);
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'offering_id' => $this->offering_id,
            'kind' => $this->kind ?? 'reply',
            'join_request_id' => $this->join_request_id,
            'tomb_id' => $this->tomb_id,
            'to_user_id' => $this->to_user_id,
            'text' => $this->text,
            'style' => $this->style,
            'visible_at' => optional($this->visible_at)?->toIso8601String(),
            'read_at' => optional($this->read_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'tomb' => $this->relationLoaded('tomb') && $this->tomb ? [
                'code' => $this->tomb->code,
                'name' => $this->tomb->name,
            ] : null,
        ];
    }
}
