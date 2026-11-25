<?php

namespace App\Modules\Supplies\Services;

use App\Modules\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * "Hoje" e dias do calendário no fuso da ORGANIZAÇÃO (o servidor grava em UTC; sem isto, no Brasil o dia viraria às
 * 21h: atraso, data do atendimento, ano do código e filtro por período sairiam errados). Datas como texto AAAA-MM-DD.
 */
final class LocalDay
{
    public static function timezone(): string
    {
        return app(TenantContext::class)->tenant()?->timezone ?: 'America/Sao_Paulo';
    }

    public static function today(): string
    {
        return CarbonImmutable::now(self::timezone())->toDateString();
    }

    /** O dia local de um instante gravado em UTC. */
    public static function of(DateTimeInterface $instant): string
    {
        return CarbonImmutable::instance($instant)->setTimezone(self::timezone())->toDateString();
    }

    /** Início (UTC) do dia local informado. */
    public static function startUtc(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date, self::timezone())->startOfDay()->utc();
    }
}
