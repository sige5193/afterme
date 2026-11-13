<?php

namespace App\Support;

class ResurrectCode
{
    public const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    public static function generate(): string
    {
        $alphabet = self::ALPHABET;
        $max = strlen($alphabet) - 1;
        $code = '';

        for ($i = 0; $i < 16; $i++) {
            $code .= $alphabet[random_int(0, $max)];
        }

        return $code;
    }

    public static function normalize(string $code): string
    {
        $code = preg_replace('/黄泉/u', '', $code) ?? $code;
        $code = str_replace(['-', ' ', "\t", "\n", "\r"], '', $code);

        return strtoupper($code);
    }

    public static function hash(string $normalized): string
    {
        return hash_hmac('sha256', $normalized, (string) config('app.key'));
    }

    public static function hashFromInput(string $code): string
    {
        return self::hash(self::normalize($code));
    }

    public static function formatForDisplay(string $raw): string
    {
        $chunks = str_split($raw, 4);

        return '黄泉-'.implode('-', $chunks);
    }
}
