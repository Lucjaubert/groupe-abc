import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/homepage/homepage.component').then((m) => m.HomepageComponent),
    pathMatch: 'full',
    title: 'Groupe-abc'
  },
  { path: '**', redirectTo: '' }
];
export default routes;


