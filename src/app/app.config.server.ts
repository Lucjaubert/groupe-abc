import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import routes from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { APP_BASE_HREF } from '@angular/common';

export const config: ApplicationConfig = {
  providers: [
    provideServerRendering(),

    { provide: APP_BASE_HREF, useValue: '/' },

    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideHttpClient(withFetch()),
    provideNoopAnimations(),
  ],
};
