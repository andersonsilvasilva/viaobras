<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Mensagens padrão ALTERADAS pela plataforma (D-P118). Sem linha, vale o texto padrão do sistema. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_mail_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key', 40)->unique('pmt_key_unique');
            $table->string('subject', 150);
            $table->text('body');
            $table->unsignedBigInteger('updated_by');
            $table->timestamps();

            $table->foreign('updated_by', 'pmt_user_fk')->references('id')->on('users')->restrictOnDelete()->restrictOnUpdate();
        });

        DB::statement("ALTER TABLE platform_mail_templates ADD CONSTRAINT chk_pmt_key CHECK (`key` IN ('invitation','password_reset'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_mail_templates');
    }
};
