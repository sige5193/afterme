<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offering_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offering_id')->constrained()->cascadeOnDelete();
            $table->string('item_key', 16);
            $table->unsignedTinyInteger('qty');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offering_items');
    }
};
