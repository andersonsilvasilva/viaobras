<?php

use App\Modules\Registry\Database\RegistrySchema as RS;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Itens da solicitação (7A): material do catálogo (descrição e unidade COPIADAS, D-08) ou digitado (D-P101), com
 * ligação opcional à atividade do planejamento (D-P102; "mesma obra" é regra da aplicação). A quantidade aprovada
 * pode ser menor que a pedida ou zero (D-P104). Só mudam em rascunho (regra da aplicação).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_request_items', function (Blueprint $table) {
            RS::base($table);
            $table->unsignedBigInteger('request_id');
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->unsignedBigInteger('task_id')->nullable();
            $table->string('description', 500);
            $table->string('unit_code', 20);
            $table->decimal('quantity', 15, 4);
            $table->decimal('approved_quantity', 15, 4)->nullable();
            $table->string('notes', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            RS::tenantKey($table, 'preqitem_tenant_id_unique');
            RS::ownerFk($table, 'request_id', 'purchase_requests', 'preqitem_request_fk');
            RS::ownerFk($table, 'resource_id', 'resources', 'preqitem_resource_fk');
            RS::ownerFk($table, 'task_id', 'schedule_tasks', 'preqitem_task_fk');
            $table->index(['tenant_id', 'request_id', 'sort_order'], 'preqitem_order_idx');
        });

        DB::statement('ALTER TABLE purchase_request_items ADD CONSTRAINT chk_preqitem_quantity CHECK (quantity > 0)');
        DB::statement('ALTER TABLE purchase_request_items ADD CONSTRAINT chk_preqitem_approved CHECK (approved_quantity IS NULL OR (approved_quantity >= 0 AND approved_quantity <= quantity))');
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_request_items');
    }
};
