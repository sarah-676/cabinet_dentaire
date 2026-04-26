/**
 * src/utils/roles.js
 * ───────────────────
 * Constantes de rôles + helpers de vérification.
 * Synchronisé avec auth_service/auth_app/models.py UserRole.
 */

export const ROLES = {
  ADMIN:           "admin",
  DENTISTE:        "dentiste",
  RECEPTIONNISTE:  "receptionniste",
};

export const isDentiste       = (user) => user?.role === ROLES.DENTISTE;
export const isAdmin          = (user) => user?.role === ROLES.ADMIN;
export const isReceptionniste = (user) => user?.role === ROLES.RECEPTIONNISTE;

/** Retourne la route home selon le rôle après login */
export const getHomeRoute = (role) => {
  switch (role) {
    case ROLES.DENTISTE:       return "/dentiste/dashboard";
    case ROLES.RECEPTIONNISTE: return "/receptionniste/dashboard";
    case ROLES.ADMIN:          return "/admin/dashboard";
    default:                   return "/login";
  }
};

/** Label lisible du rôle */
export const getRoleLabel = (role) => {
  switch (role) {
    case ROLES.DENTISTE:       return "Dentiste";
    case ROLES.RECEPTIONNISTE: return "Réceptionniste";
    case ROLES.ADMIN:          return "Administrateur";
    default:                   return "Utilisateur";
  }
};

