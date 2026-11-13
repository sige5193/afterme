<?php

namespace App\Support;

use App\Models\Tomb;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class DayNight
{
    public static function isNight(?string $timezone, ?CarbonInterface $now = null): bool
    {
        $tz = $timezone ?: 'Asia/Shanghai';
        $local = ($now ? Carbon::instance($now) : now())->copy()->timezone($tz);
        $hour = (int) $local->format('G');

        return $hour >= 18 || $hour < 6;
    }

    public static function ghostOut(?User $user, ?Tomb $tomb = null, ?CarbonInterface $now = null): bool
    {
        $tomb ??= $user?->tomb;
        if (! $user || ! $tomb) {
            return false;
        }

        $now ??= now();

        if (self::isNight($user->timezone, $now)) {
            return true;
        }

        return $tomb->zhashi_until !== null && $tomb->zhashi_until->gt($now);
    }
}
