<?php

namespace App\Support;

use App\Models\Group;
use App\Models\PlotCell;
use App\Models\Zone;
use App\Models\ZonePhase;

class TombAddress
{
    public static function chineseNumber(int $number): string
    {
        $map = [
            1 => '一',
            2 => '二',
            3 => '三',
            4 => '四',
            5 => '五',
            6 => '六',
            7 => '七',
            8 => '八',
            9 => '九',
            10 => '十',
        ];

        if (isset($map[$number])) {
            return $map[$number];
        }

        if ($number < 20) {
            return '十'.$map[$number - 10];
        }

        if ($number < 100) {
            $tens = intdiv($number, 10);
            $ones = $number % 10;

            return $map[$tens].'十'.($ones > 0 ? $map[$ones] : '');
        }

        return (string) $number;
    }

    public static function zoneDisplayName(Zone $zone, int $phaseNumber): string
    {
        if ($phaseNumber <= 1) {
            return $zone->name;
        }

        return $zone->name.' · '.self::chineseNumber($phaseNumber).'期';
    }

    public static function phaseLabel(int $phaseNumber): string
    {
        return self::chineseNumber($phaseNumber).'期';
    }

    public static function forPhaseCell(ZonePhase $phase, int $cell): string
    {
        $zone = $phase->relationLoaded('zone') ? $phase->zone : $phase->zone()->first();
        $cols = (int) config('afterme.grid_cols', 6);
        $row = intdiv($cell, $cols) + 1;
        $col = ($cell % $cols) + 1;
        $zoneName = $zone ? self::zoneDisplayName($zone, $phase->number) : '';

        return trim($zoneName.' 第 '.$row.' 排第 '.$col.' 号');
    }

    public static function forCell(PlotCell $cell): string
    {
        $phase = $cell->relationLoaded('phase') ? $cell->phase : $cell->phase()->with('zone')->first();

        if (! $phase) {
            return '';
        }

        return self::forPhaseCell($phase, (int) $cell->cell);
    }

    public static function forGroup(Group $group): string
    {
        $phase = $group->relationLoaded('phase') ? $group->phase : $group->phase()->with('zone')->first();

        if (! $phase) {
            return '';
        }

        return self::forPhaseCell($phase, (int) $group->start_cell);
    }
}
