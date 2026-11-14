<?php

namespace App\Support;

use App\Models\Group;
use App\Models\PlotCell;
use App\Models\Zone;
use App\Models\ZonePhase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class GroupBlockAllocator
{
    public static function widthForMemberCount(int $count): int
    {
        if ($count <= 2) {
            return 2;
        }

        if ($count <= 4) {
            return 4;
        }

        return 6;
    }

    /**
     * @return list<int>
     */
    public static function allowedStarts(int $width): array
    {
        return match ($width) {
            2 => [0, 2, 4],
            4 => [0, 2],
            6 => [0],
            default => [0],
        };
    }

    /**
     * Find and occupy a block for the group. Releases previous cells.
     *
     * @return array{phase: ZonePhase, start_cell: int, width: int, opened: bool}
     */
    public static function allocate(Group $group, int $memberCount, ?ZonePhase $preferredPhase = null, ?int $preferredStart = null): array
    {
        $width = self::widthForMemberCount($memberCount);

        return DB::transaction(function () use ($group, $width, $preferredPhase, $preferredStart) {
            $zone = Zone::query()->where('key', 'group')->lockForUpdate()->firstOrFail();

            if ($preferredPhase && $preferredStart !== null) {
                $phase = ZonePhase::query()->whereKey($preferredPhase->id)->lockForUpdate()->firstOrFail();
                if ((int) $phase->zone_id !== (int) $zone->id) {
                    throw new HttpResponseException(response()->json(['message' => '只能迁到合葬区'], 422));
                }

                if (! self::fits($phase->id, $preferredStart, $width, $group->id)) {
                    throw PlotAllocator::conflictResponse();
                }

                self::placeGroup($group, $phase, $preferredStart, $width);

                return [
                    'phase' => $phase->load('zone'),
                    'start_cell' => $preferredStart,
                    'width' => $width,
                    'opened' => false,
                ];
            }

            $phases = ZonePhase::query()
                ->where('zone_id', $zone->id)
                ->orderBy('number')
                ->lockForUpdate()
                ->get();

            $opened = false;

            if ($phases->isEmpty()) {
                $phases = collect([PhaseOpener::openNext($zone)['phase']]);
                $opened = true;
            }

            foreach ($phases as $phase) {
                $spot = self::findSpot($phase->id, $width, $group->id);
                if ($spot !== null) {
                    self::placeGroup($group, $phase, $spot, $width);

                    return [
                        'phase' => $phase->load('zone'),
                        'start_cell' => $spot,
                        'width' => $width,
                        'opened' => $opened,
                    ];
                }
            }

            $phase = PhaseOpener::openNext($zone)['phase'];
            self::placeGroup($group, $phase, 0, $width);

            return [
                'phase' => $phase->load('zone'),
                'start_cell' => 0,
                'width' => $width,
                'opened' => true,
            ];
        });
    }

    public static function release(Group $group): void
    {
        PlotCell::query()->where('group_id', $group->id)->delete();
    }

    public static function expandIfNeeded(Group $group, int $memberCount): array
    {
        $needed = self::widthForMemberCount($memberCount);
        if ((int) $group->width >= $needed) {
            return [
                'phase' => $group->phase()->with('zone')->first(),
                'start_cell' => $group->start_cell,
                'width' => $group->width,
                'opened' => false,
                'moved' => false,
            ];
        }

        $result = self::allocate($group, $memberCount);
        $result['moved'] = true;

        return $result;
    }

    private static function findSpot(int $phaseId, int $width, ?int $ignoreGroupId): ?int
    {
        $cols = (int) config('afterme.grid_cols', 6);
        $capacity = (int) config('afterme.phase_capacity', 60);
        $rows = intdiv($capacity, $cols);
        $starts = self::allowedStarts($width);

        for ($row = 0; $row < $rows; $row++) {
            foreach ($starts as $startCol) {
                $start = $row * $cols + $startCol;
                if (self::fits($phaseId, $start, $width, $ignoreGroupId)) {
                    return $start;
                }
            }
        }

        return null;
    }

    private static function fits(int $phaseId, int $start, int $width, ?int $ignoreGroupId): bool
    {
        $cols = (int) config('afterme.grid_cols', 6);
        $capacity = (int) config('afterme.phase_capacity', 60);

        if ($start < 0 || $start + $width > $capacity) {
            return false;
        }

        if (intdiv($start, $cols) !== intdiv($start + $width - 1, $cols)) {
            return false;
        }

        if (($start % $cols) % 2 !== 0) {
            return false;
        }

        if (! in_array($start % $cols, self::allowedStarts($width), true)) {
            return false;
        }

        for ($i = 0; $i < $width; $i++) {
            $cell = $start + $i;
            $existing = PlotCell::query()
                ->where('zone_phase_id', $phaseId)
                ->where('cell', $cell)
                ->lockForUpdate()
                ->first();

            if (! $existing) {
                continue;
            }

            if ($ignoreGroupId && (int) $existing->group_id === (int) $ignoreGroupId) {
                continue;
            }

            return false;
        }

        return true;
    }

    private static function placeGroup(Group $group, ZonePhase $phase, int $start, int $width): void
    {
        PlotCell::query()
            ->where('group_id', $group->id)
            ->delete();

        for ($i = 0; $i < $width; $i++) {
            PlotCell::query()->create([
                'zone_phase_id' => $phase->id,
                'cell' => $start + $i,
                'tomb_id' => null,
                'group_id' => $group->id,
            ]);
        }

        $group->zone_phase_id = $phase->id;
        $group->start_cell = $start;
        $group->width = $width;
        $group->save();
    }
}
