<?php

namespace App\Modules\Access\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Role;
use App\Models\TenantUser;
use App\Models\User;
use App\Models\UserProjectAccess;
use App\Modules\Access\Services\MembershipService;
use App\Modules\Access\Services\PrivilegeGuard;
use App\Modules\Projects\Services\ProjectAccess;
use App\Modules\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MemberController extends Controller
{
    public function __construct(private readonly MembershipService $members, private readonly TenantContext $context) {}

    public function index(): JsonResponse
    {
        $tenantId = $this->context->idOrFail();

        $memberships = TenantUser::query()->where('tenant_id', $tenantId)->orderBy('id')->get();
        $users = User::query()->whereIn('id', $memberships->pluck('user_id'))->get()->keyBy('id');

        $roles = DB::table('model_has_roles')
            ->join('roles', function ($j): void {
                $j->on('roles.id', '=', 'model_has_roles.role_id')->on('roles.tenant_id', '=', 'model_has_roles.tenant_id');
            })
            ->where('model_has_roles.tenant_id', $tenantId)
            ->get(['model_has_roles.model_id', 'roles.id as role_id', 'roles.name'])
            ->groupBy('model_id');

        return response()->json(['data' => $memberships->map(fn (TenantUser $m) => [
            'id' => $m->getKey(),
            'user' => ['uuid' => $users[$m->user_id]->uuid, 'name' => $users[$m->user_id]->name, 'email' => $users[$m->user_id]->email],
            'status' => $m->membership_status->value,
            'joined_at' => $m->joined_at?->toIso8601String(),
            'roles' => ($roles[$m->user_id] ?? collect())->map(fn ($r) => ['id' => $r->role_id, 'name' => $r->name])->values(),
        ])->values()]);
    }

    /** Obras do membro, só para leitura (D-P137). Mostra apenas as que QUEM CONSULTA também pode ver (D-P24). */
    public function projects(Request $request, int $id, ProjectAccess $access, PrivilegeGuard $privileges): JsonResponse
    {
        $target = User::query()->findOrFail($this->find($id)->user_id);
        // quem gerencia obras vê todas, sem precisar de acesso por obra
        $all = $privileges->holds($target, $this->context->tenantOrFail(), 'projects.manage');

        $levels = UserProjectAccess::query()->where('user_id', $target->getKey())->pluck('access_level', 'project_id');
        $projects = $access->visible(Project::query(), $request->user())
            ->whereIn('projects.id', $levels->keys())->orderBy('code')->get(['projects.id', 'uuid', 'code', 'name']);

        return response()->json(['data' => [
            'all' => $all,
            'projects' => $projects->map(fn (Project $p) => ['uuid' => $p->uuid, 'code' => $p->code, 'name' => $p->name, 'access_level' => $levels[$p->id]])->values(),
        ]]);
    }

    public function suspend(Request $request, int $id): JsonResponse
    {
        $m = $this->members->suspend($request->user(), $this->context->tenantOrFail(), $this->find($id));

        return response()->json(['data' => ['id' => $m->getKey(), 'status' => $m->membership_status->value]]);
    }

    public function reactivate(Request $request, int $id): JsonResponse
    {
        $m = $this->members->reactivate($request->user(), $this->context->tenantOrFail(), $this->find($id));

        return response()->json(['data' => ['id' => $m->getKey(), 'status' => $m->membership_status->value]]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->members->remove($request->user(), $this->context->tenantOrFail(), $this->find($id));

        return response()->json(null, 204);
    }

    public function assignRole(Request $request, int $id): JsonResponse
    {
        $request->validate(['role_id' => ['required', 'integer']]);
        $role = Role::query()->forTenant($this->context->idOrFail())->findOrFail($request->integer('role_id'));

        $changed = $this->members->assignRole($request->user(), $this->context->tenantOrFail(), $this->find($id), $role);

        return response()->json(['data' => ['changed' => $changed]], $changed ? 201 : 200);
    }

    public function revokeRole(Request $request, int $id, int $roleId): JsonResponse
    {
        $role = Role::query()->forTenant($this->context->idOrFail())->findOrFail($roleId);

        $this->members->revokeRole($request->user(), $this->context->tenantOrFail(), $this->find($id), $role);

        return response()->json(null, 204);
    }

    /** Vínculo DO TENANT ATIVO; de outro tenant ⇒ 404 (mesma resposta de inexistente). */
    private function find(int $id): TenantUser
    {
        return TenantUser::query()->where('tenant_id', $this->context->idOrFail())->findOrFail($id);
    }
}
