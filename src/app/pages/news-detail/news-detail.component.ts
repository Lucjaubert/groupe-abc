// src/app/pages/news-detail/news-detail.component.ts
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Component, OnInit, inject, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { environment } from '../../../environments/environment';
import { ImgFastDirective } from '../../directives/img-fast.directive';

// ✅ NEW: helpers slugs news FR/EN
import {
  fromNewsUrlSlug,
  toNewsDisplaySlug,
  buildNewsRoute,
} from '../../config/news.slugs';

type ThemeKey = 'expertise' | 'juridique' | 'marche' | 'autre';

type NewsPost = {
  id?: number | string;
  wpSlug?: string;       // slug WP canonical (source de vérité)
  prettySlug?: string;   // ancien fallback local (conservé pour compat)

  theme?: string;
  themeKey?: ThemeKey;

  title?: string;
  html?: string;

  date?: string;
  author?: string;
  firmName?: string;

  firmLogo?: any;
  imageUrl?: any;
  linkedinUrl?: string;

  _imageUrl?: string;
  _firmLogoUrl?: string;
};

@Component({
  selector: 'app-news-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ImgFastDirective],
  templateUrl: './news-detail.component.html',
  styleUrls: ['./news-detail.component.scss'],
})
export class NewsDetailComponent implements OnInit, OnDestroy {
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // ✅ SSR-safe : ne jamais utiliser window/document directement
  constructor(@Inject(DOCUMENT) private doc: Document) {}

