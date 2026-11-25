<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Mensagem padrão alterada pela plataforma. Gravada só pelo MailTemplates. */
class PlatformMailTemplate extends Model
{
    protected $guarded = ['*'];
}
