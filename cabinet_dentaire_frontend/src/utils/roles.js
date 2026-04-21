/**
 * utils/roles.js
 * ================
 * Constantes et helpers pour la gestion des rôles.
 *
 * Les valeurs correspondent exactement aux choix définis dans :
 *   auth_service/auth_app/models.py → UserRole.choices
 *     ADMIN          = "admin"
 *     DENTISTE       = "dentiste"
 *     RECEPTIONNISTE = "receptionniste"
 */

// ── Constantes ────────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN:          "admin",
  DENTISTE:       "dentiste",
  RECEPTIONNISTE: "receptionniste",
};

/** Labels français pour affichage UI. */
export const ROLE_LABELS = {
  [ROLES.ADMIN]:          "Administrateur",
  [ROLES.DENTISTE]:       "Dentiste",
  [ROLES.RECEPTIONNISTE]: "Réceptionniste",
};

// ── Helpers de vérification ───────────────────────────────────────────────────

/**
 * Retourne le rôle depuis l'objet user (issu de localStorage via token.js).
 *
 * @param {Object|null} user
 * @returns {string} rôle ou ""
 */
export const getRole = (user) => user?.role ?? "";

/** @param {Object|null} user */
export const isAdmin          = (user) => getRole(user) === ROLES.ADMIN;
export const isDentiste       = (user) => getRole(user) === ROLES.DENTISTE;
export const isReceptionniste = (user) => getRole(user) === ROLES.RECEPTIONNISTE;

/** Retourne true si l'utilisateur a au moins un des rôles listés. */
export const hasRole = (user, ...roles) => roles.includes(getRole(user));

/** Retourne true si l'utilisateur peut accéder à une ressource patient. */
export const canAccessPatients = (user) =>
  hasRole(user, ROLES.DENTISTE, ROLES.RECEPTIONNISTE, ROLES.ADMIN);

/** Retourne true si l'utilisateur peut valider (accepter/refuser). */
export const canValidate = (user) =>
  hasRole(user, ROLES.DENTISTE, ROLES.ADMIN);

/** Retourne true si l'utilisateur peut créer des comptes (admin seulement). */
export const canManageUsers = (user) => isAdmin(user);

// ── Routing par rôle ──────────────────────────────────────────────────────────

/**
 * Retourne la route du dashboard selon le rôle.
 * Utilisé après login pour rediriger vers la bonne page.
 *
 * @param {Object|null} user
 * @returns {string} path React Router
 */
export const getDashboardPath = (user) => {
  switch (getRole(user)) {
    case ROLES.ADMIN:          return "/admin/dashboard";
    case ROLES.DENTISTE:       return "/dentiste/dashboard";
    case ROLES.RECEPTIONNISTE: return "/receptionniste/dashboard";
    default:                   return "/login";
  }
};

/**
 * Retourne les routes autorisées selon le rôle.
 * Utilisé dans ProtectedRoute pour vérifier l'accès.
 */
export const ALLOWED_ROUTES = {
  [ROLES.ADMIN]: [
    "/admin",
  ],
  [ROLES.DENTISTE]: [
    "/dentiste",
  ],
  [ROLES.RECEPTIONNISTE]: [
    "/receptionniste",
  ],
};

/**
 * Vérifie si un chemin est accessible pour un rôle donné.
 *
 * @param {string} path   - chemin actuel (ex: "/dentiste/patients")
 * @param {Object} user   - objet user
 * @returns {boolean}
 */
export const isRouteAllowed = (path, user) => {
  const role    = getRole(user);
  const allowed = ALLOWED_ROUTES[role] ?? [];
  return allowed.some((prefix) => path.startsWith(prefix));
};