  private get win(): Window | null {
    return (this.doc?.defaultView as Window) || null;
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  loading = true;
  notFound = false;

  slugParam = '';

  /** IMPORTANT: le template News Detail utilise `p` */
  p: NewsPost | null = null;

  private routeSub?: Subscription;
  private isLoadingRoute = false; // évite les doubles chargements en chaîne

  async ngOnInit(): Promise<void> {
    // ✅ Réagit si on navigue vers un autre slug en restant sur le même composant
    this.routeSub = this.route.paramMap.subscribe(() => {
      void this.loadFromRoute();
    });

    // 1er chargement
    await this.loadFromRoute();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private async loadFromRoute(): Promise<void> {
    // garde-fou contre les appels simultanés (subscribe + init)
    if (this.isLoadingRoute) return;
    this.isLoadingRoute = true;

    try {
      this.loading = true;
      this.notFound = false;
      this.p = null;

      this.slugParam = (this.route.snapshot.paramMap.get('slug') || '').trim();
      if (!this.slugParam) {
        this.notFound = true;
        this.loading = false;
        return;
      }

      const lang = this.currentLang();

      // ✅ slug URL (FR/EN) -> slug WP canonical (FR le plus souvent)
      const canonicalRequestedSlug = fromNewsUrlSlug(this.slugParam, lang);

      let list: any[] = [];
      try {
        list = await firstValueFrom(this.wp.getAllNews());
      } catch {
        // si l’API plante, on met un 404 “soft”
        this.notFound = true;
        this.loading = false;
        return;
      }

      // mapping proche de NewsComponent
      const mapped: NewsPost[] = [];
      for (const it of list) {
        const acfPost = it?.acf?.post || null;
        if (!acfPost) continue;

        const title = acfPost.post_title || it?.title?.rendered || '';
        const wpSlug = (it?.slug || '').trim();
        const prettySlug = this.makePrettySlug(title);

        mapped.push({
          id: it?.id,
          wpSlug,
          prettySlug,

          theme: acfPost.theme || '',
          themeKey: this.toThemeKey(acfPost.theme),

          title,
          html: acfPost.post_content || it?.content?.rendered || '',

          date: acfPost.date || it?.date || '',
          author: acfPost.author || '',
          firmName: acfPost.nam_firm || '',

          firmLogo: acfPost.logo_firm,
          imageUrl: acfPost.post_image,
          linkedinUrl: acfPost.linkedin_link || '',
        });
      }

      // retirer le post “news” d’intro
      const posts = mapped.filter((x) => x.wpSlug !== 'news');

      // ✅ priorité au slug WP canonical demandé
      let found =
        posts.find((x) => x.wpSlug === canonicalRequestedSlug) ||
        // fallback compat ancien format local
        posts.find((x) => x.prettySlug === this.slugParam) ||
        // fallback si URL FR = slug WP direct non mappé
        posts.find((x) => x.wpSlug === this.slugParam) ||
        null;

      if (!found) {
        this.notFound = true;
        this.loading = false;
        return;
      }

      // ✅ normalisation URL canonique (FR/EN) sans casser WP
      const expectedDisplaySlug = toNewsDisplaySlug(found.wpSlug || '', lang);

      if (expectedDisplaySlug && this.slugParam !== expectedDisplaySlug) {
        this.router.navigate(buildNewsRoute(lang, found.wpSlug || expectedDisplaySlug), {
          replaceUrl: true,
        });
        return;
      }

      // hydrater médias (logos/images)
      found._imageUrl = await this.resolveMedia(found.imageUrl);
      found._firmLogoUrl = await this.resolveMedia(found.firmLogo);

      this.p = found;

      // SEO dynamique
      this.updateSeo(found, lang);

      this.loading = false;
    } finally {
      this.isLoadingRoute = false;
    }
  }

  /* ===== Thème : identique à NewsComponent ===== */
  private toThemeKey(raw?: string): ThemeKey {
    const s = (raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (s.includes('expert')) return 'expertise';
    if (s.includes('jurid')) return 'juridique';
    if (s.includes('march')) return 'marche';
    return 'autre';
  }

  themeClass(k?: ThemeKey) {
    return k ? `theme-${k}` : 'theme-autre';
  }

  /* ===== SEO ===== */
  private updateSeo(p: NewsPost, lang: 'fr' | 'en') {
    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');

    // ✅ canonical piloté par slug canonique d'affichage (pas juste currentPath)
    const wpSlug = (p.wpSlug || '').trim();
    const displaySlug = toNewsDisplaySlug(wpSlug || this.slugParam, lang);

    const canonicalPath =
      lang === 'en'
        ? `/en/real-estate-valuation-news/${displaySlug}`
        : `/actualites-expertise-immobiliere/${displaySlug}`;

    const canonical = `${siteUrl}${canonicalPath}`;

    const altFr = `${siteUrl}/actualites-expertise-immobiliere/${toNewsDisplaySlug(wpSlug || this.slugParam, 'fr')}`;
    const altEn = `${siteUrl}/en/real-estate-valuation-news/${toNewsDisplaySlug(wpSlug || this.slugParam, 'en')}`;

    const title = this.stripHtml(p.title || (lang === 'en' ? 'News article' : 'Actualité'));
    const description = this.makeDescriptionFromHtml(p.html || '', 160);

    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      mainEntityOfPage: canonical,
      datePublished: p.date || undefined,
      author: p.author ? { '@type': 'Person', name: p.author } : undefined,
    };

    // optionnel : image dans JSON-LD si dispo
    if (p._imageUrl) jsonLd.image = [p._imageUrl];

    // ✅ OG image + title/desc + canonical + hreflang
    this.seo.update({
      title,
      description,
      canonical,
      image: p._imageUrl || undefined,
      alternates: [
        { lang: 'fr', href: altFr },
        { lang: 'en', href: altEn },
        { lang: 'x-default', href: altFr },
      ],
      jsonLd,
    });
  }

  /**
   * ✅ Retour liste
   * - si theme fourni => on revient avec ?theme=xxx pour activer le filtre côté liste
   */
  goBackToList(theme?: ThemeKey | null): void {
    const isEN = this.currentLang() === 'en';
    const target = isEN ? '/en/real-estate-valuation-news' : '/actualites-expertise-immobiliere';

    if (theme) {
      this.router.navigate([target], { queryParams: { theme } });
      return;
    }

    this.router.navigateByUrl(target);
  }

  private makeDescriptionFromHtml(html: string, maxLen = 160): string {
    const txt = this.stripHtml(html);
    if (!txt) return '';
    if (txt.length <= maxLen) return txt;
    return txt.slice(0, maxLen - 1).trim() + '…';
  }

  private stripHtml(raw: string): string {
    return (raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private makePrettySlug(title: string, maxWords = 6): string {
    const plain = this.stripHtml(title || '');
    const tokens = plain
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const cut = tokens.slice(0, maxWords).join('-');
    return cut.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'article';
  }

  /** ====== Media (copié/aligné NewsComponent) ====== */
  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src = idOrUrl?.source_url || idOrUrl?.url || idOrUrl?.medium_large || idOrUrl?.large || '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }

    if (typeof idOrUrl === 'number' || (typeof idOrUrl === 'string' && /^\d+$/.test(idOrUrl.trim()))) {
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(+idOrUrl))) || '';
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (!s) return '';
      if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
      return s;
    }

    return '';
  }

  private currentLang(): 'fr' | 'en' {
    const path = this.currentPath();
    return path.startsWith('/en') ? 'en' : 'fr';
  }

  private currentPath(): string {
    // ✅ SSR-safe : pas de window.location en SSR
    if (!this.isBrowser()) return this.router?.url || '/';
    try {
      return this.win?.location?.pathname || this.router.url || '/';
    } catch {
      return this.router.url || '/';
    }
  }
}
