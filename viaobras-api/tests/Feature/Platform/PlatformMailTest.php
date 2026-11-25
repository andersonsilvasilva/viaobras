<?php

use App\Models\AuditLog;
use App\Models\PlatformMailSetting;
use App\Models\User;
use App\Modules\Access\Mail\InvitationMail;
use App\Modules\Audit\AuditEvent;
use App\Modules\Platform\Mail\PlainTextMail;
use App\Modules\Platform\Services\MailboxSender;
use App\Modules\Platform\Services\MailHostResolver;
use App\Modules\Platform\Services\MailTemplates;
use App\Modules\Platform\Services\PlatformMailbox;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Support\Browser;
use Tests\Support\Scenario;

/*
 * E-mail da plataforma (EMAIL_CONFIG_MODELO.md, D-P113…D-P121): só o administrador da plataforma; caixa postal com
 * senha de confirmação e teste antes de valer, senha cifrada que nunca volta; mensagens padrão com variáveis fechadas.
 * Nenhum teste usa a rede: o envio de teste e a consulta de DNS são substituídos.
 */

const MAILBOX_SECRET = 'DEMO-segredo-da-caixa-9';

beforeEach(function () {
    RateLimiter::clear('login');
    Scenario::catalog();
    $this->A = Scenario::tenant();
    $this->root = Scenario::member($this->A, 'admin', ['email' => 'plataforma@exemplo.test']);
    $this->owner = Scenario::member($this->A, 'admin', ['email' => 'dono@cliente.test']);
    config(['viaobras.platform_admins' => ['plataforma@exemplo.test']]);

    $this->sent = new ArrayObject;
    $this->mock(MailHostResolver::class)->shouldReceive('resolve')->andReturnUsing(fn (string $host) => match ($host) {
        'smtp.interno.exemplo.com' => ['10.0.0.5'],
        'smtp.misto.exemplo.com' => ['93.184.216.34', '127.0.0.1'],
        'nao-existe.exemplo.com' => [],
        default => ['93.184.216.34'],
    });
    $this->mock(MailboxSender::class)->shouldReceive('send')->andReturnUsing(function (array $mailbox, string $to) {
        if ($mailbox['password'] === 'senha-errada') {
            throw new RuntimeException('535 5.7.8 Authentication failed for senha-errada ('.base64_encode('senha-errada').')');
        }
        $this->sent[] = $mailbox + ['to' => $to];
    });

    $this->b = new Browser($this);
    $this->b->login($this->root->email)->assertOk();
});

function mailboxData(array $extra = []): array
{
    return ['host' => 'smtp.exemplo.com', 'port' => 465, 'username' => 'envio@exemplo.com', 'password' => MAILBOX_SECRET,
        'from_address' => 'envio@exemplo.com', 'from_name' => 'DEMO ViaObras', 'current_password' => Scenario::PASSWORD, ...$extra];
}

it('só o administrador da plataforma entra: o admin de uma organização recebe 403', function () {
    $owner = new Browser($this);
    $owner->login($this->owner->email)->assertOk()->assertJsonPath('is_platform_admin', false);

    $owner->get('/api/v1/platform/mail')->assertForbidden();
    $owner->put('/api/v1/platform/mail/mailbox', mailboxData())->assertForbidden();
    $owner->delete('/api/v1/platform/mail/mailbox', ['current_password' => Scenario::PASSWORD])->assertForbidden();
    $owner->post('/api/v1/platform/mail/test')->assertForbidden();
    $owner->put('/api/v1/platform/mail/templates/invitation', ['subject' => 'x', 'body' => '{{link}}'])->assertForbidden();

    $this->b->get('/api/v1/auth/me')->assertJsonPath('is_platform_admin', true);
    $this->b->get('/api/v1/platform/mail')->assertOk()->assertJsonPath('data.mailbox.source', 'server')->assertJsonPath('data.mailbox.settings', null);
    expect($this->sent)->toHaveCount(0)->and(PlatformMailSetting::query()->count())->toBe(0);
});

it('exige sessão: sem login recebe 401', function () {
    $this->getJson('/api/v1/platform/mail')->assertUnauthorized();
});

it('testa para quem está alterando e só então grava, com a senha cifrada e sem devolvê-la', function () {
    $response = $this->b->put('/api/v1/platform/mail/mailbox', mailboxData())->assertOk()
        ->assertJsonPath('data.mailbox.source', 'panel')->assertJsonPath('data.mailbox.settings.password_set', true)
        ->assertJsonPath('data.mailbox.settings.encryption', 'ssl')->assertJsonMissingPath('data.mailbox.settings.password');

    $raw = DB::table('platform_mail_settings')->value('password');
    $audit = AuditLog::query()->where('event', AuditEvent::PLATFORM_MAIL_UPDATED)->sole();

    expect($this->sent[0]['to'])->toBe('plataforma@exemplo.test')->and($this->sent[0]['password'])->toBe(MAILBOX_SECRET)
        ->and($raw)->not->toContain(MAILBOX_SECRET)->and(PlatformMailSetting::query()->sole()->password)->toBe(MAILBOX_SECRET)
        ->and($response->getContent())->not->toContain(MAILBOX_SECRET)
        ->and(json_encode($audit->toArray()))->not->toContain(MAILBOX_SECRET)
        ->and($this->b->get('/api/v1/platform/mail')->getContent())->not->toContain(MAILBOX_SECRET);
});

