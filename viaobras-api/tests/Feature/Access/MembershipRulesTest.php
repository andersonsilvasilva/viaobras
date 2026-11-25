<?php

use App\Enums\MembershipStatus;
use App\Models\Project;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Models\UserProjectAccess;
use App\Modules\Tenancy\TenantContext;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Support\Browser;
use Tests\Support\Concerns;
use Tests\Support\Fx;
use Tests\Support\Scenario;

/** Regras da tela "Membros e permissões" (MEMBROS_PERMISSOES_MODELO.md, D-P132…D-P137). */
beforeEach(function () {
    RateLimiter::clear('login');
    Scenario::catalog();
    $this->A = Scenario::tenant();
    $this->B = Scenario::tenant();
    $this->admin = Scenario::member($this->A, 'admin');
    $this->otherAdmin = Scenario::member($this->A, 'admin');
    $this->colleague = Scenario::member($this->A, 'viewer');

    // gestor de pessoas que NÃO é administrador
    $manager = Concerns::role($this->A, 'Gestor de pessoas', ['tenant.view', 'members.view', 'members.manage', 'roles.view', 'roles.manage']);
    $this->manager = Scenario::member($this->A, 'viewer');
    app(TenantContext::class)->run($this->A, fn () => $this->manager->assignRole($manager), $this->manager);

    $this->browserFor = function (User $user): Browser {
        $browser = new Browser($this);
        $browser->login($user->email)->assertOk();

        return $browser;
    };
});

function memberId(Tenant $tenant, User $user): int
{
    return TenantUser::query()->where('tenant_id', $tenant->id)->where('user_id', $user->id)->value('id');
}

function tenantRoleId(Tenant $tenant, string $name): int
{
    return Role::query()->forTenant($tenant->id)->where('name', $name)->value('id');
}

function membershipStatus(Tenant $tenant, User $user): MembershipStatus
{
    return TenantUser::query()->where('tenant_id', $tenant->id)->where('user_id', $user->id)->firstOrFail()->membership_status;
}

function namesOfRoles(Tenant $tenant, User $user): array
{
    return app(TenantContext::class)->run($tenant, fn () => User::query()->findOrFail($user->id)->roles()->pluck('name')->sort()->values()->all());
}

it('D-P132: ninguém suspende, remove ou muda os papéis da própria conta', function () {
    $browser = ($this->browserFor)($this->admin);
    $own = memberId($this->A, $this->admin);

    $browser->post("/api/v1/members/{$own}/suspend")->assertConflict()->assertJsonPath('error.code', 'self_action');
    $browser->delete("/api/v1/members/{$own}")->assertConflict()->assertJsonPath('error.code', 'self_action');
    $browser->post("/api/v1/members/{$own}/roles", ['role_id' => tenantRoleId($this->A, 'viewer')])->assertConflict()->assertJsonPath('error.code', 'self_action');
    $browser->delete("/api/v1/members/{$own}/roles/".tenantRoleId($this->A, 'admin'))->assertConflict()->assertJsonPath('error.code', 'self_action');

    expect(membershipStatus($this->A, $this->admin))->toBe(MembershipStatus::Active)
        ->and(namesOfRoles($this->A, $this->admin))->toBe(['admin']);
});

it('D-P133: quem não é administrador não suspende, remove nem retira papel de um administrador', function () {
    $browser = ($this->browserFor)($this->manager);
    $target = memberId($this->A, $this->otherAdmin);

    $browser->post("/api/v1/members/{$target}/suspend")->assertForbidden()->assertJsonPath('error.code', 'admin_only');
    $browser->delete("/api/v1/members/{$target}")->assertForbidden()->assertJsonPath('error.code', 'admin_only');
    $browser->delete("/api/v1/members/{$target}/roles/".tenantRoleId($this->A, 'admin'))->assertForbidden()->assertJsonPath('error.code', 'admin_only');

    expect(membershipStatus($this->A, $this->otherAdmin))->toBe(MembershipStatus::Active)
        ->and(namesOfRoles($this->A, $this->otherAdmin))->toBe(['admin']);
});

it('D-P133: reativar um administrador suspenso também exige ser administrador', function () {
    $target = memberId($this->A, $this->otherAdmin);
    ($this->browserFor)($this->admin)->post("/api/v1/members/{$target}/suspend")->assertOk();

    ($this->browserFor)($this->manager)->post("/api/v1/members/{$target}/reactivate")->assertForbidden()->assertJsonPath('error.code', 'admin_only');
    expect(membershipStatus($this->A, $this->otherAdmin))->toBe(MembershipStatus::Suspended);

    ($this->browserFor)($this->admin)->post("/api/v1/members/{$target}/reactivate")->assertOk();
    expect(membershipStatus($this->A, $this->otherAdmin))->toBe(MembershipStatus::Active);
});

