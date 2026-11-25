<?php

namespace App\Modules\Platform\Services;

use App\Models\PlatformMailTemplate;
use App\Models\User;
use App\Modules\Audit\AuditEvent;
use App\Modules\Audit\AuditLogger;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Mensagens padrão da plataforma (D-P118): assunto e texto simples com variáveis de uma LISTA FECHADA, escritas como
 * {{nome}}. `{{link}}` é obrigatória no texto. A troca é feita numa passada só: um valor que contenha "{{…}}" não é
 * interpretado de novo.
 */
final class MailTemplates
{
    private const VARIABLE = '/\{\{\s*([^{}]*?)\s*\}\}/u';

    public const KEYS = ['invitation', 'password_reset'];

    public const DEFINITIONS = [
        'invitation' => [
            'label' => 'Convite para a organização',
            'variables' => [
                'organizacao' => 'Nome da organização', 'convidado_por' => 'Quem enviou o convite', 'papel' => 'Papel que a pessoa terá',
                'link' => 'Link para aceitar (obrigatório)', 'validade' => 'Data e hora em que o convite expira',
            ],
            'subject' => 'Convite para {{organizacao}} no ViaObras',
            'body' => "Olá,\n\n{{convidado_por}} convidou você para participar de \"{{organizacao}}\" no ViaObras, com o papel \"{{papel}}\".\n\nPara aceitar, acesse:\n{{link}}\n\nEste convite expira em {{validade}}. Se você não esperava este convite, ignore esta mensagem.\n\n— ViaObras",
            'sample' => [
                'organizacao' => 'Construtora Exemplo', 'convidado_por' => 'Maria Souza', 'papel' => 'member',
                'link' => 'https://app.viaobras.com.br/accept-invitation?token=EXEMPLO', 'validade' => '02/12/2026 18:00',
            ],
        ],
        'password_reset' => [
            'label' => 'Recuperação de senha',
            'variables' => ['nome' => 'Nome da pessoa', 'link' => 'Link para criar a nova senha (obrigatório)', 'validade' => 'Por quanto tempo o link vale'],
            'subject' => 'Redefinição de senha no ViaObras',
            'body' => "Olá, {{nome}}.\n\nRecebemos um pedido para redefinir a senha da sua conta no ViaObras.\n\nPara criar uma nova senha, acesse:\n{{link}}\n\nEste link vale por {{validade}}. Se você não pediu, ignore esta mensagem: sua senha continua a mesma.\n\n— ViaObras",
            'sample' => ['nome' => 'Maria Souza', 'link' => 'https://app.viaobras.com.br/reset-password?token=EXEMPLO', 'validade' => '60 minutos'],
        ],
    ];

    public function __construct(private readonly AuditLogger $audit) {}

    /** @return array{subject: string, body: string} o texto em uso (alterado ou padrão) */
    public function current(string $key): array
    {
        return $this->stored($key)?->only(['subject', 'body']) ?? $this->default($key);
    }

    /** @return array{subject: string, body: string} */
    public function default(string $key): array
    {
        return ['subject' => self::DEFINITIONS[$key]['subject'], 'body' => self::DEFINITIONS[$key]['body']];
    }

    public function describe(string $key): array
    {
        $definition = self::DEFINITIONS[$key];

        return [
            'key' => $key, 'label' => $definition['label'], 'customized' => $this->stored($key) !== null,
            'variables' => collect($definition['variables'])->map(fn ($description, $name) => ['name' => $name, 'description' => $description])->values()->all(),
            'default' => $this->default($key),
        ] + $this->current($key);
    }

    /**
     * @param  array<string, string>  $values
     * @param  ?array{subject: string, body: string}  $text  texto a usar (prévia); sem ele, o que está em uso
     * @return array{subject: string, body: string}
     */
    public function render(string $key, array $values, ?array $text = null): array
    {
        $text ??= $this->current($key);
        $replace = fn (string $source): string => preg_replace_callback(self::VARIABLE, fn (array $m): string => (string) ($values[$m[1]] ?? $m[0]), $source);

        return [
            // o assunto é um cabeçalho: sem quebras de linha, venham de onde vierem
            'subject' => trim(preg_replace('/\s+/u', ' ', $replace($text['subject']))),
            'body' => $replace($text['body']),
        ];
    }

    /**
     * @param  array{subject: string, body: string}  $text
     * @return array{subject: string, body: string} o texto com dados de exemplo
     */
    public function sample(string $key, array $text): array
    {
        return $this->render($key, self::DEFINITIONS[$key]['sample'], $text);
    }

    public function assertValid(string $key, string $subject, string $body): void
    {
        preg_match_all(self::VARIABLE, $subject."\n".$body, $matches);
        $unknown = array_values(array_diff(array_unique($matches[1]), array_keys(self::DEFINITIONS[$key]['variables'])));
        if ($unknown !== []) {
            throw ApiException::unprocessable('unknown_variable', 'Variável não reconhecida: {{'.implode('}}, {{', $unknown).'}}.');
        }
        preg_match_all(self::VARIABLE, $body, $inBody);
        if (! in_array('link', $inBody[1], true)) {
            throw ApiException::unprocessable('link_required', 'O texto precisa ter a variável {{link}}: sem ela a pessoa não consegue continuar.');
        }
    }

    public function save(string $key, string $subject, string $body, User $actor): void
    {
        $this->assertValid($key, $subject, $body);

        DB::transaction(function () use ($key, $subject, $body, $actor) {
            $row = PlatformMailTemplate::query()->where('key', $key)->first() ?? (new PlatformMailTemplate)->forceFill(['key' => $key]);
            $row->forceFill(['subject' => $subject, 'body' => $body, 'updated_by' => $actor->getKey()])->save();
            $this->audit->record(AuditEvent::PLATFORM_MAIL_TEMPLATE_UPDATED, userId: $actor->getKey(),
                entityType: 'platform_mail_template', entityId: $row->id, metadata: ['template' => $key]);
        });
    }

    public function restore(string $key, User $actor): void
    {
        DB::transaction(function () use ($key, $actor) {
            $row = PlatformMailTemplate::query()->where('key', $key)->first();
            if ($row === null) {
                return;
            }
            $id = $row->id;
            $row->delete();
            $this->audit->record(AuditEvent::PLATFORM_MAIL_TEMPLATE_RESTORED, userId: $actor->getKey(),
                entityType: 'platform_mail_template', entityId: $id, metadata: ['template' => $key]);
        });
    }

    private function stored(string $key): ?PlatformMailTemplate
    {
        try {
            return PlatformMailTemplate::query()->where('key', $key)->first();
        } catch (QueryException) {
            return null; // tabela ainda não migrada: vale o padrão
        }
    }
}
