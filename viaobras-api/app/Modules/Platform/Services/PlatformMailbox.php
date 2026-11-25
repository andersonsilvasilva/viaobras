<?php

namespace App\Modules\Platform\Services;

use App\Models\PlatformMailSetting;
use App\Models\User;
use App\Modules\Audit\AuditEvent;
use App\Modules\Audit\AuditLogger;
use App\Modules\Platform\Mail\PlainTextMail;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Caixa postal de envio da plataforma (EMAIL_CONFIG_MODELO.md):
 *  - a configuração nova SÓ passa a valer se um teste para quem está alterando for aceito (D-P115);
 *  - a senha guardada só é reaproveitada se o servidor, a porta e o usuário não mudarem (senão ela seria enviada
 *    a outro servidor);
 *  - só portas 465/587 com criptografia obrigatória e nomes que apontem para endereços públicos (D-P117);
 *  - sem configuração ativa aqui, vale a do servidor (.env, D-P116).
 */
final class PlatformMailbox
{
    private const ENCRYPTION = [465 => 'ssl', 587 => 'tls'];

    public function __construct(
        private readonly MailboxSender $sender,
        private readonly MailHostResolver $hosts,
        private readonly AuditLogger $audit,
    ) {}

    /** Configuração do mailer do Laravel para uma caixa postal. */
    public static function mailerConfig(array $mailbox): array
    {
        return [
            'transport' => 'smtp',
            'scheme' => $mailbox['encryption'] === 'ssl' ? 'smtps' : 'smtp',
            'require_tls' => true,
            'host' => $mailbox['host'],
            'port' => (int) $mailbox['port'],
            'username' => $mailbox['username'],
            'password' => $mailbox['password'],
            'timeout' => 20,
        ];
    }

    /**
     * Passa a enviar pela caixa configurada na tela, se houver. Chamado quando o serviço de e-mail é criado. Qualquer
     * problema (tabela ainda não migrada, chave da aplicação trocada) mantém a configuração do servidor.
     */
    public static function applyActive(): void
    {
        try {
            $setting = PlatformMailSetting::query()->where('active', true)->first();
            if ($setting === null) {
                return;
            }
            $mailbox = $setting->only(['host', 'port', 'encryption', 'username', 'from_address', 'from_name']) + ['password' => $setting->password];
        } catch (QueryException) {
            return;
        } catch (DecryptException) {
            Log::error('Senha da caixa postal da plataforma não pode ser decifrada: usando a configuração do servidor.');

            return;
        }

        config([
            'mail.mailers.platform' => self::mailerConfig($mailbox),
            'mail.default' => 'platform',
            'mail.from' => ['address' => $mailbox['from_address'], 'name' => $mailbox['from_name']],
        ]);
    }

    /** Situação atual, sem a senha. */
    public function status(): array
    {
        $setting = PlatformMailSetting::query()->first();

        return [
            'source' => $setting !== null && $setting->active ? 'panel' : 'server',
            // a configuração do servidor envia de verdade? (log/array só registram)
            'server_sends' => (bool) config('viaobras.server_mail_sends'),
            'settings' => $setting === null ? null : [
                'host' => $setting->host, 'port' => $setting->port, 'encryption' => $setting->encryption, 'username' => $setting->username,
                'from_address' => $setting->from_address, 'from_name' => $setting->from_name, 'password_set' => true,
                'active' => $setting->active, 'last_tested_at' => $setting->last_tested_at?->toIso8601String(),
            ],
        ];
    }