it('o gestor continua agindo sobre quem não é administrador', function () {
    $browser = ($this->browserFor)($this->manager);
    $target = memberId($this->A, $this->colleague);

    $browser->post("/api/v1/members/{$target}/suspend")->assertOk();
    $browser->post("/api/v1/members/{$target}/reactivate")->assertOk();
    $browser->delete("/api/v1/members/{$target}/roles/".tenantRoleId($this->A, 'viewer'))->assertNoContent();

    expect(namesOfRoles($this->A, $this->colleague))->toBe([]);
});

it('D-P134: retirar um papel exige possuir as permissões dele', function () {
    $strong = Concerns::role($this->A, 'Aprovador', ['tenant.view', 'budgets.approve']);
    app(TenantContext::class)->run($this->A, fn () => $this->colleague->assignRole($strong), $this->colleague);
    $url = '/api/v1/members/'.memberId($this->A, $this->colleague).'/roles/'.$strong->id;

    ($this->browserFor)($this->manager)->delete($url)->assertForbidden()->assertJsonPath('error.code', 'privilege_escalation');
    expect(namesOfRoles($this->A, $this->colleague))->toBe(['Aprovador', 'viewer']);

    ($this->browserFor)($this->admin)->delete($url)->assertNoContent();
    expect(namesOfRoles($this->A, $this->colleague))->toBe(['viewer']);
});

it('D-P135: o nome do papel aceita acentos; símbolos continuam recusados', function () {
    $browser = ($this->browserFor)($this->admin);

    $id = $browser->post('/api/v1/roles', ['name' => 'Orçamentista de Obras', 'permissions' => ['budgets.view']])->assertCreated()->json('data.id');
    $browser->put("/api/v1/roles/{$id}", ['name' => 'Gerência técnica 2'])->assertOk()->assertJsonPath('data.name', 'Gerência técnica 2');

    foreach (['<script>', 'a/b', 'nome; drop', "quebra\nlinha"] as $invalid) {
        $browser->post('/api/v1/roles', ['name' => $invalid, 'permissions' => []])->assertUnprocessable();
    }
});

it('D-P135: não é possível criar um papel que se confunda com o de administrador', function () {
    ($this->browserFor)($this->admin)->post('/api/v1/roles', ['name' => 'Ádmin', 'permissions' => []])->assertUnprocessable();
});

it('D-P137: mostra as obras do membro, só as que quem consulta também pode ver', function () {
    $company = Fx::company($this->A->id);
    $visible = Project::query()->withoutGlobalScopes()->findOrFail(Fx::project($this->A->id, $company, $this->admin->id, 'DEMO-OBRA-1', ['name' => 'DEMO Visível']));
    $hidden = Project::query()->withoutGlobalScopes()->findOrFail(Fx::project($this->A->id, $company, $this->admin->id, 'DEMO-OBRA-2', ['name' => 'DEMO Reservada']));
    $viewer = Scenario::member($this->A, 'member'); // projects.view, só vê as obras com acesso
    app(TenantContext::class)->run($this->A, function () use ($visible, $hidden, $viewer) {
        UserProjectAccess::create(['user_id' => $this->colleague->id, 'project_id' => $visible->id, 'access_level' => 'edit']);
        UserProjectAccess::create(['user_id' => $this->colleague->id, 'project_id' => $hidden->id, 'access_level' => 'view']);
        UserProjectAccess::create(['user_id' => $viewer->id, 'project_id' => $visible->id, 'access_level' => 'view']);
    });
    $url = '/api/v1/members/'.memberId($this->A, $this->colleague).'/projects';

    $asAdmin = ($this->browserFor)($this->admin)->get($url)->assertOk()->json('data');
    expect($asAdmin['all'])->toBeFalse()->and(collect($asAdmin['projects'])->pluck('name')->sort()->values()->all())->toBe(['DEMO Reservada', 'DEMO Visível']);

    $asMember = ($this->browserFor)($viewer)->get($url)->assertOk()->json('data.projects');
    expect(collect($asMember)->pluck('name')->all())->toBe(['DEMO Visível'])
        ->and($asMember[0]['access_level'])->toBe('edit');

    // quem gerencia obras vê todas
    ($this->browserFor)($this->admin)->get('/api/v1/members/'.memberId($this->A, $this->otherAdmin).'/projects')->assertOk()->assertJsonPath('data.all', true);
});

it('D-P137: vínculo de outra organização responde 404, e sem members.view responde 403', function () {
    $adminB = Scenario::member($this->B, 'admin');

    ($this->browserFor)($this->admin)->get('/api/v1/members/'.memberId($this->B, $adminB).'/projects')->assertNotFound();
    ($this->browserFor)($this->colleague)->get('/api/v1/members/'.memberId($this->A, $this->admin).'/projects')->assertForbidden();
});
