<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlotCell extends Model
{
    protected $fillable = [
        'zone_phase_id',
        'cell',
        'tomb_id',
        'group_id',
    ];

    protected function casts(): array
    {
        return [
            'cell' => 'integer',
        ];
    }

    public function phase(): BelongsTo
    {
        return $this->belongsTo(ZonePhase::class, 'zone_phase_id');
    }

    public function tomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }
}
