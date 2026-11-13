<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'timezone',
        'resurrect_code_hash',
        'last_seen_at',
    ];

    protected $hidden = [
        'resurrect_code_hash',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
        ];
    }

    public function tomb(): HasOne
    {
        return $this->hasOne(Tomb::class);
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(Offering::class);
    }

    public function presence(): HasOne
    {
        return $this->hasOne(Presence::class);
    }

    public function receivedDreams(): HasMany
    {
        return $this->hasMany(Dream::class, 'to_user_id');
    }

    public function touchSeen(?string $timezone = null): void
    {
        $attrs = ['last_seen_at' => now()];

        if ($timezone !== null && $timezone !== '') {
            $attrs['timezone'] = $timezone;
        }

        $this->forceFill($attrs)->save();
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'timezone' => $this->timezone,
            'last_seen_at' => optional($this->last_seen_at)?->toIso8601String(),
            'has_resurrect_code' => $this->resurrect_code_hash !== null,
        ];
    }
}
