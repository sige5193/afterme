<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JoinBlock extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = [
        'blocker_tomb_id',
        'blocked_tomb_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'blocker_tomb_id');
    }

    public function blocked(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'blocked_tomb_id');
    }
}
