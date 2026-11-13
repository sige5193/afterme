<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tombs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->boolean('is_npc')->default(false);
            $table->string('npc_key', 32)->nullable()->unique();
            $table->string('code', 16)->unique();
            $table->string('name', 8);
            $table->smallInteger('birth_year');
            $table->string('cause', 12);
            $table->unsignedTinyInteger('portrait');
            $table->string('last_words', 40)->nullable();
            $table->enum('style', ['qingshi', 'hanbai', 'neon', 'tubao', 'mupai']);
            $table->unsignedInteger('plot')->unique();
            $table->string('epitaph', 40);
            $table->integer('epitaph_edits')->default(0);
            $table->text('eulogy');
            $table->string('verdict', 16);
            $table->unsignedTinyInteger('couplet');
            $table->integer('zhashi_count')->default(0);
            $table->dateTime('zhashi_until')->nullable();
            $table->integer('knock_count')->default(0);
            $table->dateTime('last_knock_at')->nullable();
            $table->integer('funerals')->default(1);
            $table->dateTime('died_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tombs');
    }
};
