<?php

use App\Modules\Platform\Http\Controllers\PlatformMailController;
use App\Modules\Platform\Services\MailTemplates;
use Illuminate\Support\Facades\Route;

/*
| Administração da PLATAFORMA (D-P113): fora das organizações, sem tenant. TODAS exigem o administrador da plataforma,
| por sessão de navegador. Nenhuma devolve dados de organizações.
*/

Route::middleware(['authenticated', 'platform.admin'])->prefix('platform/mail')->name('platform.mail.')->group(function (): void {
    Route::get('/', [PlatformMailController::class, 'show'])->name('show');

    // o que envia e-mail ou confere senha tem limite de tentativas
    Route::middleware('throttle:10,1')->group(function (): void {
        Route::put('mailbox', [PlatformMailController::class, 'updateMailbox'])->name('mailbox.update');
        Route::delete('mailbox', [PlatformMailController::class, 'useServer'])->name('mailbox.destroy');
        Route::post('test', [PlatformMailController::class, 'test'])->name('test');
        Route::post('templates/{key}/test', [PlatformMailController::class, 'testTemplate'])->whereIn('key', MailTemplates::KEYS)->name('templates.test');
    });

    Route::prefix('templates/{key}')->whereIn('key', MailTemplates::KEYS)->group(function (): void {
        Route::put('/', [PlatformMailController::class, 'updateTemplate'])->name('templates.update');
        Route::delete('/', [PlatformMailController::class, 'restoreTemplate'])->name('templates.restore');
        Route::post('preview', [PlatformMailController::class, 'preview'])->name('templates.preview');
    });
});
