<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Group extends Model
{
    protected $fillable = [
        'code',
        'name',
        'relation',
        'founder_tomb_id',
        'zone_phase_id',
        'start_cell',
        'width',
        'epitaph',
        'epitaph_edits',
        'disbanded_at',
    ];

    protected function casts(): array
    {
        return [
            'start_cell' => 'integer',
            'width' => 'integer',
            'epitaph_edits' => 'integer',
            'disbanded_at' => 'datetime',
        ];
    }

    public function founder(): BelongsTo
    {
        return $this->belongsTo(Tomb::class, 'founder_tomb_id');
    }

    public function phase(): BelongsTo
    {
        return $this->belongsTo(ZonePhase::class, 'zone_phase_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function activeMembers(): HasMany
    {
        return $this->hasMany(GroupMember::class)->whereNull('left_at')->orderBy('joined_at');
    }

    public function cells(): HasMany
    {
        return $this->hasMany(PlotCell::class);
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(Offering::class);
    }

    public function isDisbanded(): bool
    {
        return $this->disbanded_at !== null;
    }

    public function relationLabel(): string
    {
        return (string) (config('afterme.relations.'.$this->relation) ?? $this->relation);
    }

    public function toSummaryArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'relation' => $this->relation,
            'relation_label' => $this->relationLabel(),
            'width' => $this->width,
            'start_cell' => $this->start_cell,
            'member_count' => $this->relationLoaded('activeMembers')
                ? $this->activeMembers->count()
                : $this->activeMembers()->count(),
            'disbanded_at' => optional($this->disbanded_at)?->toIso8601String(),
        ];
    }
}
