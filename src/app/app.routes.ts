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
  { path: '**', redirectTo: '' }
];
export default routes;
