<?php

use App\Modules\Registry\Database\RegistrySchema as RS;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Solicitações de materiais (Fase 7A, FASE7A_MODELO.md). Sempre de uma obra (a empresa é a da obra). Código
 * SOL-NNN/AAAA por tenant e ano (D-P100). Exclusão lógica SÓ do rascunho nunca enviado (regra da aplicação): o
 * código continua ocupado e nunca é reaproveitado. A situação só muda pelo PurchaseRequestWorkflow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_requests', function (Blueprint $table) {
            RS::base($table);
            $table->uuid('uuid')->unique();
            $table->string('code', 30);
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('requester_id');
            $table->string('priority', 10)->default('medium');
            $table->string('status', 20)->default('draft');
            $table->date('needed_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->date('fulfilled_on')->nullable();
            $table->timestamps();
            $table->softDeletes();

            RS::tenantKey($table, 'preq_tenant_id_unique');
            $table->unique(['tenant_id', 'code'], 'preq_code_unique');
            RS::ownerFk($table, 'project_id', 'projects', 'preq_project_fk');
            $table->foreign(['tenant_id', 'requester_id'], 'preq_requester_fk')
                ->references(['tenant_id', 'user_id'])->on('tenant_users')->restrictOnDelete()->restrictOnUpdate();
            $table->foreign(['tenant_id', 'decided_by'], 'preq_decider_fk')
                ->references(['tenant_id', 'user_id'])->on('tenant_users')->restrictOnDelete()->restrictOnUpdate();
            $table->index(['tenant_id', 'status'], 'preq_status_idx');
            $table->index(['tenant_id', 'project_id', 'status'], 'preq_project_idx');
        });

        DB::statement("ALTER TABLE purchase_requests ADD CONSTRAINT chk_preq_priority CHECK (priority IN ('low','medium','high','urgent'))");
        DB::statement("ALTER TABLE purchase_requests ADD CONSTRAINT chk_preq_status CHECK (status IN ('draft','pending','approved','rejected','received','canceled'))");
        // o que já foi enviado guarda a data do envio
        DB::statement("ALTER TABLE purchase_requests ADD CONSTRAINT chk_preq_submitted CHECK (status IN ('draft','canceled') OR submitted_at IS NOT NULL)");
        // rascunho e pendente não têm decisão; aprovada, recusada e atendida têm (cancelada pode ter, se foi aprovada)
        DB::statement("ALTER TABLE purchase_requests ADD CONSTRAINT chk_preq_decision CHECK (
            (status IN ('draft','pending') AND decided_by IS NULL AND decided_at IS NULL)
            OR (status IN ('approved','rejected','received') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
            OR status = 'canceled')");
        DB::statement("ALTER TABLE purchase_requests ADD CONSTRAINT chk_preq_fulfilled CHECK ((status = 'received') = (fulfilled_on IS NOT NULL))");
        DB::statement("ALTER TABLE purchase_requests ADD CONSTRAINT chk_preq_deleted CHECK (deleted_at IS NULL OR (status = 'draft' AND submitted_at IS NULL))");
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_requests');
    }
};
