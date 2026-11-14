<?php

use App\Http\Controllers\Api\CemeteryController;
use App\Http\Controllers\Api\DreamController;
use App\Http\Controllers\Api\EnterController;
use App\Http\Controllers\Api\GroupController;
use App\Http\Controllers\Api\JoinRequestController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OfferingController;
use App\Http\Controllers\Api\PhaseController;
use App\Http\Controllers\Api\PulseController;
use App\Http\Controllers\Api\ResurrectController;
use App\Http\Controllers\Api\TombController;
use App\Http\Controllers\Api\ZoneController;
use Illuminate\Support\Facades\Route;

Route::post('/enter', EnterController::class);
Route::post('/resurrect', ResurrectController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::post('/me/resurrect-code', [MeController::class, 'regenerateResurrectCode']);
    Route::get('/me/cemetery', [CemeteryController::class, 'mine']);
    Route::get('/search', [CemeteryController::class, 'search']);

    Route::get('/zones', [ZoneController::class, 'index']);
    Route::get('/phases/{id}/grid', [PhaseController::class, 'grid']);

    Route::get('/tombs/{code}', [TombController::class, 'show']);
    Route::post('/me/tomb', [TombController::class, 'store']);
    Route::post('/me/tomb/move', [TombController::class, 'move']);
    Route::patch('/me/tomb/epitaph', [TombController::class, 'updateEpitaph']);
    Route::post('/me/tomb/zhashi', [TombController::class, 'zhashi']);
    Route::post('/me/tomb/knock', [TombController::class, 'knock']);

    Route::get('/groups/{code}', [GroupController::class, 'show']);
    Route::patch('/groups/{code}', [GroupController::class, 'update']);
    Route::patch('/groups/{code}/epitaph', [GroupController::class, 'updateEpitaph']);
    Route::post('/groups/{code}/move', [GroupController::class, 'move']);
    Route::post('/groups/{code}/remove', [GroupController::class, 'remove']);
    Route::post('/groups/{code}/offerings', [GroupController::class, 'storeOffering']);
    Route::post('/me/group/leave', [GroupController::class, 'leave']);

    Route::post('/tombs/{code}/join-requests', [JoinRequestController::class, 'invite']);
    Route::post('/groups/{code}/join-requests', [JoinRequestController::class, 'apply']);
    Route::get('/me/join-requests', [JoinRequestController::class, 'index']);
    Route::post('/join-requests/{id}/respond', [JoinRequestController::class, 'respond']);

    Route::post('/tombs/{code}/offerings', [OfferingController::class, 'store']);
    Route::get('/me/inbox', [OfferingController::class, 'inbox']);
    Route::post('/offerings/{id}/dream', [OfferingController::class, 'storeDream']);

    Route::get('/me/dreams', [DreamController::class, 'index']);
    Route::post('/dreams/{id}/read', [DreamController::class, 'read']);

    Route::post('/pulse', PulseController::class);
});
