<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('groups', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->string('name', 12);
            $table->enum('relation', [
                'lover',
                'bestie',
                'roommate',
                'family',
                'colleague',
                'rival',
                'foodie',
            ]);
            $table->foreignId('founder_tomb_id')->constrained('tombs')->cascadeOnDelete();
            $table->foreignId('zone_phase_id')->constrained('zone_phases')->cascadeOnDelete();
            $table->unsignedTinyInteger('start_cell');
            $table->unsignedTinyInteger('width');
            $table->string('epitaph', 40)->nullable();
            $table->integer('epitaph_edits')->default(0);
            $table->dateTime('disbanded_at')->nullable();
            $table->timestamps();
        });

        Schema::table('plot_cells', function (Blueprint $table) {
            $table->foreign('group_id')->references('id')->on('groups')->cascadeOnDelete();
        });

        Schema::create('group_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->foreignId('tomb_id')->constrained('tombs')->cascadeOnDelete();
            $table->dateTime('joined_at');
            $table->dateTime('left_at')->nullable();
            $table->enum('left_reason', ['left', 'removed', 'disbanded'])->nullable();
            $table->string('group_name_snapshot', 12)->nullable();

            $table->index(['group_id', 'left_at']);
            $table->index(['tomb_id', 'left_at']);
        });

        Schema::create('join_requests', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['invite', 'apply']);
            $table->foreignId('from_tomb_id')->constrained('tombs')->cascadeOnDelete();
            $table->foreignId('to_tomb_id')->nullable()->constrained('tombs')->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained('groups')->nullOnDelete();
            $table->enum('relation', [
                'lover',
                'bestie',
                'roommate',
                'family',
                'colleague',
                'rival',
                'foodie',
            ])->nullable();
            $table->string('group_name', 12)->nullable();
            $table->string('message', 120)->nullable();
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired'])->default('pending');
            $table->string('reply_text', 120)->nullable();
            $table->enum('reply_style', ['plain', 'warm', 'scary', 'mystic'])->nullable();
            $table->foreignId('responder_tomb_id')->nullable()->constrained('tombs')->nullOnDelete();
            $table->dateTime('responded_at')->nullable();
            $table->dateTime('expires_at');
            $table->dateTime('created_at');

            $table->index(['status', 'expires_at']);
            $table->index(['to_tomb_id', 'status']);
            $table->index(['group_id', 'status']);
            $table->index(['from_tomb_id', 'status']);
        });

        Schema::create('join_blocks', function (Blueprint $table) {
            $table->foreignId('blocker_tomb_id')->constrained('tombs')->cascadeOnDelete();
            $table->foreignId('blocked_tomb_id')->constrained('tombs')->cascadeOnDelete();
            $table->dateTime('created_at');

            $table->primary(['blocker_tomb_id', 'blocked_tomb_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('join_blocks');
        Schema::dropIfExists('join_requests');
        Schema::dropIfExists('group_members');

        Schema::table('plot_cells', function (Blueprint $table) {
            $table->dropForeign(['group_id']);
        });

        Schema::dropIfExists('groups');
    }
};
