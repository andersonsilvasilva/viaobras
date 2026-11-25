<?php

namespace App\Models;

use App\Modules\Registry\Concerns\HasPublicUuid;
use App\Modules\Supplies\Services\LocalDay;
use App\Modules\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Solicitação de materiais (Fase 7A, FASE7A_MODELO.md). Pertence SEMPRE a uma obra. Situação, datas de envio, decisão
 * e atendimento são gravadas pelo PurchaseRequestWorkflow (não preenchíveis). Exclusão (lógica) só do rascunho nunca
 * enviado, pelo PurchaseRequestService.
 */
class PurchaseRequest extends Model
{
    use BelongsToTenant, HasPublicUuid, SoftDeletes;

    public const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

    public const STATUSES = ['draft', 'pending', 'approved', 'rejected', 'received', 'canceled'];

    /** Situações em que a data "necessário até" ainda conta (D-P108). */
    public const OPEN_STATUSES = ['pending', 'approved'];

    protected $fillable = ['code', 'project_id', 'priority', 'needed_by', 'notes'];

    protected $attributes = ['status' => 'draft', 'priority' => 'medium'];

    protected function casts(): array
    {
        return [
            'needed_by' => 'date', 'fulfilled_on' => 'date', 'submitted_at' => 'datetime', 'decided_at' => 'datetime',
        ];
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    /** Atrasada = "necessário até" já passou e ainda não foi atendida (calculado, D-P108). */
    public function isLate(): bool
    {
        return $this->needed_by !== null && in_array($this->status, self::OPEN_STATUSES, true)
            && $this->needed_by->toDateString() < LocalDay::today();
    }

    /** D-P103: permitido, mas sempre sinalizado. */
    public function wasApprovedByRequester(): bool
    {
        return in_array($this->status, ['approved', 'received'], true) && (int) $this->decided_by === (int) $this->requester_id;
    }

    #[Scope]
    protected function late(Builder $query): void
    {
        $query->whereIn('status', self::OPEN_STATUSES)->whereDate('needed_by', '<', LocalDay::today());
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseRequestItem::class, 'request_id')->orderBy('sort_order')->orderBy('id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(PurchaseRequestHistory::class, 'request_id')->orderBy('changed_at')->orderBy('id');
    }
}
