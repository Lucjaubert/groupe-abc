import {
  Component,
  OnInit,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import {
  CommonModule,
  isPlatformBrowser,
} from '@angular/common';
import {
  ActivatedRoute,
  Router,
  RouterModule,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { getSeoForRoute } from '../../config/seo.routes';
import { environment } from '../../../environments/environment';

type Lang = 'fr' | 'en';
type ThemeKey = 'expertise' | 'juridique' | 'marche' | 'autre';

type NewsPost = {
  id?: number | string;
  slug?: string;
  theme?: string;
  themeKey?: ThemeKey;
  firmLogo?: string | number;
  firmName?: string;
  author?: string;
  date?: string;
  title?: string;
  html?: string;
  imageUrl?: string | number;
  linkedinUrl?: string;
  _imageUrl?: string;
  _firmLogoUrl?: string;
};

@Component({
  selector: 'app-news-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './news-detail.component.html',
  styleUrls: ['./news-detail.component.scss'],
})
export class NewsDetailComponent implements OnInit {
  private wp = inject(WordpressService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private seo = inject(SeoService);
  private platformId = inject(PLATFORM_ID);

  post: NewsPost | null = null;
  loading = true;
  lang: Lang = 'fr';

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  async ngOnInit(): Promise<void> {
    try {
      this.lang = this.currentPath().startsWith('/en/') ? 'en' : 'fr';

      const slug = this.route.snapshot.paramMap.get('slug');
      if (!slug) {
        await this.router.navigate(['/404']);
        return;
      }

      const list: any[] = await firstValueFrom(this.wp.getAllNews());
      const it = list.find(
        (item) =>
          item?.slug === slug ||
          String(item?.id) === slug,
      );

      if (!it) {
        await this.router.navigate(['/404']);
        return;
      }

      const mapped = await this.mapOne(it);
      this.post = mapped;

      // SEO dynamiques pour l’article
      this.applySeo(mapped);

      this.loading = false;
    } catch {
      this.loading = false;
      await this.router.navigate(['/404']);
    }
  }

  /* ================= Helpers données ================= */

  private async mapOne(it: any): Promise<NewsPost> {
    const p = it?.acf?.post || {};

    const firmLogo: string | number | undefined =
      typeof p.logo_firm === 'number' ||
      typeof p.logo_firm === 'string'
        ? p.logo_firm
        : undefined;

    const imageUrl: string | number | undefined =
      typeof p.post_image === 'number' ||
      typeof p.post_image === 'string'
        ? p.post_image
        : undefined;

    const post: NewsPost = {
      id: it?.id,
      slug: it?.slug,
      theme: p.theme || '',
      themeKey: this.toThemeKey(p.theme),
      firmLogo,
      firmName: p.nam_firm || '',
      author: p.author || '',
      date: p.date || it?.date || '',
      title: p.post_title || it?.title?.rendered || '',
      html: p.post_content || it?.content?.rendered || '',
      imageUrl,
      linkedinUrl: p.linkedin_link || '',
    };

    // Résolution des URLs d’image/logo
    const img = await this.resolveMedia(post.imageUrl);
    const logo = await this.resolveMedia(post.firmLogo);
    if (img) post._imageUrl = img;
    if (logo) post._firmLogoUrl = logo;

    return post;
  }

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

  /* ================= Helpers media ================= */

  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';
    if (typeof idOrUrl === 'object') {
      const src =
        idOrUrl?.source_url ||
        idOrUrl?.url ||
        idOrUrl?.medium_large ||
        idOrUrl?.large ||
        '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }

    if (
      typeof idOrUrl === 'number' ||
      (typeof idOrUrl === 'string' &&
        /^\d+$/.test(idOrUrl.trim()))
    ) {
      try {
        return (
          (await firstValueFrom(
            this.wp.getMediaUrl(+idOrUrl),
          )) || ''
        );
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (!s) return '';
      if (
        /^(https?:)?\/\//.test(s) ||
        s.startsWith('/') ||
        s.startsWith('data:')
      )
        return s;
      return s;
    }

    return '';
  }

  /* ================= Helpers généraux ================= */

  private currentPath(): string {
    if (this.isBrowser()) {
      try {
        return window?.location?.pathname || '/';
      } catch {
        return this.router?.url || '/';
      }
    }
    return this.router?.url || '/';
  }

  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url)) return url;
      if (/^\/\//.test(url)) return 'https:' + url;
      const o = origin.replace(/\/+$/, '');
      return url.startsWith('/') ? o + url : `${o}/${url}`;
    } catch {
      return url;
    }
  }

  private strip(html: string | undefined, max = 160): string {
    const t = (html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  /* ================= SEO dynamiques ================= */

  private applySeo(post: NewsPost): void {
    const lang: Lang = this.lang;
    const isEN = lang === 'en';

    const baseSeo = getSeoForRoute('news-list', lang);

    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(
      /\/+$/,
      '',
    );

    const path = this.currentPath() || '/';
    const canonicalAbs = `${siteUrl}${path}`;

    const baseTitle = baseSeo.title || (isEN ? 'News' : 'Actualités');
    const postTitle = (post.title || '').trim();
    const title = postTitle
      ? `${postTitle} – Groupe ABC`
      : baseTitle;

    const descriptionFromPost = this.strip(post.html, 160);
    const description =
      descriptionFromPost || baseSeo.description || baseTitle;

    const ogCandidate =
      post._imageUrl || baseSeo.image || '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(ogCandidate, siteUrl);

    const articleNode: any = {
      '@type': 'Article',
      '@id': `${canonicalAbs}#article`,
      headline: postTitle || baseTitle,
      description,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalAbs,
      },
      url: canonicalAbs,
      image: ogAbs,
    };

    if (post.date) {
      articleNode.datePublished = post.date;
    }
    if (post.author) {
      articleNode.author = {
        '@type': 'Person',
        name: post.author,
      };
    }
    articleNode.publisher = {
      '@type': 'Organization',
      name: 'Groupe ABC – Experts immobiliers agréés',
    };

    const existingJsonLd: any = baseSeo.jsonLd;
    let baseGraph: any[] = [];
    let baseContext = 'https://schema.org';

    if (existingJsonLd) {
      if (Array.isArray(existingJsonLd['@graph'])) {
        baseGraph = existingJsonLd['@graph'];
      } else {
        baseGraph = [existingJsonLd];
      }
      if (typeof existingJsonLd['@context'] === 'string') {
        baseContext = existingJsonLd['@context'];
      }
    }

    const jsonLd = {
      '@context': baseContext,
      '@graph': [...baseGraph, articleNode],
    };

    this.seo.update({
      ...baseSeo,
      title,
      description,
      canonical: canonicalAbs,
      type: 'article',
      image: ogAbs,
      imageAlt:
        baseSeo.imageAlt ||
        (isEN
          ? 'Groupe ABC – Real-estate valuation article'
          : 'Groupe ABC – Article expertise immobilière'),
      jsonLd,
    });
  }

  /* ================= Helpers template ================= */

  backLink(): any[] {
    return this.lang === 'en'
      ? ['/en', 'news-real-estate-valuation']
      : ['/actualites-expertise-immobiliere'];
  }
}
