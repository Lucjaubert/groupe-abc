import { Directive, ElementRef, HostBinding, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: 'img[appPreloadSrc]',
  standalone: true
})
export class PreloadSrcDirective implements OnChanges {
  /** URL finale (ou vide) */
  @Input('appPreloadSrc') src: string | null | undefined;
  /** Placeholder pendant le chargement / en cas d’erreur */
  @Input() placeholder = '/assets/fallbacks/portrait-placeholder.svg';

  @HostBinding('class.ready') ready = false;

  private el: HTMLImageElement;

  constructor(ref: ElementRef<HTMLImageElement>) {
    this.el = ref.nativeElement;
    // état initial : placeholder invisible (on laisse le CSS gérer l’opacité)
    this.el.src = this.placeholder;
  }

  ngOnChanges(ch: SimpleChanges): void {
    const url = (this.src || '').toString().trim();
    if (!url) {
      this.ready = false;
      this.el.src = this.placeholder;
      return;
    }

    // Si c’est déjà la bonne URL, ne rien faire (évite le flash)
    if (this.el.src === url) return;

    // Garde l’ancienne image affichée ; on ne swap que quand la nouvelle est prête
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.onload = () => {
      this.el.src = url;     // swap atomique → pas de “image cassée”
      this.ready = true;     // active la classe pour la fondu
    };
    img.onerror = () => {
      this.ready = false;
      this.el.src = this.placeholder;
    };
    img.src = url;
  }
}
