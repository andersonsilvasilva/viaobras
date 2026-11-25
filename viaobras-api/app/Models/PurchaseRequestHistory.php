<?php

namespace App\Models;

use App\Modules\Audit\ImmutableBuilder;
use App\Modules\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Histórico de situação da solicitação — append-only. Só o PurchaseRequestWorkflow cria. */
class PurchaseRequestHistory extends Model
{
    use BelongsToTenant;

    public const CREATED_AT = null;

    public const UPDATED_AT = null;

    protected $table = 'purchase_request_history';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['changed_at' => 'immutable_datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('purchase_request_history é append-only: atualização proibida.'));
        static::deleting(fn () => throw new LogicException('purchase_request_history é append-only: exclusão proibida.'));
    }

    public function newEloquentBuilder($query): ImmutableBuilder
    {
        return new ImmutableBuilder($query);
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
