<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\PlotCell;
use App\Models\Tomb;
use App\Models\ZonePhase;
use App\Support\TombAddress;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class PhaseController extends Controller
{
    public function grid(int $id): JsonResponse
    {
        $phase = ZonePhase::query()->with('zone')->find($id);
        if (! $phase) {
            return response()->json(['message' => '阴间服务器开小差了…'], 404);
        }

        $specials = config('afterme.special_cells', []);
        $capacity = (int) $phase->capacity;

        $cells = PlotCell::query()
            ->with([
                'tomb.user:id,last_seen_at',
                'group.activeMembers.tomb',
                'group.founder',
            ])
            ->where('zone_phase_id', $phase->id)
            ->get()
            ->keyBy('cell');

        $groupsSeen = [];
        $grid = [];

        for ($cell = 0; $cell < $capacity; $cell++) {
            $row = [
                'cell' => $cell,
                'type' => 'empty',
            ];

            if (! $phase->zone?->is_group_zone && isset($specials[$cell])) {
                $row['special'] = $specials[$cell];
            }

            $plot = $cells->get($cell);
            if (! $plot) {
                $grid[] = $row;

                continue;
            }

            if ($plot->tomb_id && $plot->tomb) {
                $row['type'] = 'tomb';
                $row['tomb'] = $plot->tomb->toListArray();
                $grid[] = $row;

                continue;
            }

            if ($plot->group_id && $plot->group) {
                if (isset($groupsSeen[$plot->group_id])) {
                    continue;
                }
                $groupsSeen[$plot->group_id] = true;
                $group = $plot->group;
                $row['type'] = 'group';
                $row['cell'] = $group->start_cell;
                $row['group'] = [
                    'code' => $group->code,
                    'name' => $group->name,
                    'relation' => $group->relation,
                    'relation_label' => $group->relationLabel(),
                    'width' => $group->width,
                    'start_cell' => $group->start_cell,
                    'member_count' => $group->activeMembers->count(),
                    'members' => $group->activeMembers->map(fn ($m) => [
                        'tomb_code' => $m->tomb?->code,
                        'name' => $m->tomb?->name,
                        'cause' => $m->tomb?->cause,
                        'portrait' => $m->tomb?->portrait,
                        'style' => $m->tomb?->style,
                        'is_founder' => (int) $group->founder_tomb_id === (int) $m->tomb_id,
                    ])->values()->all(),
                ];
                $grid[] = $row;

                continue;
            }

            $grid[] = $row;
        }

        $version = $this->phaseVersion($phase);

        return response()->json([
            'phase' => [
                'id' => $phase->id,
                'number' => $phase->number,
                'capacity' => $phase->capacity,
                'label' => TombAddress::phaseLabel($phase->number),
                'display_name' => TombAddress::zoneDisplayName($phase->zone, $phase->number),
            ],
            'zone' => [
                'key' => $phase->zone->key,
                'name' => $phase->zone->name,
                'tagline' => $phase->zone->tagline,
                'default_style' => $phase->zone->default_style,
                'is_group_zone' => (bool) $phase->zone->is_group_zone,
            ],
            'cells' => $grid,
            'version' => $version,
        ]);
    }

    private function phaseVersion(ZonePhase $phase): ?string
    {
        $cellMax = PlotCell::query()->where('zone_phase_id', $phase->id)->max('updated_at');
        $groupMax = Group::query()->where('zone_phase_id', $phase->id)->max('updated_at');
        $tombIds = PlotCell::query()->where('zone_phase_id', $phase->id)->whereNotNull('tomb_id')->pluck('tomb_id');
        $tombMax = $tombIds->isEmpty() ? null : Tomb::query()->whereIn('id', $tombIds)->max('updated_at');

        $times = array_filter([$cellMax, $groupMax, $tombMax, optional($phase->created_at)?->toDateTimeString()]);
        if ($times === []) {
            return null;
        }

        return Carbon::parse(max($times))->toIso8601String();
    }
}
