<?php

namespace App\Support;

use App\Models\PlotCell;
use App\Models\Tomb;
use App\Models\Zone;
use App\Models\ZonePhase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class PlotAllocator
{
    public static function conflictResponse(): HttpResponseException
    {
        return new HttpResponseException(
            response()->json(['message' => '这块刚被人占了'], 409)
        );
    }

    public static function occupy(Tomb $tomb, ZonePhase $phase, int $cell): PlotCell
    {
        return DB::transaction(function () use ($tomb, $phase, $cell) {
            $capacity = (int) $phase->capacity;
            if ($cell < 0 || $cell >= $capacity) {
                throw self::conflictResponse();
            }

            ZonePhase::query()->whereKey($phase->id)->lockForUpdate()->firstOrFail();

            $existing = PlotCell::query()
                ->where('zone_phase_id', $phase->id)
                ->where('cell', $cell)
                ->lockForUpdate()
                ->first();

            if ($existing && (int) $existing->tomb_id !== (int) $tomb->id) {
                throw self::conflictResponse();
            }

            self::releaseTomb($tomb);

            if ($existing) {
                $existing->tomb_id = $tomb->id;
                $existing->group_id = null;
                $existing->save();

                return $existing->fresh(['phase.zone']);
            }

            return PlotCell::query()->create([
                'zone_phase_id' => $phase->id,
                'cell' => $cell,
                'tomb_id' => $tomb->id,
                'group_id' => null,
            ])->load(['phase.zone']);
        });
    }

    public static function releaseTomb(Tomb $tomb): void
    {
        PlotCell::query()->where('tomb_id', $tomb->id)->delete();
    }

    /**
     * @return array{phase: ZonePhase, cell: int, opened: bool}
     */
    public static function findEarliestEmpty(Zone $zone): array
    {
        $capacity = (int) config('afterme.phase_capacity', 60);
        $opened = false;

        $phases = ZonePhase::query()
            ->where('zone_id', $zone->id)
            ->orderBy('number')
            ->lockForUpdate()
            ->get();

        if ($phases->isEmpty()) {
            $phase = PhaseOpener::openNext($zone)['phase'];
            $opened = true;

            return ['phase' => $phase, 'cell' => 0, 'opened' => $opened];
        }

        foreach ($phases as $phase) {
            $used = PlotCell::query()
                ->where('zone_phase_id', $phase->id)
                ->pluck('cell')
                ->all();
            $usedSet = array_fill_keys($used, true);

            for ($cell = 0; $cell < $capacity; $cell++) {
                if (! isset($usedSet[$cell])) {
                    return ['phase' => $phase, 'cell' => $cell, 'opened' => $opened];
                }
            }
        }

        $phase = PhaseOpener::openNext($zone)['phase'];

        return ['phase' => $phase, 'cell' => 0, 'opened' => true];
    }

    /**
     * Place tomb back into home zone earliest empty cell.
     *
     * @return array{phase: ZonePhase, cell: int, address: string, opened: bool}
     */
    public static function placeInHomeZone(Tomb $tomb): array
    {
        return DB::transaction(function () use ($tomb) {
            $zone = Zone::query()->whereKey($tomb->home_zone_id)->lockForUpdate()->first();
            if (! $zone) {
                $zone = Zone::query()->where('key', 'public')->lockForUpdate()->firstOrFail();
                $tomb->home_zone_id = $zone->id;
                $tomb->save();
            }

            $spot = self::findEarliestEmpty($zone);
            $cell = self::occupy($tomb, $spot['phase'], $spot['cell']);

            return [
                'phase' => $spot['phase']->load('zone'),
                'cell' => $spot['cell'],
                'address' => TombAddress::forCell($cell),
                'opened' => $spot['opened'],
            ];
        });
    }

    public static function moveTomb(Tomb $tomb, ZonePhase $phase, int $cell): PlotCell
    {
        $phase->loadMissing('zone');

        if ($phase->zone?->is_group_zone) {
            throw new HttpResponseException(
                response()->json(['message' => '合葬区不能单独迁坟'], 422)
            );
        }

        return DB::transaction(function () use ($tomb, $phase, $cell) {
            $plotCell = self::occupy($tomb, $phase, $cell);
            $tomb->home_zone_id = $phase->zone_id;
            $tomb->move_count = $tomb->move_count + 1;
            $tomb->save();

            return $plotCell;
        });
    }

    public static function phaseHasEmpty(ZonePhase $phase): bool
    {
        $used = PlotCell::query()->where('zone_phase_id', $phase->id)->count();

        return $used < (int) $phase->capacity;
    }
}
