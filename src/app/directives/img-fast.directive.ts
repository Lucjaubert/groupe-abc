import {
  Directive, ElementRef, Input, OnChanges, OnInit, OnDestroy,
  Renderer2, SimpleChanges
} from '@angular/core';
import { FastImageService } from '../services/fast-image.service';

@Directive({
  selector: 'img[appImgFast]',
  standalone: true
})
export class ImgFastDirective implements OnInit, OnChanges, OnDestroy {
  /** URL finale de l'image (ce que tu mettrais dans [src]) */
  @Input('appImgFast') src: string | null | undefined = '';

  /** Placeholder affiché immédiatement (aucun trou visuel) */
  @Input() placeholder = '/assets/fallbacks/portrait-placeholder.svg';

  private img: HTMLImageElement;
  private lastAppliedUrl = '';
  private loadToken = 0;                // évite les courses (rapid fire updates)
  private unlistenError?: () => void;   // cleanup

  constructor(
    el: ElementRef<HTMLImageElement>,
    private r: Renderer2,
    private fast: FastImageService
  ){
    this.img = el.nativeElement;
    this.r.addClass(this.img, 'fast-img');
  }

  ngOnInit(): void {
    // Pose un src valide immédiatement si rien n'est défini (évite le flash "image cassée")
    if (!this.img.getAttribute('src') || this.img.src === '') {
      if (this.placeholder) this.r.setAttribute(this.img, 'src', this.placeholder);
    }
    // Petites optimisations sûres
    if (!this.img.getAttribute('decoding')) this.r.setAttribute(this.img, 'decoding', 'async');
    if (!this.img.getAttribute('loading'))  this.r.setAttribute(this.img, 'loading',  'lazy');

    // Fallback runtime en cas d'erreur réseau
    this.unlistenError = this.r.listen(this.img, 'error', () => {
      if (this.placeholder) {
        this.r.setAttribute(this.img, 'src', this.placeholder);
        this.r.removeClass(this.img, 'is-ready');
        this.lastAppliedUrl = this.placeholder;
      }
    });
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (!('src' in changes)) return;

    const next = (this.src || '').toString().trim();

    // Pas d’URL -> reste sur placeholder
    if (!next) {
      if (this.placeholder) {
        this.r.setAttribute(this.img, 'src', this.placeholder);
        this.r.removeClass(this.img, 'is-ready');
        this.lastAppliedUrl = this.placeholder;
      }
      return;
    }

    // Déjà appliqué et en place -> ne rien faire (évite reflows)
    if (this.lastAppliedUrl === next && this.img.getAttribute('src') === next) return;

    // Si on part sur un nouveau chargement, assure un état stable (placeholder)
    if (this.placeholder && this.img.getAttribute('src') !== this.placeholder) {
      this.r.setAttribute(this.img, 'src', this.placeholder);
      this.r.removeClass(this.img, 'is-ready');
      this.lastAppliedUrl = this.placeholder;
    }

    // Token pour annuler les résultats obsolètes
    const myToken = ++this.loadToken;
    try {
      await this.fast.preload(next);        // précharge en mémoire
      if (myToken !== this.loadToken) return; // un nouveau src est arrivé entre-temps

      // Swap atomique -> pas de flicker
      this.r.setAttribute(this.img, 'src', next);
      this.r.addClass(this.img, 'is-ready');
      this.lastAppliedUrl = next;
    } catch {
      if (myToken !== this.loadToken) return;
      if (this.placeholder) {
        this.r.setAttribute(this.img, 'src', this.placeholder);
        this.r.removeClass(this.img, 'is-ready');
        this.lastAppliedUrl = this.placeholder;
      }
    }
  }

  ngOnDestroy(): void {
    try { this.unlistenError?.(); } catch {}
  }
}
