<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'timezone' => 'Asia/Shanghai',
            'resurrect_code_hash' => null,
            'last_seen_at' => now(),
        ];
    }
}
