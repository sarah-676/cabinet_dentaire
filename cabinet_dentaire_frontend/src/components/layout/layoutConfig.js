import { ROLES } from "../../utils/roles";

export const PAGE_TITLES = {
  "/dentiste/dashboard": "Tableau de bord",
  "/dentiste/patients": "Mes patients",
  "/dentiste/agenda": "Mon agenda",
  "/dentiste/radios": "Radiographies",
  "/dentiste/traitements": "Traitements",
  "/dentiste/ordonnances": "Ordonnances",
  "/dentiste/compte": "Mon compte",
  "/receptionniste/dashboard": "Tableau de bord",
  "/receptionniste/patients": "Patients",
  "/receptionniste/agenda": "Agenda",
  "/receptionniste/compte": "Mon compte",
  "/admin/dashboard": "Tableau de bord",
  "/admin/utilisateurs": "Gestion des utilisateurs",
  "/admin/compte": "Mon compte",
};

export const NAV = {
  [ROLES.DENTISTE]: [
    { to: "/dentiste/dashboard", label: "Tableau de bord", icon: "⊞" },
    { to: "/dentiste/patients", label: "Mes patients", icon: "◉" },
    { to: "/dentiste/agenda", label: "Mon agenda", icon: "◷" },
    { to: "/dentiste/radios", label: "Radiographies", icon: "🩻" },
    { to: "/dentiste/traitements", label: "Traitements", icon: "💉" },
    { to: "/dentiste/ordonnances", label: "Ordonnances", icon: "📋" },
    { to: "/dentiste/compte", label: "Mon compte", icon: "◎" },
  ],
  [ROLES.RECEPTIONNISTE]: [
    { to: "/receptionniste/dashboard", label: "Tableau de bord", icon: "⊞" },
    { to: "/receptionniste/patients", label: "Patients", icon: "◉" },
    { to: "/receptionniste/agenda", label: "Agenda", icon: "◷" },
    { to: "/receptionniste/compte", label: "Mon compte", icon: "◎" },
  ],
  [ROLES.ADMIN]: [
    { to: "/admin/dashboard", label: "Tableau de bord", icon: "⊞" },
    { to: "/admin/utilisateurs", label: "Utilisateurs", icon: "◉" },
    { to: "/admin/compte", label: "Mon compte", icon: "◎" },
  ],
};
