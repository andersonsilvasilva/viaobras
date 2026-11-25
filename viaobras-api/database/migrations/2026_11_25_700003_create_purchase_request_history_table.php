<?php

use App\Modules\Registry\Database\RegistrySchema as RS;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Histórico de situação da solicitação — append-only (só o PurchaseRequestWorkflow cria). Começa no primeiro passo. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_request_history', function (Blueprint $table) {
            RS::base($table);
            $table->unsignedBigInteger('request_id');
            $table->string('action', 20);
            $table->string('from_status', 20);
            $table->string('to_status', 20);
            $table->unsignedBigInteger('changed_by');
            $table->string('reason', 1000)->nullable();
            $table->timestamp('changed_at', 6)->useCurrent();

            RS::tenantKey($table, 'preqh_tenant_id_unique');
            RS::ownerFk($table, 'request_id', 'purchase_requests', 'preqh_request_fk');
            $table->foreign(['tenant_id', 'changed_by'], 'preqh_changer_fk')
                ->references(['tenant_id', 'user_id'])->on('tenant_users')->restrictOnDelete()->restrictOnUpdate();
            $table->index(['tenant_id', 'request_id', 'changed_at'], 'preqh_request_idx');
        });

        $states = "'draft','pending','approved','rejected','received','canceled'";
        DB::statement("ALTER TABLE purchase_request_history ADD CONSTRAINT chk_preqh_to CHECK (to_status IN ({$states}))");
        DB::statement("ALTER TABLE purchase_request_history ADD CONSTRAINT chk_preqh_from CHECK (from_status IN ({$states}))");
        DB::statement("ALTER TABLE purchase_request_history ADD CONSTRAINT chk_preqh_action CHECK (action IN ('submit','approve','send_back','reject','revoke_approval','fulfill','revert_fulfillment','cancel'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_request_history');
    }
};
