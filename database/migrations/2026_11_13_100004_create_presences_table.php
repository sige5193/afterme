<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('presences', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->enum('mode', ['ghost', 'coffin', 'living']);
            $table->unsignedInteger('plot')->nullable();
            $table->unsignedBigInteger('viewing_tomb_id')->nullable();
            $table->dateTime('seen_at');

            $table->foreign('viewing_tomb_id')->references('id')->on('tombs')->nullOnDelete();
            $table->index(['mode', 'seen_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('presences');
    }
};
