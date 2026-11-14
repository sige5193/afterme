<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GroupMember extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'group_id',
        'tomb_id',
        'joined_at',
        'left_at',
        'left_reason',
        'group_name_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function tomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class);
    }

    public function isActive(): bool
    {
        return $this->left_at === null;
    }
}
