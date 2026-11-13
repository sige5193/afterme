<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\EnterRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class EnterController extends Controller
{
    public function __invoke(EnterRequest $request): JsonResponse
    {
        $timezone = $request->input('timezone') ?: 'Asia/Shanghai';

        $user = User::query()->create([
            'timezone' => $timezone,
            'last_seen_at' => now(),
        ]);

        $token = $user->createToken('afterme', ['*'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->toApiArray(),
        ]);
    }
}
