/** Marca de tela do administrador da plataforma: vem de `is_platform_admin`, nunca das permissões da organização. */
export const PLATFORM_ADMIN = 'platform.admin'

export function permissionsOf(me: { permissions: string[] | null; is_platform_admin?: boolean } | null | undefined): Set<string> {
  const permissions = new Set((me?.permissions ?? []).filter((p) => p !== PLATFORM_ADMIN))
  if (me?.is_platform_admin) permissions.add(PLATFORM_ADMIN)
  return permissions
}
