<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Presence extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'mode',
        'zone_phase_id',
        'cell',
        'viewing_tomb_id',
        'seen_at',
    ];

    protected function casts(): array
    {
        return [
            'cell' => 'integer',
            'zone_phase_id' => 'integer',
            'viewing_tomb_id' => 'integer',
            'seen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function viewingTomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'viewing_tomb_id');
    }

    public function phase(): BelongsTo
    {
        return $this->belongsTo(ZonePhase::class, 'zone_phase_id');
    }
}