    /** @param array{host: string, port: int|string, username: string, password?: ?string, from_address: string, from_name: string} $data */
    public function testAndSave(array $data, User $actor): void
    {
        $current = PlatformMailSetting::query()->first();
        $host = strtolower(trim($data['host']));
        $port = (int) $data['port'];
        $this->assertPublicHost($host);

        $password = (string) ($data['password'] ?? '');
        $newSecret = $password !== '';
        if (! $newSecret) {
            if ($current === null || $current->host !== $host || $current->port !== $port || $current->username !== $data['username']) {
                throw ApiException::unprocessable('password_required', 'Informe a senha da caixa postal: ela só é mantida quando o servidor, a porta e o usuário não mudam.');
            }
            $password = $current->password;
        }

        $mailbox = [
            'host' => $host, 'port' => $port, 'encryption' => self::ENCRYPTION[$port], 'username' => $data['username'],
            'password' => $password, 'from_address' => $data['from_address'], 'from_name' => $data['from_name'],
        ];

        try {
            $this->sender->send($mailbox, $actor->email, 'ViaObras: teste da caixa postal',
                "Esta mensagem confirma que a nova caixa postal da ViaObras consegue enviar e-mails.\n\nSe você não pediu este teste, avise a administração.");
        } catch (Throwable $e) {
            throw $this->failure($e, $password);
        }

        DB::transaction(function () use ($current, $mailbox, $actor, $newSecret) {
            $setting = $current ?? new PlatformMailSetting;
            $setting->forceFill($mailbox + ['active' => true, 'last_tested_at' => now(), 'updated_by' => $actor->getKey()])->save();

            $this->audit->record(AuditEvent::PLATFORM_MAIL_UPDATED, userId: $actor->getKey(), entityType: 'platform_mail_setting', entityId: $setting->id,
                new: ['host' => $mailbox['host'], 'port' => $mailbox['port'], 'username' => $mailbox['username'], 'from_address' => $mailbox['from_address']],
                metadata: ['credential_replaced' => $newSecret]);
        });

        Mail::purge('platform');
    }

    /** Volta a usar a configuração do servidor (a da tela fica guardada, inativa). */
    public function useServer(User $actor): void
    {
        $setting = PlatformMailSetting::query()->where('active', true)->first();
        if ($setting === null) {
            throw ApiException::unprocessable('already_server', 'A configuração do servidor já está em uso.');
        }

        DB::transaction(function () use ($setting, $actor) {
            $setting->forceFill(['active' => false, 'updated_by' => $actor->getKey()])->save();
            $this->audit->record(AuditEvent::PLATFORM_MAIL_REVERTED, userId: $actor->getKey(), entityType: 'platform_mail_setting', entityId: $setting->id);
        });
    }

    /** Teste do envio que está valendo agora (tela ou servidor). */
    public function testCurrent(User $actor): void
    {
        try {
            Mail::to($actor->email)->send(new PlainTextMail('ViaObras: teste de envio', 'Esta mensagem confirma que o envio de e-mails da ViaObras está funcionando.'));
        } catch (Throwable $e) {
            throw $this->failure($e, (string) config('mail.mailers.'.config('mail.default').'.password'));
        }
        $this->audit->record(AuditEvent::PLATFORM_MAIL_TESTED, userId: $actor->getKey(), metadata: ['kind' => 'current']);
    }

    /** Erro do servidor de e-mail legível, sem a senha (nem em base64, como o protocolo a envia). */
    private function failure(Throwable $e, string $password): ApiException
    {
        $message = $e->getMessage();
        if ($password !== '') {
            $message = str_replace([$password, base64_encode($password)], '***', $message);
        }
        Log::warning('Falha no teste de e-mail da plataforma', ['exception' => $e::class]);

        return ApiException::unprocessable('mail_test_failed', 'O servidor de e-mail não aceitou o envio: '.mb_strimwidth($message, 0, 300, '…'));
    }

    private function assertPublicHost(string $host): void
    {
        $invalid = fn () => ApiException::unprocessable('invalid_host', 'Informe o endereço público do servidor de envio (ex.: smtp.provedor.com.br).');

        if (preg_match('/^(?=.{4,190}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/', $host) !== 1
            || preg_match('/\.(local|localhost|internal|lan|home)$/', $host) === 1) {
            throw $invalid();
        }
        $addresses = $this->hosts->resolve($host);
        if ($addresses === []) {
            throw $invalid();
        }
        foreach ($addresses as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                throw $invalid();
            }
        }
    }
}
