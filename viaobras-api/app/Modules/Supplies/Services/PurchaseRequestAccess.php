<?php

namespace App\Modules\Supplies\Services;

use App\Models\Project;
use App\Models\PurchaseRequest;
use App\Models\User;
use App\Modules\Projects\Services\ProjectAccess;
use Illuminate\Database\Eloquent\Builder;

/**
 * Quem pode o quê nas solicitações de materiais (FASE7A_MODELO.md §2 e §5): permissão do módulo E acesso por obra
 * (D-P24). Ver exige `supplies.view` e ver a obra; qualquer escrita exige também nível `edit` na obra.
 *  - criar: `supplies.request`;
 *  - editar, excluir, enviar e anexar: quem criou (com `supplies.request`) ou quem tem `supplies.approve`;
 *  - cancelar: rascunho ou pendente, os mesmos acima; aprovada, só `supplies.approve`;
 *  - aprovar, devolver, recusar, desfazer e marcar como atendida: `supplies.approve`.
 * Solicitação que o usuário não pode ver → 404 (não revela existência). As checagens passam por $user->can(), que
 * respeita as abilities do token (D-29).
 */
final class PurchaseRequestAccess
{
    public function __construct(private readonly ProjectAccess $projects) {}

    public function canView(User $user, PurchaseRequest $request): bool
    {
        return $user->can('supplies.view') && $this->onProject($user, $request->project_id, 'view');
    }

    public function canCreate(User $user, Project $project): bool
    {
        return $user->can('supplies.request') && $this->projects->allows($user, $project, 'edit');
    }

    /** Editar, excluir, enviar e anexar (a situação é conferida pelas regras do serviço e do fluxo). */
    public function canChange(User $user, PurchaseRequest $request): bool
    {
        return $this->onProject($user, $request->project_id, 'edit') && $this->ownsOrApproves($user, $request);
    }

    public function canRun(User $user, PurchaseRequest $request, string $action): bool
    {
        if (! $this->onProject($user, $request->project_id, 'edit')) {
            return false;
        }

        return match ($action) {
            'submit' => $this->ownsOrApproves($user, $request),
            'cancel' => $request->status === 'approved' ? $user->can('supplies.approve') : $this->ownsOrApproves($user, $request),
            default => $user->can('supplies.approve'),
        };
    }

    /**
     * O que mostrar na tela: o que a situação permite E o usuário pode fazer (a API confere de novo).
     *
     * @return array{edit: bool, delete: bool, attach: bool, actions: list<string>}
     */
    public function abilities(User $user, PurchaseRequest $request): array
    {
        $change = $this->canChange($user, $request);

        return [
            'edit' => $change && $request->isDraft(),
            'delete' => $change && $request->isDraft() && $request->submitted_at === null,
            'attach' => $change,
            'actions' => array_values(array_filter(
                PurchaseRequestWorkflow::actionsFrom($request->status),
                fn (string $action) => $this->canRun($user, $request, $action),
            )),
        ];
    }

    /** Restringe a consulta às solicitações visíveis. */
    public function visible(Builder $query, User $user): Builder
    {
        if (! $user->can('supplies.view')) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('purchase_requests.project_id', $this->projects->visible(Project::query(), $user)->select('projects.id'));
    }

    /** Quantas pendentes esperam decisão deste usuário (número do menu, D-P109). */
    public function awaitingApproval(User $user): int
    {
        if (! $user->can('supplies.approve') || ! $user->can('supplies.view')) {
            return 0;
        }

        return $this->visible(PurchaseRequest::query(), $user)->where('status', 'pending')
            ->with('project')->get()
            ->groupBy('project_id')
            ->filter(fn ($requests) => $this->onProject($user, $requests->first()->project_id, 'edit'))
            ->sum(fn ($requests) => $requests->count());
    }

    private function ownsOrApproves(User $user, PurchaseRequest $request): bool
    {
        return $user->can('supplies.approve')
            || ($user->can('supplies.request') && (int) $request->requester_id === (int) $user->getKey());
    }

    private function onProject(User $user, int $projectId, string $level): bool
    {
        $project = Project::query()->find($projectId);

        return $project !== null && $this->projects->allows($user, $project, $level);
    }
}
