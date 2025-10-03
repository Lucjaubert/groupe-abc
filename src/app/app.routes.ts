import { Routes } from '@angular/router';

/** Routes « pages » (sans 404 / wildcard) réutilisées pour FR et EN */
const pageRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/homepage/homepage.component').then(m => m.HomepageComponent),
    pathMatch: 'full',
    title: 'Groupe-ABC – Accueil'
  },
  {
    path: 'qui-sommes-nous',
    loadComponent: () =>
      import('./pages/about/about.component').then(m => m.AboutComponent),
    title: 'Qui sommes-nous ? – Groupe ABC'
  },
  {
    path: 'nos-services',
    loadComponent: () =>
      import('./pages/services/services.component').then(m => m.ServicesComponent),
    title: 'Nos services – Groupe ABC'
  },
  {
    path: 'biens-et-methodes',
    loadComponent: () =>
      import('./pages/methods/methods.component').then(m => m.MethodsComponent),
    title: 'Biens & Méthodes – Groupe ABC'
  },
  {
    path: 'notre-equipe',
    loadComponent: () =>
      import('./pages/team/team.component').then(m => m.TeamComponent),
    title: 'Équipe – Groupe ABC'
  },
  {
    path: 'actualites',
    loadComponent: () =>
      import('./pages/news/news.component').then(m => m.NewsComponent),
    title: 'Actualités – Groupe ABC'
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact – Groupe ABC'
  },
  {
    path: 'mentions-legales',
    loadComponent: () =>
      import('./pages/legal-mentions/mentions-legales.component').then(m => m.MentionsLegalesComponent),
    title: 'Mentions légales'
  }
];

export const routes: Routes = [

  ...pageRoutes,


  {
    path: 'en',
    children: pageRoutes
  },

  // 404
  {
    path: '404',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page non trouvée'
  },
  { path: '**', redirectTo: '404' }
];

export default routes;
