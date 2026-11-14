<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ZonePhase extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'zone_id',
        'number',
        'capacity',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'capacity' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function cells(): HasMany
    {
        return $this->hasMany(PlotCell::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class);
    }

    public function toApiArray(int $usedCells = 0): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'used_cells' => $usedCells,
            'capacity' => $this->capacity,
        ];
    }
}
