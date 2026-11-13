<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dreams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offering_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('tomb_id')->constrained()->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('text', 120);
            $table->enum('style', ['plain', 'warm', 'scary', 'mystic']);
            $table->dateTime('visible_at');
            $table->dateTime('read_at')->nullable();
            $table->dateTime('created_at');

            $table->index(['to_user_id', 'visible_at']);
            $table->index(['tomb_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dreams');
    }
};
