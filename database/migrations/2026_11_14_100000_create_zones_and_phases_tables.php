<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            $table->string('key', 16)->unique();
            $table->string('name', 16);
            $table->string('tagline', 32);
            $table->string('default_style', 16)->nullable();
            $table->boolean('is_group_zone')->default(false);
            $table->unsignedTinyInteger('sort')->default(0);
        });

        Schema::create('zone_phases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained('zones')->cascadeOnDelete();
            $table->unsignedSmallInteger('number');
            $table->unsignedTinyInteger('capacity')->default(60);
            $table->dateTime('created_at');

            $table->unique(['zone_id', 'number']);
        });

        Schema::create('plot_cells', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_phase_id')->constrained('zone_phases')->cascadeOnDelete();
            $table->unsignedTinyInteger('cell');
            $table->foreignId('tomb_id')->nullable()->constrained('tombs')->cascadeOnDelete();
            $table->unsignedBigInteger('group_id')->nullable();
            $table->timestamps();

            $table->unique(['zone_phase_id', 'cell']);
            $table->index('tomb_id');
            $table->index('group_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plot_cells');
        Schema::dropIfExists('zone_phases');
        Schema::dropIfExists('zones');
    }
};
