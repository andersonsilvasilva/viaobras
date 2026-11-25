<?php

namespace App\Modules\Platform\Http\Middleware;

use App\Modules\Platform\PlatformAdmin;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Tenancy\ActiveTenantResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Só o administrador da plataforma, e só por sessão de navegador (token de API nunca alcança a plataforma). */
final class EnsurePlatformAdmin
{
    public function __construct(private readonly ActiveTenantResolver $resolver) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! PlatformAdmin::is($user) || ! $request->hasSession() || $this->resolver->isTokenRequest($user)) {
            throw ApiException::forbidden('forbidden', 'Área restrita à administração da plataforma.');
        }

        return $next($request);
    }
}
