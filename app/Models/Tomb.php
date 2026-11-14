<?php

namespace App\Models;

use App\Support\TombAddress;
use Database\Factories\TombFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tomb extends Model
{
    /** @use HasFactory<TombFactory> */
    use HasFactory;

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
        'home_zone_id',
        'group_id',
        'move_count',
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
            'move_count' => 'integer',
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

    public function homeZone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'home_zone_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function plotCell(): HasOne
    {
        return $this->hasOne(PlotCell::class);
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(Offering::class);
    }

    public function dreams(): HasMany
    {
        return $this->hasMany(Dream::class);
    }

    public function groupMemberships(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function pastGroupMemberships(): HasMany
    {
        return $this->hasMany(GroupMember::class)->whereNotNull('left_at')->orderByDesc('left_at');
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

    public function locationPayload(): array
    {
        if ($this->group_id) {
            $group = $this->relationLoaded('group') ? $this->group : $this->group()->with('phase.zone')->first();
            if ($group) {
                if (! $group->relationLoaded('phase')) {
                    $group->load('phase.zone');
                } elseif ($group->phase && ! $group->phase->relationLoaded('zone')) {
                    $group->phase->load('zone');
                }

                return [
                    'zone' => $group->phase?->zone ? [
                        'key' => $group->phase->zone->key,
                        'name' => $group->phase->zone->name,
                    ] : null,
                    'phase' => $group->phase ? [
                        'id' => $group->phase->id,
                        'number' => $group->phase->number,
                    ] : null,
                    'cell' => $group->start_cell,
                    'address' => TombAddress::forGroup($group),
                ];
            }
        }

        $cell = $this->relationLoaded('plotCell') ? $this->plotCell : $this->plotCell()->with('phase.zone')->first();
        if (! $cell) {
            return [
                'zone' => null,
                'phase' => null,
                'cell' => null,
                'address' => null,
            ];
        }

        if (! $cell->relationLoaded('phase')) {
            $cell->load('phase.zone');
        } elseif ($cell->phase && ! $cell->phase->relationLoaded('zone')) {
            $cell->phase->load('zone');
        }

        return [
            'zone' => $cell->phase?->zone ? [
                'key' => $cell->phase->zone->key,
                'name' => $cell->phase->zone->name,
            ] : null,
            'phase' => $cell->phase ? [
                'id' => $cell->phase->id,
                'number' => $cell->phase->number,
            ] : null,
            'cell' => $cell->cell,
            'address' => TombAddress::forCell($cell),
        ];
    }

    public function toListArray(bool $hot = false): array
    {
        $location = $this->locationPayload();

        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'cause' => $this->cause,
            'style' => $this->style,
            'portrait' => $this->portrait,
            'zone' => $location['zone'],
            'phase' => $location['phase'],
            'cell' => $location['cell'],
            'address' => $location['address'],
            'move_count' => $this->move_count,
            'is_npc' => (bool) $this->is_npc,
            'is_orphan' => $this->isOrphan(),
            'hot' => $hot,
            'group' => $this->group_id ? [
                'code' => $this->relationLoaded('group') && $this->group
                    ? $this->group->code
                    : ($this->group()->value('code')),
                'name' => $this->relationLoaded('group') && $this->group
                    ? $this->group->name
                    : ($this->group()->value('name')),
            ] : null,
        ];
    }

    public function toDetailArray(array $extra = []): array
    {
        $pastGroups = [];
        if ($this->relationLoaded('pastGroupMemberships')) {
            $pastGroups = $this->pastGroupMemberships->map(fn (GroupMember $member) => [
                'name_snapshot' => $member->group_name_snapshot,
                'left_at' => optional($member->left_at)?->toIso8601String(),
            ])->values()->all();
        }

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
            'past_groups' => $pastGroups,
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
