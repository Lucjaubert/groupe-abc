import { bootstrapApplication } from '@angular/platform-browser';
import { APP_INITIALIZER } from '@angular/core';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { WeglotService } from './app/services/weglot.service';

export function initWeglotFactory(weglot: WeglotService) {
  return () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    return weglot.init();
  };
}

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []),
    {
      provide: APP_INITIALIZER,
      useFactory: initWeglotFactory,
      deps: [WeglotService],
      multi: true
    }
  ]
}).catch(err => console.error(err));
