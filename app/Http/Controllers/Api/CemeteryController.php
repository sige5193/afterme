<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\Offering;
use App\Models\PlotCell;
use App\Models\Tomb;
use App\Models\User;
use App\Support\TombAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CemeteryController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tomb = $user->tomb()->with(['plotCell.phase.zone', 'group.phase.zone', 'group.activeMembers.tomb', 'pastGroupMemberships'])->first();

        if (! $tomb) {
            return response()->json([
                'mine' => [],
                'burned_me' => [],
                'i_burned' => [],
                'neighbors' => [],
            ]);
        }

        $mine = [];
        if ($tomb->group_id && $tomb->group) {
            $mine[] = $this->groupCard($tomb->group);
        } else {
            $mine[] = $this->tombCard($tomb);
        }

        $burnedMe = Offering::query()
            ->with('user.tomb')
            ->where('tomb_id', $tomb->id)
            ->where('user_id', '!=', $user->id)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('user_id')
            ->take(30)
            ->map(function ($rows) {
                $first = $rows->first();
                $burnerTomb = $first->user?->tomb;
                if (! $burnerTomb) {
                    return null;
                }
                $card = $this->tombCard($burnerTomb);
                $card['burn_count'] = $rows->count();

                return $card;
            })
            ->filter()
            ->values()
            ->all();

        $iBurned = Offering::query()
            ->with(['tomb.plotCell.phase.zone', 'tomb.group', 'group.phase.zone'])
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get()
            ->unique(fn (Offering $o) => $o->tomb_id ? 't'.$o->tomb_id : 'g'.$o->group_id)
            ->take(30)
            ->map(function (Offering $o) {
                if ($o->group_id && $o->group) {
                    return $this->groupCard($o->group);
                }
                if ($o->tomb) {
                    return $this->tombCard($o->tomb);
                }

                return null;
            })
            ->filter()
            ->values()
            ->all();

        $neighbors = $this->neighbors($tomb);

        return response()->json([
            'mine' => $mine,
            'burned_me' => $burnedMe,
            'i_burned' => $iBurned,
            'neighbors' => $neighbors,
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json(['results' => []]);
        }

        if (preg_match('/^[a-z0-9]{6}$/', $q)) {
            $tomb = Tomb::query()->with(['plotCell.phase.zone', 'group.phase.zone'])->where('code', $q)->first();
            if ($tomb) {
                if ($tomb->group_id && $tomb->group) {
                    return response()->json(['results' => [$this->groupCard($tomb->group)], 'redirect' => '/g/'.$tomb->group->code]);
                }

                return response()->json(['results' => [$this->tombCard($tomb)], 'redirect' => '/t/'.$tomb->code]);
            }

            $group = Group::query()->with('phase.zone')->where('code', $q)->first();
            if ($group) {
                return response()->json(['results' => [$this->groupCard($group)], 'redirect' => '/g/'.$group->code]);
            }
        }

        $tombs = Tomb::query()
            ->with(['plotCell.phase.zone', 'group.phase.zone'])
            ->where('name', 'like', '%'.$q.'%')
            ->limit(50)
            ->get()
            ->map(function (Tomb $tomb) {
                if ($tomb->group_id && $tomb->group) {
                    return $this->groupCard($tomb->group);
                }

                return $this->tombCard($tomb);
            });

        $groups = Group::query()
            ->with('phase.zone')
            ->whereNull('disbanded_at')
            ->where('name', 'like', '%'.$q.'%')
            ->limit(50)
            ->get()
            ->map(fn (Group $g) => $this->groupCard($g));

        $results = $tombs->concat($groups)->unique(fn ($c) => $c['kind'].':'.$c['code'])->take(50)->values();

        return response()->json(['results' => $results]);
    }

    private function tombCard(Tomb $tomb): array
    {
        $location = $tomb->locationPayload();

        return [
            'kind' => 'tomb',
            'code' => $tomb->code,
            'name' => $tomb->name,
            'address' => $location['address'],
            'style' => $tomb->style,
            'portrait' => $tomb->portrait,
            'cause' => $tomb->cause,
            'relation_text' => null,
        ];
    }

    private function groupCard(Group $group): array
    {
        $group->loadMissing(['phase.zone', 'activeMembers']);

        return [
            'kind' => 'group',
            'code' => $group->code,
            'name' => $group->name,
            'address' => TombAddress::forGroup($group),
            'style' => 'hanbai',
            'portrait' => null,
            'cause' => $group->relationLabel(),
            'relation_text' => $group->relationLabel(),
            'member_count' => $group->activeMembers->count(),
            'width' => $group->width,
        ];
    }

    private function neighbors(Tomb $tomb): array
    {
        if ($tomb->group_id && $tomb->group) {
            $phaseId = $tomb->group->zone_phase_id;
            $start = (int) $tomb->group->start_cell;
            $width = (int) $tomb->group->width;
            $cols = (int) config('afterme.grid_cols', 6);
            $candidates = [];
            for ($i = 0; $i < $width; $i++) {
                $cell = $start + $i;
                $candidates[] = $cell - $cols;
                $candidates[] = $cell + $cols;
            }
            $candidates[] = $start - 1;
            $candidates[] = $start + $width;
            $candidates = array_values(array_unique(array_filter($candidates, fn ($c) => $c >= 0 && $c < 60)));

            return $this->cardsForCells($phaseId, $candidates, $tomb->group_id);
        }

        $cell = $tomb->plotCell;
        if (! $cell) {
            return [];
        }

        $cols = (int) config('afterme.grid_cols', 6);
        $c = (int) $cell->cell;
        $candidates = array_filter([
            $c - $cols,
            $c + $cols,
            ($c % $cols > 0) ? $c - 1 : null,
            ($c % $cols < $cols - 1) ? $c + 1 : null,
        ], fn ($v) => $v !== null && $v >= 0 && $v < 60);

        return $this->cardsForCells((int) $cell->zone_phase_id, $candidates, null, $tomb->id);
    }

    /**
     * @param  list<int>  $cells
     */
    private function cardsForCells(int $phaseId, array $cells, ?int $ignoreGroupId = null, ?int $ignoreTombId = null): array
    {
        $plots = PlotCell::query()
            ->with(['tomb.plotCell.phase.zone', 'group.phase.zone', 'group.activeMembers'])
            ->where('zone_phase_id', $phaseId)
            ->whereIn('cell', $cells)
            ->get();

        $cards = [];
        $seenGroups = [];
        foreach ($plots as $plot) {
            if ($plot->tomb_id && $plot->tomb && (int) $plot->tomb_id !== (int) $ignoreTombId) {
                $cards[] = $this->tombCard($plot->tomb);
            } elseif ($plot->group_id && $plot->group && (int) $plot->group_id !== (int) $ignoreGroupId) {
                if (isset($seenGroups[$plot->group_id])) {
                    continue;
                }
                $seenGroups[$plot->group_id] = true;
                $cards[] = $this->groupCard($plot->group);
            }
        }

        return array_values($cards);
    }
}
