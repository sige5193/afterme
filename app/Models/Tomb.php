<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tomb extends Model
{
    protected $fillable = [
        'user_id',
        'is_npc',
        'npc_key',
        'code',
        'name',
        'birth_year',
        'cause',
        'portrait',
        'last_words',
        'style',
        'plot',
        'epitaph',
        'epitaph_edits',
        'eulogy',
        'verdict',
        'couplet',
        'zhashi_count',
        'zhashi_until',
        'knock_count',
        'last_knock_at',
        'funerals',
        'died_at',
    ];

    protected function casts(): array
    {
        return [
            'is_npc' => 'boolean',
            'birth_year' => 'integer',
            'portrait' => 'integer',
            'plot' => 'integer',
            'epitaph_edits' => 'integer',
            'couplet' => 'integer',
            'zhashi_count' => 'integer',
            'zhashi_until' => 'datetime',
            'knock_count' => 'integer',
            'last_knock_at' => 'datetime',
            'funerals' => 'integer',
            'died_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(Offering::class);
    }

    public function dreams(): HasMany
    {
        return $this->hasMany(Dream::class);
    }

    public function isOrphan(): bool
    {
        if ($this->is_npc || ! $this->user_id) {
            return false;
        }

        $user = $this->relationLoaded('user') ? $this->user : $this->user()->first();
        if (! $user || ! $user->last_seen_at) {
            return true;
        }

        return $user->last_seen_at->lt(now()->subDays(30));
    }

    public function toListArray(bool $hot = false): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'cause' => $this->cause,
            'style' => $this->style,
            'portrait' => $this->portrait,
            'plot' => $this->plot,
            'is_npc' => (bool) $this->is_npc,
            'is_orphan' => $this->isOrphan(),
            'hot' => $hot,
        ];
    }

    public function toDetailArray(array $extra = []): array
    {
        return array_merge($this->toListArray($extra['hot'] ?? false), [
            'birth_year' => $this->birth_year,
            'died_at' => optional($this->died_at)?->toIso8601String(),
            'last_words' => $this->last_words,
            'epitaph' => $this->epitaph,
            'epitaph_edits' => $this->epitaph_edits,
            'zhashi_count' => $this->zhashi_count,
            'zhashi_until' => optional($this->zhashi_until)?->toIso8601String(),
            'knock_count' => $this->knock_count,
            'last_knock_at' => optional($this->last_knock_at)?->toIso8601String(),
            'funerals' => $this->funerals,
            'eulogy' => $this->eulogy,
            'verdict' => $this->verdict,
            'couplet' => $this->couplet,
            'item_totals' => $extra['item_totals'] ?? new \stdClass,
            'offering_count' => $extra['offering_count'] ?? 0,
            'last_offering_at' => $extra['last_offering_at'] ?? null,
        ]);
    }

    public function toOwnerArray(): array
    {
        return $this->toDetailArray();
    }
}
