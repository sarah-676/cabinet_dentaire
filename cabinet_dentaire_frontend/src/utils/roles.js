/**
 * src/utils/roles.js
 * ───────────────────
 * Constantes de rôles et helpers de navigation.
 * Doit correspondre EXACTEMENT aux valeurs retournées par auth_service :
 *   UserRole.ADMIN          = "admin"
 *   UserRole.DENTISTE       = "dentiste"
 *   UserRole.RECEPTIONNISTE = "receptionniste"
 */

export const ROLES = {
  ADMIN:          "admin",
  DENTISTE:       "dentiste",
  RECEPTIONNISTE: "receptionniste",
};

/**
 * Retourne la route home selon le rôle après login.
 * Utilisé dans AuthContext.login() pour rediriger.
 */
export const getHomeRoute = (role) => {
  switch (role) {
    case ROLES.DENTISTE:       return "/dentiste/dashboard";
    case ROLES.RECEPTIONNISTE: return "/receptionniste/dashboard";
    case ROLES.ADMIN:          return "/admin/dashboard";
    default:                   return "/login";
  }
};

/**
 * Retourne le label lisible du rôle.
 */
export const getRoleLabel = (role) => {
  switch (role) {
    case ROLES.ADMIN:          return "Administrateur";
    case ROLES.DENTISTE:       return "Dentiste";
    case ROLES.RECEPTIONNISTE: return "Réceptionniste";
    default:                   return role || "—";
  }
};