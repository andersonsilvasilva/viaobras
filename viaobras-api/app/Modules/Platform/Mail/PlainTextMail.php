<?php

namespace App\Modules\Platform\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Mensagem em texto simples, já com o assunto e o corpo prontos (D-P118: sem HTML nem código). */
class PlainTextMail extends Mailable
{
    public function __construct(public readonly string $subjectLine, public readonly string $body) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(text: 'mail.plain', with: ['body' => $this->body]);
    }
}
