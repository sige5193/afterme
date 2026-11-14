<?php

namespace App\Support;

use App\Models\Group;
use App\Models\Tomb;

class GroupCode
{
    public static function generate(): string
    {
        $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $max = strlen($alphabet) - 1;

        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) {
                $code .= $alphabet[random_int(0, $max)];
            }
        } while (
            Group::query()->where('code', $code)->exists()
            || Tomb::query()->where('code', $code)->exists()
        );

        return $code;
    }
}
