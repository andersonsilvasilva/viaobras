<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Audit\AuditEvent;
use App\Modules\Audit\AuditLogger;
use App\Modules\Platform\Mail\PlainTextMail;
use App\Modules\Platform\Services\MailTemplates;
use App\Modules\Platform\Services\PlatformMailbox;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Throwable;

/** Plataforma → E-mail: caixa postal de envio e mensagens padrão. Rotas só do administrador da plataforma. */
class PlatformMailController extends Controller
{
    public function __construct(private readonly PlatformMailbox $mailbox, private readonly MailTemplates $templates) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'mailbox' => $this->mailbox->status(),
            'templates' => array_map(fn (string $key) => $this->templates->describe($key), MailTemplates::KEYS),
        ]]);
    }

    public function updateMailbox(Request $request): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:190'],
            'port' => ['required', 'integer', Rule::in([465, 587])],
            'username' => ['required', 'string', 'max:190'],
            'password' => ['nullable', 'string', 'max:500'],
            'from_address' => ['required', 'email', 'max:190'],
            'from_name' => ['required', 'string', 'max:100', 'not_regex:/[\r\n]/'],
            'current_password' => ['required', 'string', 'current_password:web'],
        ], [], [
            'host' => 'servidor', 'port' => 'porta', 'username' => 'usuário', 'password' => 'senha da caixa postal',
            'from_address' => 'e-mail do remetente', 'from_name' => 'nome do remetente', 'current_password' => 'sua senha',
        ]);

        $this->mailbox->testAndSave($data, $request->user());

        return $this->show();
    }

    public function useServer(Request $request): JsonResponse
    {
        $request->validate(['current_password' => ['required', 'string', 'current_password:web']], [], ['current_password' => 'sua senha']);
        $this->mailbox->useServer($request->user());

        return $this->show();
    }

    public function test(Request $request): JsonResponse
    {
        $this->mailbox->testCurrent($request->user());

        return response()->json(['message' => "Teste enviado para {$request->user()->email}."]);
    }

    public function updateTemplate(Request $request, string $key): JsonResponse
    {
        $data = $this->text($request);
        $this->templates->save($key, $data['subject'], $data['body'], $request->user());

        return response()->json(['data' => $this->templates->describe($key)]);
    }

    public function restoreTemplate(Request $request, string $key): JsonResponse
    {
        $this->templates->restore($key, $request->user());

        return response()->json(['data' => $this->templates->describe($key)]);
    }

    /** Prévia com dados de exemplo (nada é gravado nem enviado). */
    public function preview(Request $request, string $key): JsonResponse
    {
        $data = $this->text($request);
        $this->templates->assertValid($key, $data['subject'], $data['body']);

        return response()->json(['data' => $this->templates->sample($key, $data)]);
    }

    /** Envia a prévia para quem está editando. */
    public function testTemplate(Request $request, string $key, AuditLogger $audit): JsonResponse
    {
        $data = $this->text($request);
        $this->templates->assertValid($key, $data['subject'], $data['body']);
        $message = $this->templates->sample($key, $data);

        try {
            Mail::to($request->user()->email)->send(new PlainTextMail('[Teste] '.$message['subject'], $message['body']));
        } catch (Throwable $e) {
            Log::warning('Falha no teste de mensagem', ['exception' => $e::class]);
            throw ApiException::unprocessable('mail_test_failed', 'Não foi possível enviar o teste. Confira a caixa postal.');
        }
        $audit->record(AuditEvent::PLATFORM_MAIL_TESTED, userId: $request->user()->getKey(), metadata: ['kind' => 'template', 'template' => $key]);

        return response()->json(['message' => "Teste enviado para {$request->user()->email}."]);
    }

    /** @return array{subject: string, body: string} */
    private function text(Request $request): array
    {
        return $request->validate([
            'subject' => ['required', 'string', 'max:150', 'not_regex:/[\r\n]/'],
            'body' => ['required', 'string', 'max:5000'],
        ], [], ['subject' => 'assunto', 'body' => 'texto']);
    }
}
