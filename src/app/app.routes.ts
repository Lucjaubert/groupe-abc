import { Routes } from '@angular/router';

/* =========================
   FR — canoniques
   ========================= */
const frRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/homepage/homepage.component').then(m => m.HomepageComponent),
    title: 'Expertise immobilière nationale – Valeur vénale & locative certifiée',
  },
  {
    path: 'expert-immobilier-reseau-national',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    title: 'Réseau national d’experts immobiliers agréés',
  },
  {
    path: 'expertise-immobiliere-services',
    loadComponent: () => import('./pages/services/services.component').then(m => m.ServicesComponent),
    title: 'Services d’expertise immobilière – Valeur vénale et locative',
  },
  {
    path: 'methodes-evaluation-immobiliere',
    loadComponent: () => import('./pages/methods/methods.component').then(m => m.MethodsComponent),
    title: 'Méthodes d’évaluation immobilière – Approches et calculs de valeur',
  },
  {
    path: 'experts-immobiliers-agrees',
    loadComponent: () => import('./pages/team/team.component').then(m => m.TeamComponent),
    title: 'Équipe d’experts immobiliers agréés – Compétences et déontologie',
  },
  {
    path: 'actualites-expertise-immobiliere',
    loadComponent: () => import('./pages/news/news.component').then(m => m.NewsComponent),
    title: 'Actualités de l’expertise immobilière – Marché, valeur vénale et réglementation',
  },
  {
    path: 'contact-expert-immobilier',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact – Expertise immobilière certifiée en France et Outre-mer',
  },
  {
    path: 'mentions-legales',
    loadComponent: () => import('./pages/legal-mentions/mentions-legales.component').then(m => m.MentionsLegalesComponent),
    title: 'Mentions légales',
  },
];

/* ===========================================
   FR — redirections historiques (client-side)
   =========================================== */
const frLegacyRedirects: Routes = [
  { path: 'accueil',             redirectTo: '',                                   pathMatch: 'full' },
  { path: 'actualite',           redirectTo: 'actualites-expertise-immobiliere',   pathMatch: 'full' },
  { path: 'biens-et-methodes',   redirectTo: 'methodes-evaluation-immobiliere',    pathMatch: 'full' },
  { path: 'contact',             redirectTo: 'contact-expert-immobilier',          pathMatch: 'full' },
  { path: 'equipe',              redirectTo: 'experts-immobiliers-agrees',         pathMatch: 'full' },
  { path: 'qui-sommes-nous',     redirectTo: 'expert-immobilier-reseau-national',  pathMatch: 'full' },
  { path: 'services',            redirectTo: 'expertise-immobiliere-services',     pathMatch: 'full' },
  // 'mentions-legales' est déjà canonique
];

/* =========================
   EN — canoniques (vrais slugs EN)
   ========================= */
const enRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/homepage/homepage.component').then(m => m.HomepageComponent),
    title: 'National real estate valuation — Market & rental value',
  },
  {
    path: 'expert-network-chartered-valuers',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    title: 'National network of chartered real estate valuation experts',
  },
  {
    path: 'real-estate-valuation-services',
    loadComponent: () => import('./pages/services/services.component').then(m => m.ServicesComponent),
    title: 'Real estate valuation services — Market & rental value',
  },
  {
    path: 'assets-methods',
    loadComponent: () => import('./pages/methods/methods.component').then(m => m.MethodsComponent),
    title: 'Valuation methods — Approaches & calculations',
  },
  {
    path: 'chartered-valuation-experts',
    loadComponent: () => import('./pages/team/team.component').then(m => m.TeamComponent),
    title: 'Team of chartered valuation experts — Skills & ethics',
  },
  {
    path: 'news',
    loadComponent: () => import('./pages/news/news.component').then(m => m.NewsComponent),
    title: 'Real estate valuation news — Market, value & regulation',
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact — Certified real estate valuation in France & Overseas',
  },
];

/* ===========================================
   EN — redirections historiques (client-side)
   - anciens slugs EN ou FR-like sous /en → canons EN
   =========================================== */
const enLegacyRedirects: Routes = [
  { path: 'services',                    redirectTo: 'real-estate-valuation-services', pathMatch: 'full' },
  { path: 'actualites',                  redirectTo: 'news',                            pathMatch: 'full' },
  { path: 'biens-et-methodes',           redirectTo: 'assets-methods',                  pathMatch: 'full' },
  { path: 'equipe',                      redirectTo: 'chartered-valuation-experts',     pathMatch: 'full' },
  { path: 'contact-expert-immobilier',   redirectTo: 'contact',                         pathMatch: 'full' },
  { path: 'expert-immobilier-reseau-national', redirectTo: 'expert-network-chartered-valuers', pathMatch: 'full' },
  { path: 'expertise-immobiliere-services',     redirectTo: 'real-estate-valuation-services',  pathMatch: 'full' },
];

/* =========================
   Routes exportées
   ========================= */
export const routes: Routes = [
  ...frRoutes,
  ...frLegacyRedirects,

  {
    path: 'en',
    children: [
      ...enRoutes,
      ...enLegacyRedirects,
    ],
  },

  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page non trouvée',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page non trouvée',
  },
];

export default routes;
