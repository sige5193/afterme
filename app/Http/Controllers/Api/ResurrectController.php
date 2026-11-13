<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ResurrectRequest;
use App\Models\User;
use App\Support\ResurrectCode;
use Illuminate\Http\JsonResponse;

class ResurrectController extends Controller
{
    public function __invoke(ResurrectRequest $request): JsonResponse
    {
        $hash = ResurrectCode::hashFromInput($request->string('code')->toString());

        $user = User::query()->where('resurrect_code_hash', $hash)->first();

        if (! $user) {
            return response()->json(['message' => '这串还魂码对不上'], 404);
        }

        $timezone = $request->input('timezone');
        $user->touchSeen(is_string($timezone) ? $timezone : null);

        $user->tokens()->delete();
        $token = $user->createToken('afterme', ['*'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->fresh()->toApiArray(),
        ]);
    }
}
