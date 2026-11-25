<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migration de AJUSTE: `document_links` passa a aceitar `purchase_request` (anexos e fotos da solicitação, D-P110).
 * O down() volta ao CHECK anterior e falha, de propósito, se já houver vínculos com solicitação.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE document_links DROP CHECK chk_doclink_type');
        DB::statement("ALTER TABLE document_links ADD CONSTRAINT chk_doclink_type CHECK (linkable_type IN ('company','company_branch','customer','supplier','employee','equipment','project','contract','contract_addendum','purchase_request'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE document_links DROP CHECK chk_doclink_type');
        DB::statement("ALTER TABLE document_links ADD CONSTRAINT chk_doclink_type CHECK (linkable_type IN ('company','company_branch','customer','supplier','employee','equipment','project','contract','contract_addendum'))");
    }
};
