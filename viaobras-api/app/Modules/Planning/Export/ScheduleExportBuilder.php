<?php

namespace App\Modules\Planning\Export;

use App\Models\Company;
use App\Models\Project;
use App\Models\Schedule;
use App\Models\ScheduleDependency;
use App\Models\ScheduleTask;
use App\Models\ScheduleTaskItem;
use App\Models\User;
use App\Modules\Budgets\Report\BudgetReportBuilder;
use App\Modules\Planning\Services\ScheduleCostCalculator;
use App\Modules\Planning\Services\Scheduler;
use App\Modules\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Dados únicos da exportação do orçamento sintético do planejamento (6B, D-P96): o XLSX (28 colunas + cronograma +
 * recursos) e o PDF só formatam o que sai daqui. Valores do ScheduleCostCalculator — os mesmos da tela. Decimais em string.
 */
final class ScheduleExportBuilder
{
    public const KINDS = ScheduleCostCalculator::KINDS;

    public const KIND_LABEL = ['material' => 'Material', 'labor' => 'Cargo/Função', 'equipment' => 'Equipamento', 'service' => 'Serviço', 'other' => 'Outros'];

    public const SOURCE_LABEL = ['catalog' => 'Catálogo', 'sinapi_resource' => 'Insumo SINAPI', 'sinapi_composition' => 'Composição SINAPI',
        'own_composition' => 'Composição própria', 'budget' => 'Orçamento', 'manual' => 'Digitado'];

    public function __construct(private readonly ScheduleCostCalculator $calculator, private readonly Scheduler $scheduler) {}

    /** @return array<string, mixed> */
    public function build(Project $project, Schedule $schedule, string $format, User $user): array
    {
        // a mesma recomputação da consulta: datas sempre atualizadas pelo calendário da obra
        DB::transaction(fn () => $this->scheduler->recompute($schedule));
        $tasks = ScheduleTask::query()->where('schedule_id', $schedule->id)->get()->sort(fn ($a, $b) => self::wbsCompare($a->wbs_code, $b->wbs_code))->values();
        $costs = $this->calculator->compute($schedule->fresh(), $tasks);
        $deps = ScheduleDependency::query()->where('schedule_id', $schedule->id)->get();
        $wbsOf = $tasks->pluck('wbs_code', 'id');
        $preds = $deps->groupBy('successor_id');
        $items = ScheduleTaskItem::query()->where('schedule_id', $schedule->id)->orderBy('sort_order')->orderBy('id')->get()->groupBy('task_id');
        $tz = app(TenantContext::class)->tenant()?->timezone ?: 'America/Sao_Paulo';
        $now = CarbonImmutable::now($tz);
        $company = $project->company_id ? Company::query()->find($project->company_id) : null;

        $rows = [];
        foreach ($tasks as $t) {
            $c = $costs['tasks'][$t->id];
            $rows[] = [
                'id' => $t->id,
                'type' => $t->kind,
                'level' => substr_count($t->wbs_code, '.'),
                'wbs' => $t->wbs_code,
                'name' => $t->name,
                'unit' => $t->unit_code,
                'quantity' => $t->kind === 'task' ? ($t->quantity !== null ? (string) $t->quantity : '1') : null,
                'unit_cost' => $c['unit_cost'],
                'unit_sale' => $c['unit_sale'],
                'unit_kinds' => $c['unit_kinds'],
                'cost' => $c['cost'],
                'sale' => $c['sale'],
                'kinds' => $c['kinds'],
                'item_count' => $c['item_count'],
                'start' => $t->planned_start->format('d/m/Y'),
                'end' => $t->planned_end->format('d/m/Y'),
                'duration' => $t->duration_days,
                'predecessors' => $preds->get($t->id, collect())->map(fn ($d) => ($wbsOf[$d->predecessor_id] ?? '?').($d->type === 'FS' ? '' : $d->type).($d->lag_days ? ($d->lag_days > 0 ? '+' : '').$d->lag_days : ''))->implode('; '),
                'percent' => (string) $t->percent_complete,
                'items' => $items->get($t->id, collect())->map(fn (ScheduleTaskItem $i) => [
                    'source' => self::SOURCE_LABEL[$i->source] ?? $i->source,
                    'kind' => $i->kind === 'composition' ? 'Composição' : (self::KIND_LABEL[$i->kind] ?? $i->kind),
                    'code' => $i->code,
                    'description' => $i->description,
                    'unit' => $i->unit_code,
                    'quantity_per_unit' => (string) $i->quantity_per_unit,
                    'unit_cost' => (string) $i->unit_cost,
                ] + array_intersect_key($costs['items'][$i->id] ?? [], array_flip(['quantity_total', 'bdi_percent', 'discount_percent', 'unit_sale', 'cost', 'sale'])))->values()->all(),
            ];
        }

        $code = $project->code ?: 'obra';

        return [
            'meta' => [
                'project_code' => $project->code,
                'project_name' => $project->name,
                'company' => $company?->legal_name,
                'regime' => BudgetReportBuilder::REGIME[$project->social_charges_regime ?? ''] ?? 'Não definido',
                'origin' => ['budget' => 'Do orçamento aprovado', 'spreadsheet' => 'Importado de planilha', 'blank' => 'Criado do zero'][$schedule->origin] ?? $schedule->origin,
                'duration_mode' => $schedule->duration_mode === 'working' ? 'dias úteis' : 'dias corridos',
                'start' => $tasks->isEmpty() ? null : $tasks->min(fn ($t) => $t->planned_start)->format('d/m/Y'),
                'end' => $tasks->isEmpty() ? null : $tasks->max(fn ($t) => $t->planned_end)->format('d/m/Y'),
                'issued_at' => $now->format('d/m/Y H:i'),
                'issued_by' => $user->name,
                'filename' => trim(preg_replace('/[^A-Za-z0-9]+/', '-', $code), '-').'-orcamento-sintetico.'.$format,
            ],
            'pricing' => [
                'bdi_percent' => (string) $schedule->bdi_percent,
                'bdi_method' => $schedule->bdi_components ? 'Fórmula do TCU' : 'Informado',
                'discount_percent' => (string) $schedule->discount_percent,
            ],
            'totals' => $costs['totals'],
            'rows' => $rows,
        ];
    }

    public static function wbsCompare(string $a, string $b): int
    {
        $x = array_map('intval', explode('.', $a));
        $y = array_map('intval', explode('.', $b));
        for ($i = 0; $i < min(count($x), count($y)); $i++) {
            if ($x[$i] !== $y[$i]) {
                return $x[$i] <=> $y[$i];
            }
        }

        return count($x) <=> count($y);
    }
}
