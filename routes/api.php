<?php

use App\Http\Controllers\Api\DreamController;
use App\Http\Controllers\Api\EnterController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OfferingController;
use App\Http\Controllers\Api\PulseController;
use App\Http\Controllers\Api\ResurrectController;
use App\Http\Controllers\Api\TombController;
use Illuminate\Support\Facades\Route;

Route::post('/enter', EnterController::class);
Route::post('/resurrect', ResurrectController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::post('/me/resurrect-code', [MeController::class, 'regenerateResurrectCode']);

    Route::get('/tombs', [TombController::class, 'index']);
    Route::get('/tombs/{code}', [TombController::class, 'show']);
    Route::post('/me/tomb', [TombController::class, 'store']);
    Route::patch('/me/tomb/epitaph', [TombController::class, 'updateEpitaph']);
    Route::post('/me/tomb/zhashi', [TombController::class, 'zhashi']);
    Route::post('/me/tomb/knock', [TombController::class, 'knock']);

    Route::post('/tombs/{code}/offerings', [OfferingController::class, 'store']);
    Route::get('/me/inbox', [OfferingController::class, 'inbox']);
    Route::post('/offerings/{id}/dream', [OfferingController::class, 'storeDream']);

    Route::get('/me/dreams', [DreamController::class, 'index']);
    Route::post('/dreams/{id}/read', [DreamController::class, 'read']);

    Route::post('/pulse', PulseController::class);
});
