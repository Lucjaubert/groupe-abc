// src/app/pages/methods-asset/methods-asset.component.ts

import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, filter, Subscription } from 'rxjs';

import { environment } from '../../../environments/environment';

import { ImgFastDirective } from '../../directives/img-fast.directive';
import { SeoService } from '../../services/seo.service';
import { WordpressService } from '../../services/wordpress.service';

// ✅ Source de vérité slugs / routes (FR/EN)
import {
  METHODS_ASSETS_BASE,
  normalizeSlug,
  fromMethodsAssetUrlSlug,
  toMethodsAssetDisplaySlug,
} from '../../config/methods-assets.slugs';

type Lang = 'fr' | 'en';

type Hero = {
  title: string;
  subtitle?: string;
  html?: SafeHtml | string;
  imageUrl?: string;
};

type Section = {
  title: string;
  html?: SafeHtml | string;
  imageUrl?: string;
};

type FaqItemUI = { q: string; a: string };

@Component({
  selector: 'app-methods-asset',
  standalone: true,
  imports: [CommonModule, ImgFastDirective],
  templateUrl: './methods-asset.component.html',
  styleUrls: ['./methods-asset.component.scss'],
})
export class MethodsAssetComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);
  private wp = inject(WordpressService);

  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT);

  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  /** ✅ Sert au template: n'afficher le détail que si on a un slug */
  isDetail = false;

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser() || this.gsap) return;
    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    this.gsap = gsap;
    this.ScrollTrigger = ScrollTrigger;
    try {
      this.gsap.registerPlugin(this.ScrollTrigger);
    } catch {}
  }

  /* ===== UI state ===== */
  hero: Hero = { title: '', subtitle: '', html: '', imageUrl: '' };
  sections: Section[] = [];

  /* ===== FAQ (en bas de page) ===== */
  faqItems: FaqItemUI[] = [];
  openFaqIndexes = new Set<number>();

  /* ===== fallbacks ===== */
  defaultHeroImg = '/assets/fallbacks/image-placeholder.svg';
  defaultSectionImg = '/assets/fallbacks/image-placeholder.svg';

  /* ===== refs anim ===== */
  @ViewChild('heroTitle') heroTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('heroSubtitle') heroSubRef!: ElementRef<HTMLElement>;
  @ViewChild('heroIntro') heroIntroRef!: ElementRef<HTMLElement>;
  @ViewChild('heroMedia') heroMediaRef!: ElementRef<HTMLElement>;

  @ViewChildren('contentBlock') contentBlocks!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('faqTitle') faqTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('faqList') faqListRef!: ElementRef<HTMLElement>;

  private bindScheduled = false;

  // anti-race: si on change de slug vite, on ignore l'ancien résultat
  private loadSeq = 0;
  private lastSlugCanonical = '';

  private subs = new Subscription();

  ngOnInit(): void {
    // ✅ slug -> load
    this.subs.add(
      this.route.paramMap.subscribe(async (pm) => {
        const rawParam = (pm.get('slug') || '').trim();
        const rawUrlSlug = normalizeSlug(rawParam);

        this.isDetail = !!rawUrlSlug;

        if (!rawUrlSlug) {
          this.lastSlugCanonical = '';
          this.hero = { title: 'Actifs immobiliers', subtitle: '', html: '', imageUrl: '' };
          this.sections = [];
          this.faqItems = [];
          this.openFaqIndexes.clear();
          return;
        }

        const lang = this.getLang();

        // 1) slug URL (FR/EN/alias) -> canonical WP (celui pour fetch WP)
        const canonicalWp = fromMethodsAssetUrlSlug(rawUrlSlug, lang);

        // 2) canonical WP -> slug affiché (EN “propre” si défini)
        const desiredDisplay = toMethodsAssetDisplaySlug(canonicalWp, lang);

        // 3) si l’URL actuelle n’est pas canonique => redirect SEO clean
        //    ex: /en/.../lotissements -> /en/.../land-subdivisions
        if (rawUrlSlug !== desiredDisplay) {
          const base = METHODS_ASSETS_BASE[lang];
          this.router.navigate([base, desiredDisplay], { replaceUrl: true }).catch(() => {});
          return;
        }

        // 4) éviter re-fetch si on a déjà le même canonical WP
        if (canonicalWp === this.lastSlugCanonical) {
          this.scheduleBind();
          return;
        }

        this.lastSlugCanonical = canonicalWp;

        const seq = ++this.loadSeq;
        try {
          await this.loadBySlug(canonicalWp, seq, desiredDisplay /* slug affiché */);
          this.scheduleBind();
        } catch (e) {
          this.hero = { title: 'Actifs immobiliers', subtitle: '', html: '', imageUrl: '' };
          this.sections = [];
          this.faqItems = [];
          this.openFaqIndexes.clear();
          // eslint-disable-next-line no-console
          console.error('[MethodsAsset] loadBySlug failed', e);
        }
      }),
    );

    // ✅ rebind sur navigation (utile si scroll/DOM change)
    this.subs.add(
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => {
          if (!this.isBrowser()) return;
          if (!this.isDetail) return;
          this.scheduleBind();
        }),
    );
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();

    this.subs.add(this.contentBlocks?.changes?.subscribe(() => this.scheduleBind()) as any);
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();

    if (!this.isBrowser()) return;

    try {
      this.ScrollTrigger?.getAll?.().forEach((t: any) => t.kill());
    } catch {}
    try {
      this.gsap?.globalTimeline?.clear?.();
    } catch {}
  }

  goBackToList(): void {
    const lang = this.getLang();

    // ✅ listing cible EXACT (utilise la même base que tes routes)
    const listUrl = METHODS_ASSETS_BASE[lang];

    if (this.isBrowser()) {
      try {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
      } catch {}
    }

    this.router.navigateByUrl(listUrl).catch(() => {
      if (this.isBrowser()) window.location.href = listUrl;
    });
  }

  /* =========================
     WP URL builder (FIX rest_route)
     ========================= */

  private buildWpUrl(base: string, path: string, query: Record<string, string> = {}): string {
    const b = (base || '').trim().replace(/\/+$/, '');
    const p = (path || '').trim().replace(/^\/+/, '');

    const qs = Object.entries(query)
      .filter(([, v]) => v != null && `${v}`.length)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    if (b.includes('rest_route=')) {
      return qs ? `${b}/${p}&${qs}` : `${b}/${p}`;
    }

    return qs ? `${b}/${p}?${qs}` : `${b}/${p}`;
  }

  private wpApiBases(): string[] {
    const fromEnv = (environment.apiWpV2 || '').trim();
    const fallbackDefault = 'https://groupe-abc.fr/wordpress/wp-json/wp/v2';
    const primary = (fromEnv || fallbackDefault).replace(/\/+$/, '');

    let alt = '';
    if (/\/wordpress\/wp-json\/wp\/v2$/i.test(primary)) {
      alt = primary.replace(/\/wordpress\/wp-json\/wp\/v2$/i, '/wp-json/wp/v2');
    } else if (/\/wp-json\/wp\/v2$/i.test(primary)) {
      alt = primary.replace(/\/wp-json\/wp\/v2$/i, '/wordpress/wp-json/wp/v2');
    }

    return Array.from(new Set([primary, alt].filter(Boolean)));
  }

  private async loadBySlug(slugWp: string, seq: number, slugDisplay: string): Promise<void> {
    const bases = this.wpApiBases();

    const fetchFrom = async (base: string) => {
      const url = this.buildWpUrl(base, 'methods_asset', { slug: slugWp });
      return await firstValueFrom(this.http.get<any[]>(url));
    };

    let arr: any[] | null = null;
    let lastErr: any = null;

    for (const base of bases) {
      try {
        arr = await fetchFrom(base);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) throw lastErr;
    if (!arr) throw new Error('WP response is null');
    if (seq !== this.loadSeq) return;

    const root = Array.isArray(arr) && arr.length ? arr[0] : null;

    if (!root) {
      this.hero = { title: 'Actifs immobiliers', subtitle: '', html: '', imageUrl: '' };
      this.sections = [];
      this.faqItems = [];
      this.openFaqIndexes.clear();
      return;
    }

    const acf = root?.acf ?? {};

    /* ---------- HERO ---------- */
    const heroImgToken = acf?.hero?.hero_image ?? '';
    const heroImgUrl = (await this.resolveMedia(heroImgToken)) || '';
    if (seq !== this.loadSeq) return;

    this.hero = {
      title: acf?.hero?.section_title || root?.title?.rendered || 'Actifs immobiliers',
      subtitle: acf?.hero?.section_subtitle || '',
      html: this.safe(acf?.hero?.intro_body || ''),
      imageUrl: heroImgUrl,
    };

    /* ---------- CONTENT SECTIONS ---------- */
    this.sections = await this.buildSections(acf?.content_sections, seq);
    if (seq !== this.loadSeq) return;

    /* ---------- FAQ ---------- */
    this.faqItems = this.buildFaq(acf?.faq);
    this.openFaqIndexes.clear();

    /* ---------- SEO ---------- */
    this.applySeoFromAcf(acf?.seo, slugDisplay, this.faqItems);
  }

  private async buildSections(cs: any, seq: number): Promise<Section[]> {
    if (!cs) return [];

    const out: Section[] = [];

    const pick = (i: number, key: 'enabled' | 'title' | 'body' | 'image') => {
      const groupKey = `section_enabled_${i}`;
      const group = cs?.[groupKey];

      const k = `section_${i}_${key === 'enabled' ? 'enabled' : key}`;

      if (group && group[k] != null) return group[k];

      if (group) {
        const kFallback = `section_1_${key === 'enabled' ? 'enabled' : key}`;
        if (group[kFallback] != null) return group[kFallback];
      }

      if (cs[k] != null) return cs[k];

      const flatFallback = `section_1_${key === 'enabled' ? 'enabled' : key}`;
      if (cs[flatFallback] != null) return cs[flatFallback];

      return null;
    };

    for (let i = 1; i <= 6; i++) {
      if (seq !== this.loadSeq) return out;

      const enabled = !!pick(i, 'enabled');
      const title = (pick(i, 'title') ?? '').toString().trim();
      const body = (pick(i, 'body') ?? '').toString().trim();

      if (!enabled) continue;
      if (!title && !body) continue;

      const imgToken = pick(i, 'image');
      const imgUrl = (await this.resolveMedia(imgToken)) || '';
      if (seq !== this.loadSeq) return out;

      out.push({
        title,
        html: this.safe(body),
        imageUrl: imgUrl,
      });
    }

    return out;
  }

  private buildFaq(faqRoot: any): FaqItemUI[] {
    if (!faqRoot) return [];

    const items: FaqItemUI[] = [];

    for (let i = 1; i <= 12; i++) {
      const group = faqRoot?.[`faq_${i}`];

      const enabled = !!(
        group?.[`faq_${i}_enabled`] ??
        group?.faq_1_enabled ??
        faqRoot?.[`faq_${i}_enabled`] ??
        faqRoot?.faq_1_enabled
      );

      const q = (
        group?.[`faq_${i}_question`] ??
        group?.faq_1_question ??
        faqRoot?.[`faq_${i}_question`] ??
        faqRoot?.faq_1_question ??
        ''
      )
        .toString()
        .trim();

      const a = (
        group?.[`faq_${i}_answer`] ??
        group?.faq_1_answer ??
        faqRoot?.[`faq_${i}_answer`] ??
        faqRoot?.faq_1_answer ??
        ''
      )
        .toString()
        .trim();

      if (!enabled) continue;
      if (!q || !a) continue;

      items.push({ q, a });
    }

    return items;
  }

  toggleFaqItem(i: number): void {
    if (this.openFaqIndexes.has(i)) this.openFaqIndexes.delete(i);
    else this.openFaqIndexes.add(i);
  }

  isFaqItemOpen(i: number): boolean {
    return this.openFaqIndexes.has(i);
  }

  trackByIndex(i: number) {
    return i;
  }

  private safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  private async resolveMedia(token: any): Promise<string> {
    if (!token) return '';

    if (typeof token === 'object') {
      const u = token?.source_url || token?.url || '';
      if (u) return u;
      if (token?.id != null) token = token.id;
    }

    if (typeof token === 'number') {
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(token))) || '';
      } catch {
        return '';
      }
    }

    if (typeof token === 'string') {
      const s = token.trim();
      if (!s) return '';

      if (/^\d+$/.test(s)) {
        try {
          return (await firstValueFrom(this.wp.getMediaUrl(+s))) || '';
        } catch {
          return '';
        }
      }

      return s;
    }

    return '';
  }

  private applySeoFromAcf(seoAcf: any, slugDisplay: string, faqItems: FaqItemUI[] = []): void {
    const lang = this.getLang();

    const metaTitle = (seoAcf?.meta_title || this.hero.title || 'Actifs immobiliers').toString();
    const metaDesc = (seoAcf?.meta_description || '').toString();

    const origin = 'https://groupe-abc.fr';
    const base = METHODS_ASSETS_BASE[lang];
    const fallbackPath = `${base}/${encodeURIComponent(slugDisplay)}`;
    const canonicalFallback = `${origin}${fallbackPath}`;

    const canonical = (seoAcf?.canonical || canonicalFallback).toString();
    const robots = seoAcf?.noindex ? 'noindex,nofollow' : 'index,follow';

    let jsonLdObj: any = null;
    const raw = seoAcf?.json_ld;

    if (raw && typeof raw === 'string') {
      try {
        jsonLdObj = JSON.parse(raw);
      } catch {
        jsonLdObj = null;
      }
    } else if (raw && typeof raw === 'object') {
      jsonLdObj = raw;
    }

    if (!jsonLdObj) {
      const graph: any[] = [
        {
          '@type': 'WebSite',
          '@id': `${origin}#website`,
          url: origin,
          name: 'Groupe ABC',
          inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
        },
        {
          '@type': 'Organization',
          '@id': `${origin}#organization`,
          name: 'Groupe ABC',
          url: origin,
          sameAs: ['https://www.linkedin.com/company/groupe-abc-experts/'],
        },
        {
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
          name: metaTitle,
          description: metaDesc,
          inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
          isPartOf: { '@id': `${origin}#website` },
        },
      ];

      if (faqItems.length) {
        graph.push({
          '@type': 'FAQPage',
          '@id': `${canonical}#faq`,
          mainEntity: faqItems.map((q) => ({
            '@type': 'Question',
            name: q.q,
            acceptedAnswer: { '@type': 'Answer', text: q.a },
          })),
        });
      }

      jsonLdObj = { '@context': 'https://schema.org', '@graph': graph };
    }

    this.seo.update({
      title: metaTitle,
      description: metaDesc,
      canonical,
      robots,
      lang,
      locale: lang === 'en' ? 'en_US' : 'fr_FR',
      jsonLd: jsonLdObj || undefined,
    });
  }

  private getLang(): Lang {
    try {
      const htmlLang = (this.doc?.documentElement?.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('fr')) return 'fr';
    } catch {}

    if (this.isBrowser()) {
      try {
        const path = window.location.pathname || '/';
        if (path.startsWith('/en/')) return 'en';
      } catch {}
    }

    return 'fr';
  }

  private scheduleBind(): void {
    if (!this.isBrowser() || !this.gsap) return;
    if (this.bindScheduled) return;
    this.bindScheduled = true;

    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      }),
    );
  }

  private bindAnimations(): void {
    if (!this.isDetail) return;
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;

    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;
    const EASE = 'power3.out';

    try {
      ScrollTrigger.getAll().forEach((t: any) => t.kill());
    } catch {}

    const rmPrehide = (els: (Element | null | undefined)[] | Element | null | undefined) => {
      const arr = Array.isArray(els) ? els : [els];
      arr.filter(Boolean).forEach((el: any) => el.classList.remove('prehide', 'prehide-row'));
    };

    const h1 = this.heroTitleRef?.nativeElement;
    const h2 = this.heroSubRef?.nativeElement;
    const hi = this.heroIntroRef?.nativeElement;
    const hm = this.heroMediaRef?.nativeElement;

    const tlHero = gsap.timeline({ defaults: { ease: EASE } });
    if (h1)
      tlHero.fromTo(
        h1,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.55, onStart: () => rmPrehide(h1) },
        0,
      );
    if (h2)
      tlHero.fromTo(
        h2,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.5, onStart: () => rmPrehide(h2) },
        0.06,
      );
    if (hi)
      tlHero.fromTo(
        hi,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.5, onStart: () => rmPrehide(hi) },
        0.12,
      );
    if (hm)
      tlHero.fromTo(
        hm,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.45, onStart: () => rmPrehide(hm) },
        0.16,
      );

    const blocks = (this.contentBlocks?.toArray() || []).map((r) => r.nativeElement);
    if (blocks.length) {
      gsap.set(blocks, { autoAlpha: 0, y: 14 });
      gsap
        .timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: blocks[0], start: 'top 85%', once: true },
          onStart: () => rmPrehide(blocks),
        })
        .to(blocks, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 });
    }

    const ft = this.faqTitleRef?.nativeElement;
    const fl = this.faqListRef?.nativeElement;

    if (ft) {
      gsap.fromTo(
        ft,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: EASE,
          scrollTrigger: { trigger: ft, start: 'top 85%', once: true },
          onStart: () => rmPrehide(ft),
        },
      );
    }

    if (fl) {
      gsap.fromTo(
        fl,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.45,
          ease: 'power2.out',
          scrollTrigger: { trigger: fl, start: 'top 90%', once: true },
          onStart: () => rmPrehide(fl),
        },
      );
    }

    try {
      ScrollTrigger.refresh();
    } catch {}
  }
}
