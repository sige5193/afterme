<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tombs', function (Blueprint $table) {
            $table->foreignId('home_zone_id')->nullable()->after('plot')->constrained('zones')->nullOnDelete();
            $table->foreignId('group_id')->nullable()->after('home_zone_id')->constrained('groups')->nullOnDelete();
            $table->integer('move_count')->default(0)->after('group_id');
        });

        Schema::table('offerings', function (Blueprint $table) {
            $table->foreignId('group_id')->nullable()->after('tomb_id')->constrained('groups')->cascadeOnDelete();
        });

        Schema::table('offerings', function (Blueprint $table) {
            $table->dropForeign(['tomb_id']);
        });

        $this->makeNullable('offerings', 'tomb_id');

        Schema::table('offerings', function (Blueprint $table) {
            $table->foreign('tomb_id')->references('id')->on('tombs')->cascadeOnDelete();
            $table->index(['group_id', 'created_at']);
        });

        Schema::table('dreams', function (Blueprint $table) {
            $table->dropForeign(['offering_id']);
            $table->dropUnique(['offering_id']);
        });

        $this->makeNullable('dreams', 'offering_id');

        Schema::table('dreams', function (Blueprint $table) {
            $table->enum('kind', ['reply', 'join_result', 'system'])->default('reply')->after('offering_id');
            $table->foreignId('join_request_id')->nullable()->after('kind')->constrained('join_requests')->nullOnDelete();
            $table->foreign('offering_id')->references('id')->on('offerings')->cascadeOnDelete();
            $table->unique(['offering_id', 'tomb_id']);
        });

        Schema::table('dreams', function (Blueprint $table) {
            $table->dropForeign(['tomb_id']);
        });

        $this->makeNullable('dreams', 'tomb_id');

        Schema::table('dreams', function (Blueprint $table) {
            $table->foreign('tomb_id')->references('id')->on('tombs')->cascadeOnDelete();
        });

        Schema::table('presences', function (Blueprint $table) {
            $table->foreignId('zone_phase_id')->nullable()->after('mode')->constrained('zone_phases')->nullOnDelete();
        });

        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('presences', function (Blueprint $table) {
                $table->renameColumn('plot', 'cell');
            });
        } else {
            DB::statement('ALTER TABLE presences CHANGE plot cell TINYINT UNSIGNED NULL');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('presences', function (Blueprint $table) {
                $table->renameColumn('cell', 'plot');
            });
        } else {
            DB::statement('ALTER TABLE presences CHANGE cell plot INT UNSIGNED NULL');
        }

        Schema::table('presences', function (Blueprint $table) {
            $table->dropConstrainedForeignId('zone_phase_id');
        });

        Schema::table('dreams', function (Blueprint $table) {
            $table->dropUnique(['offering_id', 'tomb_id']);
            $table->dropConstrainedForeignId('join_request_id');
            $table->dropColumn('kind');
            $table->dropForeign(['offering_id']);
            $table->dropForeign(['tomb_id']);
        });

        $this->makeNotNullable('dreams', 'offering_id');
        $this->makeNotNullable('dreams', 'tomb_id');

        Schema::table('dreams', function (Blueprint $table) {
            $table->foreign('offering_id')->references('id')->on('offerings')->cascadeOnDelete();
            $table->foreign('tomb_id')->references('id')->on('tombs')->cascadeOnDelete();
            $table->unique('offering_id');
        });

        Schema::table('offerings', function (Blueprint $table) {
            $table->dropIndex(['group_id', 'created_at']);
            $table->dropConstrainedForeignId('group_id');
            $table->dropForeign(['tomb_id']);
        });

        $this->makeNotNullable('offerings', 'tomb_id');

        Schema::table('offerings', function (Blueprint $table) {
            $table->foreign('tomb_id')->references('id')->on('tombs')->cascadeOnDelete();
        });

        Schema::table('tombs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('group_id');
            $table->dropConstrainedForeignId('home_zone_id');
            $table->dropColumn('move_count');
        });
    }

    private function makeNullable(string $table, string $column): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            // SQLite: recreate handled poorly; use doctrine-free approach via table rebuild not needed
            // Laravel schema change for sqlite nullable.
            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->unsignedBigInteger($column)->nullable()->change();
            });

            return;
        }

        DB::statement("ALTER TABLE {$table} MODIFY {$column} BIGINT UNSIGNED NULL");
    }

    private function makeNotNullable(string $table, string $column): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->unsignedBigInteger($column)->nullable(false)->change();
            });

            return;
        }

        DB::statement("ALTER TABLE {$table} MODIFY {$column} BIGINT UNSIGNED NOT NULL");
    }
};
