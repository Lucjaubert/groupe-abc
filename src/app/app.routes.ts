import { Routes } from '@angular/router';

/* =========================
   FR — canoniques
   ========================= */
const frRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/homepage/homepage.component').then(m => m.HomepageComponent),
    title: 'Expertise immobilière nationale – Valeur vénale & locative certifiée',
  },
  {
    path: 'expert-immobilier-reseau-national',
    loadComponent: () =>
      import('./pages/about/about.component').then(m => m.AboutComponent),
    title: 'Réseau national d’experts immobiliers agréés',
  },
  {
    path: 'expertise-immobiliere-services',
    loadComponent: () =>
      import('./pages/services/services.component').then(m => m.ServicesComponent),
    title: 'Services d’expertise immobilière – Valeur vénale et locative',
  },

  /* ✅ FR (PARENT + CHILD) */
  {
    path: 'methodes-evaluation-immobiliere',
    loadComponent: () =>
      import('./pages/methods/methods.component').then(m => m.MethodsComponent),
    title: 'Méthodes d’évaluation immobilière – Approches et calculs de valeur',
    children: [
      {
        path: ':slug',
        loadComponent: () =>
          import('./pages/methods-asset/methods-asset.component').then(m => m.MethodsAssetComponent),
        title: 'Actif immobilier – Groupe ABC',
      },
    ],
  },

  {
    path: 'experts-immobiliers-agrees',
    loadComponent: () =>
      import('./pages/team/team.component').then(m => m.TeamComponent),
    title: 'Équipe d’experts immobiliers agréés – Compétences et déontologie',
  },
  {
    path: 'actualites-expertise-immobiliere',
    loadComponent: () => import('./pages/news/news.component').then(m => m.NewsComponent),
    title: 'Actualités de l’expertise immobilière – Marché, valeur vénale et réglementation',
  },
  {
    path: 'actualites-expertise-immobiliere/:slug',
    loadComponent: () =>
      import('./pages/news-detail/news-detail.component').then(m => m.NewsDetailComponent),
    title: 'Actualité immobilière – Groupe ABC',
  },
  {
    path: 'contact-expert-immobilier',
    loadComponent: () =>
      import('./pages/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact – Expertise immobilière certifiée en France et Outre-mer',
  },
  {
    path: 'mentions-legales',
    loadComponent: () =>
      import('./pages/legal-mentions/mentions-legales.component').then(m => m.MentionsLegalesComponent),
    title: 'Mentions légales',
  },
];

/* ===========================================
   FR — redirections historiques
   ✅ je te conseille de les mettre AVANT frRoutes (optionnel mais propre)
   =========================================== */
const frLegacyRedirects: Routes = [
  { path: 'accueil', redirectTo: '', pathMatch: 'full' },
  { path: 'actualite', redirectTo: 'actualites-expertise-immobiliere', pathMatch: 'full' },
  { path: 'biens-et-methodes', redirectTo: 'methodes-evaluation-immobiliere', pathMatch: 'full' },
  { path: 'contact', redirectTo: 'contact-expert-immobilier', pathMatch: 'full' },
  { path: 'equipe', redirectTo: 'experts-immobiliers-agrees', pathMatch: 'full' },
  { path: 'equipes', redirectTo: 'experts-immobiliers-agrees', pathMatch: 'full' },
  { path: 'qui-sommes-nous', redirectTo: 'expert-immobilier-reseau-national', pathMatch: 'full' },
  { path: 'services', redirectTo: 'expertise-immobiliere-services', pathMatch: 'full' },

  { path: 'actualites/:slug', redirectTo: 'actualites-expertise-immobiliere/:slug', pathMatch: 'full' },

  { path: 'assets-methods/:slug', redirectTo: 'methodes-evaluation-immobiliere/:slug', pathMatch: 'full' },
  { path: 'assets-methods', redirectTo: 'methodes-evaluation-immobiliere', pathMatch: 'full' },
];

/* ===========================================
   EN — redirections historiques (dans le scope /en)
   =========================================== */
