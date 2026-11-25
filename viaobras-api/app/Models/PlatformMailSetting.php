<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Caixa postal de envio da plataforma (uma linha). A senha é cifrada no banco, escondida da serialização e nunca vai
 * para a API nem para a auditoria. Gravada só pelo PlatformMailbox.
 */
class PlatformMailSetting extends Model
{
    protected $guarded = ['*'];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return ['password' => 'encrypted', 'port' => 'integer', 'active' => 'boolean', 'last_tested_at' => 'datetime'];
    }
}