it('não grava quando o servidor recusa, e a mensagem de erro não revela a senha', function () {
    $content = $this->b->put('/api/v1/platform/mail/mailbox', mailboxData(['password' => 'senha-errada']))
        ->assertUnprocessable()->assertJsonPath('error.code', 'mail_test_failed')->getContent();

    expect($content)->toContain('535')->toContain('senha da caixa postal')->not->toContain('senha-errada')->not->toContain(base64_encode('senha-errada'))
        ->and(PlatformMailSetting::query()->count())->toBe(0);
});

it('em outras falhas mostra o texto do servidor de e-mail, sem a senha', function () {
    $this->mock(MailboxSender::class)->shouldReceive('send')->andThrow(new RuntimeException('Connection timed out for '.MAILBOX_SECRET));

    $content = $this->b->put('/api/v1/platform/mail/mailbox', mailboxData())->assertUnprocessable()->getContent();

    expect($content)->toContain('Connection timed out')->not->toContain(MAILBOX_SECRET);
});

it('informa se a configuração do servidor envia de verdade', function (string $mailer, bool $sends) {
    config(['mail.default' => $mailer]);

    $this->b->get('/api/v1/platform/mail')->assertOk()->assertJsonPath('data.mailbox.server_sends', $sends);
})->with(['SMTP envia' => ['smtp', true], 'log só registra' => ['log', false], 'array só guarda em memória' => ['array', false]]);

it('exige a senha de quem está alterando', function () {
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData(['current_password' => 'Outra-Senha-999']))
        ->assertUnprocessable()->assertJsonValidationErrors('current_password', 'error.details');

    expect($this->sent)->toHaveCount(0);
});

it('só reaproveita a senha guardada se o servidor, a porta e o usuário continuarem iguais', function (array $change) {
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData())->assertOk();

    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData(['password' => null, ...$change]))
        ->assertUnprocessable()->assertJsonPath('error.code', 'password_required');

    expect($this->sent)->toHaveCount(1); // a senha antiga não foi enviada a lugar nenhum
})->with([
    'outro servidor' => [['host' => 'smtp.atacante.com']],
    'outro usuário' => [['username' => 'outro@exemplo.com']],
    'outra porta' => [['port' => 587]],
]);

it('mantém a senha ao mudar só o remetente', function () {
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData())->assertOk();

    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData(['password' => '', 'from_name' => 'DEMO Novo nome']))
        ->assertOk()->assertJsonPath('data.mailbox.settings.from_name', 'DEMO Novo nome');

    expect($this->sent[1]['password'])->toBe(MAILBOX_SECRET)->and(PlatformMailSetting::query()->count())->toBe(1);
});

it('recusa endereços internos, IPs, nomes de um rótulo e portas fora do envio', function (array $change, string $code) {
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData($change))->assertUnprocessable()->assertJsonPath('error.code', $code);

    expect($this->sent)->toHaveCount(0);
})->with([
    'serviço interno do servidor' => [['host' => 'redis'], 'invalid_host'],
    'localhost' => [['host' => 'localhost'], 'invalid_host'],
    'IP' => [['host' => '127.0.0.1'], 'invalid_host'],
    'nome que aponta para rede privada' => [['host' => 'smtp.interno.exemplo.com'], 'invalid_host'],
    'um dos endereços é interno' => [['host' => 'smtp.misto.exemplo.com'], 'invalid_host'],
    'nome inexistente' => [['host' => 'nao-existe.exemplo.com'], 'invalid_host'],
    'porta 25' => [['port' => 25], 'validation_failed'],
]);

it('aplica a caixa da tela ao envio, com criptografia obrigatória, e volta para a do servidor', function () {
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData(['port' => 587]))->assertOk();
    config(['mail.default' => 'array']);
    PlatformMailbox::applyActive();

    expect(config('mail.default'))->toBe('platform')
        ->and(config('mail.mailers.platform'))->toMatchArray(['scheme' => 'smtp', 'require_tls' => true, 'host' => 'smtp.exemplo.com', 'port' => 587, 'password' => MAILBOX_SECRET])
        ->and(config('mail.from.address'))->toBe('envio@exemplo.com');

    $this->b->delete('/api/v1/platform/mail/mailbox', ['current_password' => Scenario::PASSWORD])->assertOk()->assertJsonPath('data.mailbox.source', 'server');
    config(['mail.default' => 'array']);
    PlatformMailbox::applyActive();

    expect(config('mail.default'))->toBe('array');
});

it('continua com a configuração do servidor se a senha não puder ser decifrada', function () {
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData())->assertOk();
    DB::table('platform_mail_settings')->update(['password' => 'nao-e-um-texto-cifrado']);
    config(['mail.default' => 'array']);

    PlatformMailbox::applyActive();

    expect(config('mail.default'))->toBe('array');
});

