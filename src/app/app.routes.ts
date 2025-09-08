import { Routes } from '@angular/router';

export const routes: Routes = [
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
  { path: '**', redirectTo: '' }
];

export default routes;
