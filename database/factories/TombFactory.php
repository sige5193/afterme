<?php

namespace Database\Factories;

use App\Models\Tomb;
use App\Models\User;
use App\Support\TombCode;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tomb>
 */
class TombFactory extends Factory
{
    protected $model = Tomb::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'is_npc' => false,
            'npc_key' => null,
            'code' => TombCode::generate(),
            'name' => fake()->lexify('????'),
            'birth_year' => fake()->numberBetween(1970, 2010),
            'cause' => '过劳',
            'portrait' => fake()->numberBetween(0, 5),
            'last_words' => '再见',
            'style' => 'qingshi',
            'home_zone_id' => null,
            'group_id' => null,
            'move_count' => 0,
            'epitaph' => '躺平了',
            'epitaph_edits' => 0,
            'eulogy' => '安息',
            'verdict' => '此人尚可',
            'couplet' => 0,
            'zhashi_count' => 0,
            'zhashi_until' => null,
            'knock_count' => 0,
            'last_knock_at' => null,
            'funerals' => 1,
            'died_at' => now(),
        ];
    }
}