it('salva a mensagem alterada e ela passa a valer no convite; restaurar volta ao padrão', function () {
    $this->b->put('/api/v1/platform/mail/templates/invitation', [
        'subject' => 'DEMO {{ organizacao }} chamou você', 'body' => "DEMO de {{convidado_por}}\nEntre: {{link}}",
    ])->assertOk()->assertJsonPath('data.customized', true);

    $mail = new InvitationMail('Obra {{link}}', 'DEMO Ana', 'member', 'tok123', '02/12/2026 18:00');
    $mail->assertHasSubject('DEMO Obra {{link}} chamou você'); // valor com {{…}} não é interpretado de novo
    $mail->assertSeeInText('DEMO de DEMO Ana');
    $mail->assertSeeInText('/accept-invitation?token=tok123');

    $this->b->delete('/api/v1/platform/mail/templates/invitation')->assertOk()->assertJsonPath('data.customized', false);
    (new InvitationMail('DEMO Org', 'DEMO Ana', 'member', 'tok123', '02/12/2026 18:00'))->assertHasSubject('Convite para DEMO Org no ViaObras');
});

it('o e-mail de recuperação de senha usa a mensagem padrão, com o link do app', function () {
    $user = User::factory()->create(['name' => 'DEMO Pessoa', 'email' => 'pessoa@exemplo.test']);
    $this->b->put('/api/v1/platform/mail/templates/password_reset', ['subject' => 'DEMO senha', 'body' => 'Oi {{nome}}: {{link}} ({{validade}})'])->assertOk();

    $mail = (new ResetPassword('tok999'))->toMail($user);

    $mail->assertHasSubject('DEMO senha');
    $mail->assertHasTo('pessoa@exemplo.test');
    $mail->assertSeeInText('Oi DEMO Pessoa: http://localhost:5173/reset-password?token=tok999&email=pessoa%40exemplo.test (60 minutos)');
});

it('recusa mensagem sem o link, com variável desconhecida ou com quebra de linha no assunto', function (array $text, ?string $code) {
    $response = $this->b->put('/api/v1/platform/mail/templates/password_reset', $text + ['subject' => 'x', 'body' => '{{link}}'])->assertUnprocessable();

    $code === null ? $response->assertJsonValidationErrors('subject', 'error.details') : $response->assertJsonPath('error.code', $code);
    expect(app(MailTemplates::class)->describe('password_reset')['customized'])->toBeFalse();
})->with([
    'sem link' => [['body' => 'DEMO sem o endereço'], 'link_required'],
    'link só no assunto' => [['subject' => '{{link}}', 'body' => 'DEMO'], 'link_required'],
    'variável de outra mensagem' => [['body' => '{{link}} {{organizacao}}'], 'unknown_variable'],
    'variável inventada' => [['body' => '{{link}} {{senha}}'], 'unknown_variable'],
    'quebra no assunto' => [['subject' => "a\r\nBcc: x@y.test"], null],
]);

it('mostra a prévia com dados de exemplo e envia o teste só para quem está editando', function () {
    Mail::fake();
    $text = ['subject' => 'DEMO {{organizacao}}', 'body' => 'Link: {{link}}'];

    $this->b->post('/api/v1/platform/mail/templates/invitation/preview', $text)->assertOk()
        ->assertJsonPath('data.subject', 'DEMO Construtora Exemplo');
    Mail::assertNothingSent();

    $this->b->post('/api/v1/platform/mail/templates/invitation/test', $text)->assertOk();
    $this->b->post('/api/v1/platform/mail/test')->assertOk();

    Mail::assertSent(PlainTextMail::class, 2);
    Mail::assertSent(PlainTextMail::class, fn (PlainTextMail $m) => $m->hasTo('plataforma@exemplo.test') && $m->subjectLine === '[Teste] DEMO Construtora Exemplo');
    expect(app(MailTemplates::class)->describe('invitation')['customized'])->toBeFalse();
});

it('audita cada operação da plataforma, sem organização', function () {
    Mail::fake();
    $this->b->put('/api/v1/platform/mail/mailbox', mailboxData())->assertOk();
    $this->b->post('/api/v1/platform/mail/test')->assertOk();
    $this->b->delete('/api/v1/platform/mail/mailbox', ['current_password' => Scenario::PASSWORD])->assertOk();
    $this->b->put('/api/v1/platform/mail/templates/invitation', ['subject' => 'x', 'body' => '{{link}}'])->assertOk();
    $this->b->delete('/api/v1/platform/mail/templates/invitation')->assertOk();

    $events = AuditLog::query()->whereIn('event', AuditEvent::platform())->get();

    expect(array_diff(AuditEvent::platform(), $events->pluck('event')->all()))->toBe([])
        ->and($events->pluck('tenant_id')->unique()->all())->toBe([null])
        ->and($events->pluck('user_id')->unique()->all())->toBe([$this->root->id]);
});
