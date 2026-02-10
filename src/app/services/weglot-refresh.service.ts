import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WeglotRefreshService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly doc = inject(DOCUMENT) as Document;

  private timer: any = null;
  private sub?: Subscription;

  private get win(): Window | null {
    return this.isBrowser ? (window as any) : null;
  }

  constructor() {
    if (!this.isBrowser) return;

    const router = inject(Router);
    this.sub = router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.sub?.unsubscribe();
    } catch {}
    this.sub = undefined;
  }

  refresh(target?: Element | string | null, delay = 0): void {
    if (!this.isBrowser) return;

    const wg: any = (this.win as any)?.Weglot;
    if (!wg?.addNodes) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const root = this.resolveTarget(target);
    if (!root) return;

    this.timer = setTimeout(() => {
      try {
        wg.addNodes([root]);
      } catch {}

      // second pass (Weglot est parfois “en retard” sur le DOM après navigation)
      setTimeout(() => {
        try {
          wg.addNodes([root]);
        } catch {}
      }, 120);
    }, Math.max(0, delay));
  }

  ping(delay = 0, root?: Element | string | null): void {
    this.refresh(root ?? null, delay);
  }

  private resolveTarget(target?: Element | string | null): Element | null {
    // Browser-only (refresh() return early en SSR), mais on garde un code clean
    const body = this.doc?.body || this.doc?.documentElement || null;

    if (!target) {
      return (
        this.doc.querySelector('app-root') ||
        this.doc.querySelector('main') ||
        body
      );
    }

    if (typeof target === 'string') {
      return this.doc.querySelector(target) || body;
    }

    return target;
  }
}
