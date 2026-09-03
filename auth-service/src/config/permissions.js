/**
 * Mapeamento RBAC (Role-Based Access Control)
 * Define explicitamente as permissões atribuídas a cada papel (role).
 */
export const ROLES_PERMISSIONS = {
  usuario: [
    'filmes:listar',
    'favoritos:gerenciar_proprio',
    'comentarios:criar',
    'comentarios:listar',
    'comentarios:excluir_proprio'
  ],
  admin: [
    'filmes:listar',
    'favoritos:gerenciar_proprio',
    'comentarios:criar',
    'comentarios:listar',
    'comentarios:excluir_proprio',
    'comentarios:excluir_qualquer'
  ]
};

/**
 * Valida se um papel possui uma determinada permissão.
 * @param {string} role - Papel do usuário ('usuario', 'admin')
 * @param {string} permission - Permissão no formato '<recurso>:<acao>'
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLES_PERMISSIONS[role.toLowerCase()] || [];
  return permissions.includes(permission);
}

/**
 * Retorna todas as permissões concedidas a um papel.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  if (!role) return [];
  return ROLES_PERMISSIONS[role.toLowerCase()] || [];
}
