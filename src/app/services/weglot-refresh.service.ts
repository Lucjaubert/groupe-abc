import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';


@Injectable({ providedIn: 'root' })
export class WeglotRefreshService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: any = null;

  constructor() {
    if (!this.isBrowser) return;

    const router = inject(Router);
    router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.ping());
  }

  /** Re-scan (débouclonné) – cible tout le body par défaut */
  ping(delay = 0, root?: Element): void {
    if (!this.isBrowser) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      try {
        const el = root || document.body || document.documentElement;
        (window as any).Weglot?.addNodes?.(el);
      } catch {}
    }, Math.max(0, delay));
  }
}
