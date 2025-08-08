import { Component, OnDestroy, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';

type Slide = { title: string; subtitle: string; bg: string };

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent implements OnInit, AfterViewInit, OnDestroy {
  acf: any = {};
  heroSlides: Slide[] = [];
  heroIndex = 0;

  autoplayMs = 5000;
  private autoplayRef: any = null;

  private pointerStartX: number | null = null;
  private swipeThreshold = 40;

  get currentSlide(): Slide | undefined {
    return this.heroSlides[this.heroIndex];
  }

  private wp = inject(WordpressService);
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.wp.getHomepageData().subscribe(acf => {
      this.acf = acf;
      this.extractHero();
      this.preloadHeroImages();
      this.applySeoFromHero();
      this.startAutoplay();
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.clearAutoplay();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private extractHero(): void {
    const h = this.acf?.hero_section || {};
    this.heroSlides = [
      { title: h.hero_title_1 || '', subtitle: h.hero_subtitle_1 || '', bg: h.hero_background_1 || '' },
      { title: h.hero_title_2 || '', subtitle: h.hero_subtitle_2 || '', bg: h.hero_background_2 || '' },
      { title: h.hero_title_3 || '', subtitle: h.hero_subtitle_3 || '', bg: h.hero_background_3 || '' }
    ].filter(s => !!s.bg);

    if (!this.heroSlides.length && (h.hero_background || '')) {
      this.heroSlides = [{
        title: h.hero_title || '',
        subtitle: h.hero_subtitle || '',
        bg: h.hero_background || ''
      }];
    }

    this.heroIndex = 0;
  }

  private preloadHeroImages(): void {
    for (const s of this.heroSlides) {
      const img = new Image();
      img.src = s.bg;
    }
  }

  goTo(i: number): void {
    if (!this.heroSlides.length) return;
    const len = this.heroSlides.length;
    this.heroIndex = ((i % len) + len) % len;
  }

  next(): void { this.goTo(this.heroIndex + 1); }
  prev(): void { this.goTo(this.heroIndex - 1); }

  startAutoplay(): void {
    this.clearAutoplay();
    if (this.heroSlides.length > 1) {
      this.autoplayRef = setInterval(() => this.next(), this.autoplayMs);
    }
  }

  pauseAutoplay(): void { this.clearAutoplay(); }
  resumeAutoplay(): void { if (document.visibilityState === 'visible') this.startAutoplay(); }

  private clearAutoplay(): void {
    if (this.autoplayRef) {
      clearInterval(this.autoplayRef);
      this.autoplayRef = null;
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') this.pauseAutoplay();
    else this.resumeAutoplay();
  };

  onKeydown(evt: KeyboardEvent): void {
    if (this.heroSlides.length < 2) return;
    if (evt.key === 'ArrowRight') { this.pauseAutoplay(); this.next(); }
    else if (evt.key === 'ArrowLeft') { this.pauseAutoplay(); this.prev(); }
  }

  onPointerDown(evt: PointerEvent): void { this.pointerStartX = evt.clientX; }
  onPointerUp(evt: PointerEvent): void {
    if (this.pointerStartX == null) return;
    const dx = evt.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(dx) > this.swipeThreshold) {
      this.pauseAutoplay();
      if (dx < 0) this.next(); else this.prev();
    }
  }

  trackByIndex(i: number): number { return i; }

  private applySeoFromHero(): void {
    const s = this.acf?.seo_section || {};
    const first = this.heroSlides[0] || { title: '', subtitle: '', bg: '' };
    const seoImage = (s.seo_image && (s.seo_image.url || s.seo_image)) || first.bg;

    this.seo.update({
      title:       s.seo_title       || first.title || 'Groupe ABC – Expertise immobilière',
      description: s.seo_description || first.subtitle,
      keywords:    s.seo_keywords,
      image:       seoImage,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type'   : 'Organization',
        name      : 'Groupe ABC',
        url       : window.location.href,
        logo      : seoImage,
        description: s.seo_description || first.subtitle
      }
    });
  }
}
