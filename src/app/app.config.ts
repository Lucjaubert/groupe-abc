import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import {
  provideRouter,
  withInMemoryScrolling,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import routes from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { WeglotRefreshService } from './services/weglot-refresh.service';

export const config: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withEnabledBlockingInitialNavigation(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideAnimations(),

    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        inject(WeglotRefreshService);
        return () => {};
      },
    },
  ],
};
