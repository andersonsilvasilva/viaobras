<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Caixa postal de envio da PLATAFORMA (EMAIL_CONFIG_MODELO.md): sem tenant_id, uma única linha (`singleton`). A senha
 * é gravada cifrada com a chave da aplicação. Sem linha ou inativa, vale a configuração do servidor (.env, D-P116).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_mail_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('singleton')->default(1)->unique('pms_singleton_unique');
            $table->string('host', 190);
            $table->unsignedSmallInteger('port');
            $table->string('encryption', 3);
            $table->string('username', 190);
            $table->text('password');
            $table->string('from_address', 190);
            $table->string('from_name', 100);
            $table->boolean('active')->default(true);
            $table->timestamp('last_tested_at')->nullable();
            $table->unsignedBigInteger('updated_by');
            $table->timestamps();

            $table->foreign('updated_by', 'pms_user_fk')->references('id')->on('users')->restrictOnDelete()->restrictOnUpdate();
        });

        DB::statement('ALTER TABLE platform_mail_settings ADD CONSTRAINT chk_pms_singleton CHECK (singleton = 1)');
        // D-P117: só as portas de envio, cada uma com a sua criptografia obrigatória
        DB::statement("ALTER TABLE platform_mail_settings ADD CONSTRAINT chk_pms_port CHECK ((port = 465 AND encryption = 'ssl') OR (port = 587 AND encryption = 'tls'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_mail_settings');
    }
};
