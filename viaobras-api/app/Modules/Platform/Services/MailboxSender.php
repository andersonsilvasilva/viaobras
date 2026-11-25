<?php

namespace App\Modules\Platform\Services;

use App\Modules\Platform\Mail\PlainTextMail;
use Illuminate\Support\Facades\Mail;

/** Envia uma mensagem por uma caixa postal informada (teste), sem alterar a que está em uso. */
class MailboxSender
{
    /** @param array{host: string, port: int, encryption: string, username: string, password: string, from_address: string, from_name: string} $mailbox */
    public function send(array $mailbox, string $to, string $subject, string $body): void
    {
        config(['mail.mailers.platform_test' => PlatformMailbox::mailerConfig($mailbox)]);
        Mail::purge('platform_test');

        try {
            Mail::mailer('platform_test')->to($to)->send(
                (new PlainTextMail($subject, $body))->from($mailbox['from_address'], $mailbox['from_name']),
            );
        } finally {
            Mail::purge('platform_test');
        }
    }
}
