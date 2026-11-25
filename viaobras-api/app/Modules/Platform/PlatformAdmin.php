<?php

namespace App\Modules\Platform;

use App\Models\User;
use Illuminate\Support\Str;

/**
 * Administrador da PLATAFORMA (D-P113): quem está na lista PLATFORM_ADMIN_EMAILS do servidor. Não é papel nem
 * permissão de organização — nenhum cliente consegue se tornar um pela aplicação.
 */
final class PlatformAdmin
{
    public static function is(?User $user): bool
    {
        return $user !== null && in_array(Str::lower((string) $user->email), config('viaobras.platform_admins', []), true);
    }
}
