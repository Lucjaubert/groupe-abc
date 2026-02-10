import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class DomService {
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private readonly doc: Document
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  query<T extends Element = Element>(selector: string): T | null {
    if (!this.isBrowser) return null;
    return this.doc.querySelector(selector) as T | null;
  }

  run(fn: () => void): void {
    if (!this.isBrowser) return;
    fn();
  }
}
