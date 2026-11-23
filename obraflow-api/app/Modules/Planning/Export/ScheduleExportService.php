<?php

namespace App\Modules\Planning\Export;

use App\Models\Project;
use App\Models\Schedule;
use App\Models\User;
use App\Modules\Audit\AuditEvent;
use App\Modules\Audit\AuditLogger;
use App\Modules\Budgets\Report\ChromeRenderer;
use App\Modules\Budgets\Report\ReportAssets;

/**
 * Exportação do orçamento sintético do planejamento (6B, D-P96): XLSX (OpenSpout) ou PDF (Chrome headless, motor da 4D).
 * Arquivo temporário (quem chama envia e apaga); a exportação é auditada (os dados saem do sistema).
 */
final class ScheduleExportService
{
    public const FORMATS = ['xlsx', 'pdf'];

    public function __construct(private readonly ScheduleExportBuilder $builder, private readonly AuditLogger $audit) {}

    /** @return array{path: string, filename: string, mime: string} */
    public function generate(Project $project, Schedule $schedule, string $format, User $user): array
    {
        $data = $this->builder->build($project, $schedule, $format, $user);
        $path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'obraflow-'.bin2hex(random_bytes(8)).'.'.$format;

        if ($format === 'pdf') {
            $html = view('reports.schedule', ['data' => $data, 'fontFace' => ReportAssets::fontFace(), 'logo' => ReportAssets::logo('logo-completa')])->render();
            app(ChromeRenderer::class)->pdf($html, $path);
        } else {
            app(ScheduleXlsxRenderer::class)->render($data, $path);
        }

        $this->audit->record(AuditEvent::SCHEDULE_EXPORTED, tenantId: $schedule->tenant_id, userId: $user->getKey(), entityType: 'schedule', entityId: $schedule->id,
            metadata: ['format' => $format, 'project_id' => $project->id]);

        return ['path' => $path, 'filename' => $data['meta']['filename'], 'mime' => $format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    }
}
