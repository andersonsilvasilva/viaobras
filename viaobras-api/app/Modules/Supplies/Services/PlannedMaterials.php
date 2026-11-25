<?php

namespace App\Modules\Supplies\Services;

use App\Models\Project;
use App\Models\PurchaseRequestItem;
use App\Models\Resource;
use App\Models\Schedule;
use App\Models\ScheduleTask;
use App\Models\ScheduleTaskItem;
use App\Modules\Budgets\Support\Dec;
use Illuminate\Support\Collection;

/**
 * Comparação INFORMATIVA entre o planejamento e os pedidos (D-P102), por atividade da obra: quanto o planejamento
 * prevê de cada material do catálogo (quantidade da atividade × consumo; atividade sem quantidade conta como 1) e
 * quanto já foi pedido. Conta como pedido o que está pendente, aprovado ou atendido (a quantidade aprovada, quando
 * houver). Só entram itens do catálogo com a MESMA unidade; nada é bloqueado.
 */
final class PlannedMaterials
{
    private const COUNTED = ['pending', 'approved', 'received'];

    /**
     * @return list<array{id: int, wbs: string, name: string, kind: string, materials: list<array{resource_uuid: string, description: string, unit_code: string, planned: string, requested: string}>}>
     */
    public function forProject(Project $project): array
    {
        $schedule = Schedule::query()->where('project_id', $project->id)->first();
        if ($schedule === null) {
            return [];
        }

        $tasks = ScheduleTask::query()->where('schedule_id', $schedule->id)->get()
            ->sort(fn ($a, $b) => version_compare($a->wbs_code, $b->wbs_code))->values();

        $planned = ScheduleTaskItem::query()->where('schedule_id', $schedule->id)->where('source', 'catalog')->where('kind', 'material')
            ->orderBy('sort_order')->orderBy('id')->get()->groupBy('task_id');
        $requested = $this->requested($tasks->modelKeys());

        return $tasks->map(fn (ScheduleTask $task) => [
            'id' => $task->id, 'wbs' => $task->wbs_code, 'name' => $task->name, 'kind' => $task->kind,
            'materials' => $this->materials($task, $planned->get($task->id, collect()), $requested),
        ])->all();
    }

    private function materials(ScheduleTask $task, Collection $items, array $requested): array
    {
        return $items->groupBy(fn (ScheduleTaskItem $i) => ($i->source_ref['resource_uuid'] ?? '').'|'.$i->unit_code)
            ->map(function (Collection $same) use ($task, $requested) {
                $first = $same->first();
                $uuid = (string) ($first->source_ref['resource_uuid'] ?? '');
                $quantity = (string) ($task->quantity ?? '1');
                $planned = Dec::add(...$same->map(fn ($i) => Dec::mul($quantity, (string) $i->quantity_per_unit))->all());

                return [
                    'resource_uuid' => $uuid, 'description' => $first->description, 'unit_code' => $first->unit_code,
                    'planned' => Dec::round($planned, 4),
                    'requested' => Dec::round($requested["{$task->id}|{$uuid}|{$first->unit_code}"] ?? '0', 4),
                ];
            })->values()->all();
    }

    /**
     * @param  array<int, int>  $taskIds
     * @return array<string, string> "atividade|uuid do material|unidade" => quantidade pedida
     */
    private function requested(array $taskIds): array
    {
        $items = PurchaseRequestItem::query()->whereIn('task_id', $taskIds)->whereNotNull('resource_id')
            ->whereHas('request', fn ($q) => $q->whereIn('status', self::COUNTED))
            ->get(['task_id', 'resource_id', 'unit_code', 'quantity', 'approved_quantity']);
        $uuids = Resource::withTrashed()->whereIn('id', $items->pluck('resource_id')->unique())->pluck('uuid', 'id');

        $totals = [];
        foreach ($items as $item) {
            $key = "{$item->task_id}|{$uuids[$item->resource_id]}|{$item->unit_code}";
            $totals[$key] = Dec::add($totals[$key] ?? '0', (string) ($item->approved_quantity ?? $item->quantity));
        }

        return $totals;
    }
}
