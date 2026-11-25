<?php

namespace App\Modules\Platform\Services;

/** Endereços IP de um nome (separado para os testes não dependerem de DNS). */
class MailHostResolver
{
    /** @return list<string> */
    public function resolve(string $host): array
    {
        $ipv4 = gethostbynamel($host) ?: [];
        $ipv6 = array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6');

        return array_values(array_merge($ipv4, $ipv6));
    }
}
