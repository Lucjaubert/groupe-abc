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
    /* ✅ Canonique FR selon SEO */
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
  { path: 'accueil',                   redirectTo: '',                                   pathMatch: 'full' },
  { path: 'actualite',                 redirectTo: 'actualites-expertise-immobiliere',   pathMatch: 'full' },
  { path: 'biens-et-methodes',         redirectTo: 'methodes-evaluation-immobiliere',    pathMatch: 'full' },
  { path: 'contact',                   redirectTo: 'contact-expert-immobilier',          pathMatch: 'full' },
  { path: 'equipe',                    redirectTo: 'experts-immobiliers-agrees',         pathMatch: 'full' },
  { path: 'equipes',                   redirectTo: 'experts-immobiliers-agrees',         pathMatch: 'full' }, // si ancien essai
  { path: 'qui-sommes-nous',           redirectTo: 'expert-immobilier-reseau-national',  pathMatch: 'full' },
  { path: 'services',                  redirectTo: 'expertise-immobiliere-services',     pathMatch: 'full' },
];

/* ===========================================
   EN — redirections historiques (placées AVANT)
   =========================================== */
const enLegacyRedirects: Routes = [
  { path: 'services',                          redirectTo: 'real-estate-valuation-services', pathMatch: 'full' },
  { path: 'actualites',                        redirectTo: 'news',                            pathMatch: 'full' },
  { path: 'actualites-expertise-immobiliere',  redirectTo: 'news',                            pathMatch: 'full' },
  { path: 'biens-et-methodes',                 redirectTo: 'assets-methods',                  pathMatch: 'full' },
  { path: 'methodes-evaluation-immobiliere',   redirectTo: 'assets-methods',                  pathMatch: 'full' },
  { path: 'equipe',                            redirectTo: 'chartered-valuation-experts',     pathMatch: 'full' },
  { path: 'experts-immobiliers-agrees',        redirectTo: 'chartered-valuation-experts',     pathMatch: 'full' },
  { path: 'contact-expert-immobilier',         redirectTo: 'contact',                         pathMatch: 'full' },
  { path: 'expert-immobilier-reseau-national', redirectTo: 'expert-network-chartered-valuers',pathMatch: 'full' },
  { path: 'expertise-immobiliere-services',    redirectTo: 'real-estate-valuation-services',  pathMatch: 'full' },
];

/* =========================
   EN — canoniques
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
  // wildcard EN (dernier dans le sous-arbre /en)
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: '404 – Page not found',
  },
];

/* =========================
   Routes exportées
   ========================= */
export const routes: Routes = [
  // FR
  ...frRoutes,
  ...frLegacyRedirects,

  // EN — redirs d’abord, puis canoniques, puis wildcard
  { path: 'en', children: [ ...enLegacyRedirects, ...enRoutes ] },

  // (optionnel) Garde-fous si quelqu’un tape des slugs FR directement sous /en/ en dehors du child-router
  { path: 'en/experts-immobiliers-agrees',       redirectTo: 'en/chartered-valuation-experts', pathMatch: 'full' },
  { path: 'en/equipe',                           redirectTo: 'en/chartered-valuation-experts', pathMatch: 'full' },
  { path: 'en/biens-et-methodes',                redirectTo: 'en/assets-methods',              pathMatch: 'full' },
  { path: 'en/methodes-evaluation-immobiliere',  redirectTo: 'en/assets-methods',              pathMatch: 'full' },
  { path: 'en/actualites',                       redirectTo: 'en/news',                        pathMatch: 'full' },
  { path: 'en/actualites-expertise-immobiliere', redirectTo: 'en/news',                        pathMatch: 'full' },

  // 404 global
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
