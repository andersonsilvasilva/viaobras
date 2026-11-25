<?php

namespace App\Modules\Access\Mail;

use App\Modules\Platform\Services\MailTemplates;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Convite por e-mail. O token em claro só existe aqui (e-mail); no banco fica apenas o hash. */
class InvitationMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly string $tenantName,
        public readonly string $inviterName,
        public readonly string $roleName,
        public readonly string $token,
        public readonly string $expiresAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->message()['subject']);
    }

    public function content(): Content
    {
        return new Content(text: 'mail.plain', with: ['body' => $this->message()['body']]);
    }

    /** @return array{subject: string, body: string} assunto e texto das mensagens padrão da plataforma (D-P118) */
    private function message(): array
    {
        return app(MailTemplates::class)->render('invitation', [
            'organizacao' => $this->tenantName,
            'convidado_por' => $this->inviterName,
            'papel' => $this->roleName,
            'link' => rtrim(config('viaobras.frontend_url'), '/').'/accept-invitation?token='.$this->token,
            'validade' => $this->expiresAt,
        ]);
    }
}
