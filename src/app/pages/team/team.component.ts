import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type MapSection = { title?: string; image?: string; items: string[] };

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);

  /* ===== Données ===== */
  heroTitle = 'Équipes';
  heroIntroHtml: SafeHtml | '' = '';
  mapSection: MapSection | null = null;

  /* Fallback image */
  private defaultMap = 'assets/fallbacks/image-placeholder.svg';

  /* Refs pour anims */
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('heroIntroEl') heroIntroEl!: ElementRef<HTMLElement>;
  @ViewChild('mapTitleEl')  mapTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapImageEl')  mapImageEl!: ElementRef<HTMLElement>;
  @ViewChildren('mapItem')  mapItemEls!: QueryList<ElementRef<HTMLElement>>;

  /* Handlers hover GSAP -> cleanup */
  private hoverCleanup: Array<() => void> = [];

  ngOnInit(): void {
    this.wp.getTeamData().subscribe((root: any) => {
      const acf = root?.acf ?? {};

      /* HERO */
      this.heroTitle = acf?.hero?.section_title || 'Équipes';
      this.heroIntroHtml = this.squashWpGaps(acf?.hero?.intro_body || '');

      /* MAP */
      const ms = acf?.map_section ?? {};
      const img = ms?.map_image;
      let mapImgUrl = '';

      if (typeof img === 'string' && img.trim()) {
        mapImgUrl = img.trim();
      } else if (img && typeof img === 'object') {
        mapImgUrl = img.url || img.source_url || '';
      }

      const items = [
        ms?.region_name_1, ms?.region_name_2, ms?.region_name_3, ms?.region_name_4,
        ms?.region_name_5, ms?.region_name_6, ms?.region_name_7, ms?.region_name_8
      ]
        .filter((s: any) => (s || '').toString().trim())
        .map((s: string) => s.trim());

      this.mapSection = {
        title: ms?.section_title || 'Où ?',
        image: mapImgUrl || this.defaultMap,
        items
      };

      /* SEO */
      const introText = (acf?.hero?.intro_body || '').toString();
      this.seo.update({
        title: `${this.heroTitle} – Groupe ABC`,
        description: this.strip(introText, 160),
        image: ''
      });

      this.scheduleBind();
    });
  }

  /* ========= Helpers ========= */

  /** Nettoie l'HTML WP: supprime les <p> vides (&nbsp;, espaces, <br>) puis assainit */
  private squashWpGaps(html: string): SafeHtml {
    const compact = (html || '')
      .replace(/<p>(?:&nbsp;|&#160;|\s|<br\s*\/?>)*<\/p>/gi, '') // vire <p>&nbsp;</p>, <p><br></p>, etc.
      .replace(/>\s+</g, '><');                                 // compresse les blancs inter-balises
    return this.sanitizer.bypassSecurityTrustHtml(compact);
  }

  trackByIndex(i: number){ return i; }
  onMapImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultMap; }
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private prefersReducedMotion(): boolean {
    try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false; }
    catch { return false; }
  }

  /** Ajoute un zoom GSAP doux au hover/focus sur chaque li */
  private attachListHoverZoom(items: HTMLElement[]) {
    // Nettoie d’anciens bindings si rebind
    this.hoverCleanup.forEach(fn => { try { fn(); } catch {} });
    this.hoverCleanup = [];

    if (!items?.length || this.prefersReducedMotion()) return;

    items.forEach((el) => {
      el.style.transformOrigin = 'left center';
      el.style.willChange = 'transform';

      const enter = () => gsap.to(el, { scale: 1.045, duration: 0.18, ease: 'power3.out' });
      const leave = () => gsap.to(el, { scale: 1,     duration: 0.22, ease: 'power2.out' });

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('focus',      enter, true);
      el.addEventListener('blur',       leave, true);

      this.hoverCleanup.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('focus',      enter, true);
        el.removeEventListener('blur',       leave, true);
        gsap.set(el, { clearProps: 'transform' });
      });
    });
  }

  /* ===== Animations ===== */
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.mapItemEls?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
    // Cleanup hover handlers
    this.hoverCleanup.forEach(fn => { try { fn(); } catch {} });
    this.hoverCleanup = [];
  }

  private bindScheduled = false;
  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  private bindAnimations(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    const EASE = 'power3.out';
    const rm = (el?: Element | null) => el && el.classList.remove('prehide','prehide-row');

    const h1  = this.heroTitleEl?.nativeElement;
    const hi  = this.heroIntroEl?.nativeElement;
    const mt  = this.mapTitleEl?.nativeElement;
    const mi  = this.mapImageEl?.nativeElement;
    const items = (this.mapItemEls?.toArray() || []).map(r => r.nativeElement);
    const list  = items[0]?.parentElement as HTMLElement | null;

    if (h1) gsap.fromTo(h1, {autoAlpha:0, y:18}, {
      autoAlpha:1, y:0, duration:.55, ease:EASE,
      onStart:()=>rm(h1)
    });

    if (hi) gsap.fromTo(hi, {autoAlpha:0, y:16}, {
      autoAlpha:1, y:0, duration:.5, ease:EASE, delay:.05,
      onStart:()=>rm(hi)
    });

    if (mi) gsap.fromTo(mi, {autoAlpha:0, y:14}, {
      autoAlpha:1, y:0, duration:.5, ease:EASE,
      scrollTrigger:{trigger:mi,start:'top 85%',once:true},
      onStart:()=>rm(mi)
    });

    if (mt) gsap.fromTo(mt, {autoAlpha:0, y:16}, {
      autoAlpha:1, y:0, duration:.5, ease:EASE, delay:.05,
      scrollTrigger:{trigger:mt,start:'top 85%',once:true},
      onStart:()=>rm(mt)
    });

    if (list && items.length) {
      gsap.fromTo(items, {autoAlpha:0, y:12}, {
        autoAlpha:1, y:0, duration:.45, ease:EASE, stagger:.08,
        scrollTrigger:{trigger:list,start:'top 90%',once:true},
        onStart:()=>items.forEach(rm)
      });
    }

    /* 👇 bind le zoom au hover/focus (GSAP) */
    this.attachListHoverZoom(items);

    try { ScrollTrigger.refresh(); } catch {}
  }
}
