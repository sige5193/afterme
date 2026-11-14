<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'key',
        'name',
        'tagline',
        'default_style',
        'is_group_zone',
        'sort',
    ];

    protected function casts(): array
    {
        return [
            'is_group_zone' => 'boolean',
            'sort' => 'integer',
        ];
    }

    public function phases(): HasMany
    {
        return $this->hasMany(ZonePhase::class)->orderBy('number');
    }

    public function toApiArray(array $extra = []): array
    {
        return [
            'key' => $this->key,
            'name' => $this->name,
            'tagline' => $this->tagline,
            'default_style' => $this->default_style,
            'is_group_zone' => (bool) $this->is_group_zone,
            'tomb_count' => $extra['tomb_count'] ?? 0,
            'ghosts_online' => $extra['ghosts_online'] ?? 0,
            'phases' => $extra['phases'] ?? [],
        ];
    }
}
