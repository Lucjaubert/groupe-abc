import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class WeglotRefreshService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private timer: any = null;

  constructor() {
    if (!this.isBrowser) return;

    const router = inject(Router);
    router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  refresh(target?: Element | string | null, delay = 0): void {
    if (!this.isBrowser) return;

    const wg: any = (window as any).Weglot;
    if (!wg?.addNodes) return;

    clearTimeout(this.timer);
    const root = this.resolveTarget(target);

    this.timer = setTimeout(() => {
      try { wg.addNodes([root]); } catch {}
      setTimeout(() => {
        try { wg.addNodes([root]); } catch {}
      }, 120);
    }, Math.max(0, delay));
  }

  ping(delay = 0, root?: Element | string | null): void {
    this.refresh(root ?? null, delay);
  }

  private resolveTarget(target?: Element | string | null): Element {
    if (!target) {
      return (
        this.doc.querySelector('app-root') ||
        this.doc.querySelector('main') ||
        this.doc.body
      );
    }
    if (typeof target === 'string') {
      return this.doc.querySelector(target) || this.doc.body;
    }
    return target;
  }
}
