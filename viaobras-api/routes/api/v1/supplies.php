<?php

use App\Modules\Supplies\Http\Controllers\PurchaseRequestController;
use App\Modules\Supplies\Services\PurchaseRequestWorkflow;
use Illuminate\Support\Facades\Route;

/*
| Fase 7A — Solicitações de materiais (sempre de uma obra). TODAS em `tenant.required` e com `supplies.view`. O que
| cada um pode FAZER (solicitar, aprovar) depende da solicitação, da situação e do acesso à obra: PurchaseRequestAccess.
*/

Route::middleware(['tenant.required', 'can:supplies.view'])->prefix('purchase-requests')->group(function (): void {
    Route::get('/', [PurchaseRequestController::class, 'index'])->name('purchase-requests.index');
    Route::post('/', [PurchaseRequestController::class, 'store'])->name('purchase-requests.store');
    Route::get('summary', [PurchaseRequestController::class, 'summary'])->name('purchase-requests.summary');
    // o previsto no planejamento é dado do planejamento: exige também vê-lo
    Route::get('planning', [PurchaseRequestController::class, 'planning'])->middleware('can:schedules.view')->name('purchase-requests.planning');

    Route::prefix('{uuid}')->whereUuid('uuid')->group(function (): void {
        Route::get('/', [PurchaseRequestController::class, 'show'])->name('purchase-requests.show');
        Route::put('/', [PurchaseRequestController::class, 'update'])->name('purchase-requests.update');
        Route::delete('/', [PurchaseRequestController::class, 'destroy'])->name('purchase-requests.destroy');
        Route::post('workflow/{action}', [PurchaseRequestController::class, 'workflow'])
            ->whereIn('action', PurchaseRequestWorkflow::ACTIONS)->name('purchase-requests.workflow');
    });
});
