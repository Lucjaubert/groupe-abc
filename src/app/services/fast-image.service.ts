import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FastImageService {
  private cache = new Map<string, Promise<void>>();

  /** Précharge et mémorise une image (résout même en erreur) */
  preload(src: string): Promise<void> {
    if (!src) return Promise.resolve();
    const key = src.trim();
    if (this.cache.has(key)) return this.cache.get(key)!;

    const p = new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.onload = img.onerror = () => resolve();
      img.src = key;
    });

    this.cache.set(key, p);
    return p;
  }
}