const enLegacyRedirects: Routes = [
  // anciennes URLs EN simples
  { path: 'news', redirectTo: 'real-estate-valuation-news', pathMatch: 'full' },
  { path: 'news/:slug', redirectTo: 'real-estate-valuation-news/:slug', pathMatch: 'full' },
  { path: 'contact', redirectTo: 'contact-chartered-valuers', pathMatch: 'full' },
  { path: 'services', redirectTo: 'real-estate-valuation-services', pathMatch: 'full' },
  { path: 'team', redirectTo: 'chartered-valuers-team', pathMatch: 'full' },
  { path: 'teams', redirectTo: 'chartered-valuers-team', pathMatch: 'full' },
  { path: 'assets-methods', redirectTo: 'valuation-methods-assets', pathMatch: 'full' },
  { path: 'assets-methods/:slug', redirectTo: 'valuation-methods-assets/:slug', pathMatch: 'full' },

  { path: 'chartered-valuation-experts', redirectTo: 'chartered-valuers-team', pathMatch: 'full' },
  { path: 'contact-real-estate-valuation', redirectTo: 'contact-chartered-valuers', pathMatch: 'full' },

  // anciennes URLs FR sous /en
  { path: 'actualites', redirectTo: 'real-estate-valuation-news', pathMatch: 'full' },
  { path: 'actualites/:slug', redirectTo: 'real-estate-valuation-news/:slug', pathMatch: 'full' },

  { path: 'actualites-expertise-immobiliere', redirectTo: 'real-estate-valuation-news', pathMatch: 'full' },
  { path: 'actualites-expertise-immobiliere/:slug', redirectTo: 'real-estate-valuation-news/:slug', pathMatch: 'full' },

  { path: 'biens-et-methodes', redirectTo: 'valuation-methods-assets', pathMatch: 'full' },

  // ✅ IMPORTANT : ajoute aussi la variante FR “methodes-evaluation-immobiliere/:slug” sous /en si tu veux la supporter
  { path: 'methodes-evaluation-immobiliere', redirectTo: 'valuation-methods-assets', pathMatch: 'full' },
  { path: 'methodes-evaluation-immobiliere/:slug', redirectTo: 'valuation-methods-assets/:slug', pathMatch: 'full' },

  { path: 'equipe', redirectTo: 'chartered-valuers-team', pathMatch: 'full' },
  { path: 'experts-immobiliers-agrees', redirectTo: 'chartered-valuers-team', pathMatch: 'full' },
  { path: 'contact-expert-immobilier', redirectTo: 'contact-chartered-valuers', pathMatch: 'full' },

  { path: 'expert-immobilier-reseau-national', redirectTo: 'expert-network-chartered-valuers', pathMatch: 'full' },
  { path: 'expertise-immobiliere-services', redirectTo: 'real-estate-valuation-services', pathMatch: 'full' },
];

/* =========================
   EN — canoniques
   ========================= */
const enRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/homepage/homepage.component').then(m => m.HomepageComponent),
    title: 'National real estate valuation — Market & rental value',
  },
  {
    path: 'expert-network-chartered-valuers',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    title: 'National network of chartered real estate valuation experts',
  },
  {
    path: 'real-estate-valuation-services',
    loadComponent: () =>
      import('./pages/services/services.component').then(m => m.ServicesComponent),
    title: 'Real estate valuation services — Market & rental value',
  },

  /* ✅ EN (PARENT + CHILD) */
  {
    path: 'valuation-methods-assets',
    loadComponent: () =>
      import('./pages/methods/methods.component').then(m => m.MethodsComponent),
    title: 'Valuation methods & assets — Approaches & calculations',
    children: [
      {
        path: ':slug',
        loadComponent: () =>
          import('./pages/methods-asset/methods-asset.component').then(m => m.MethodsAssetComponent),
        title: 'Asset – Groupe ABC',
      },
    ],
  },

  {
    path: 'chartered-valuers-team',
    loadComponent: () => import('./pages/team/team.component').then(m => m.TeamComponent),
    title: 'Chartered valuers team — Skills & ethics',
  },
  {
    path: 'real-estate-valuation-news',
    loadComponent: () => import('./pages/news/news.component').then(m => m.NewsComponent),
    title: 'Real estate valuation news — Market, value & regulation',
  },
  {
    path: 'real-estate-valuation-news/:slug',
    loadComponent: () =>
      import('./pages/news-detail/news-detail.component').then(m => m.NewsDetailComponent),
    title: 'Real estate valuation news – Article',
  },
  {
    path: 'contact-chartered-valuers',
    loadComponent: () =>
      import('./pages/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact chartered valuers — Certified real estate valuation',
  },
  {
    path: 'legal-notice',
    loadComponent: () =>
      import('./pages/legal-mentions/mentions-legales.component').then(m => m.MentionsLegalesComponent),
    title: 'Legal notice',
  },

  // 404 EN dans le scope /en
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: '404 – Page not found',
  },
];

/* =========================
   Routes exportées
   ========================= */
export const routes: Routes = [
  // ✅ je mets les redirects AVANT les canoniques (plus logique, évite les cas tordus)
  ...frLegacyRedirects,
  ...frRoutes,

  // ✅ scope EN propre
  { path: 'en', children: [...enLegacyRedirects, ...enRoutes] },

  // 404 global
  {
    path: '404',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page non trouvée',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page non trouvée',
  },
];

export default routes;
