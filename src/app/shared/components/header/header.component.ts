import {
  Component,
  OnDestroy,
  Inject,
  Renderer2,
  HostListener,
  AfterViewInit,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LanguageService, Lang } from '../../../services/language.service';
import { LangLinkPipe } from '../../../pipes/lang-link.pipe';

type MenuKey = 'about' | 'services' | 'methods' | 'teams' | 'news' | 'contact';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LangLinkPipe],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnDestroy, AfterViewInit {
  menuOpen = false;

  brandSrc = 'assets/img/header/logo-groupe-abc.webp';
  private brandTriedPng = false;

  private navSub?: Subscription;
  private mq?: MediaQueryList;
  private suppressCloseOnNextNav = false;

  /** Mapping FR ⇄ EN des pages canoniques */
  private readonly FR_TO_EN: Record<string, string> = {
    '/': '/en',

    '/expert-immobilier-reseau-national': '/en/expert-network-chartered-valuers',
    '/expertise-immobiliere-services': '/en/real-estate-valuation-services',
    '/methodes-evaluation-immobiliere': '/en/valuation-methods-assets',
    '/experts-immobiliers-agrees': '/en/chartered-valuers-team',
    '/actualites-expertise-immobiliere': '/en/real-estate-valuation-news',
    '/contact-expert-immobilier': '/en/contact-chartered-valuers',

    '/mentions-legales': '/en/legal-notice',
  };

  private readonly EN_TO_FR: Record<string, string> = {};

  /**
   * Routes de menu par langue.
   * Ces routes SUIVENT la langue active.
   * Cliquer sur un item ne doit JAMAIS changer de langue.
   */
  private readonly MENU_ROUTES: Record<Lang, Record<MenuKey, string>> = {
    fr: {
      // ✅ About canonique FR (plus "/")
      about: '/expert-immobilier-reseau-national',
      services: '/expertise-immobiliere-services',
      methods: '/methodes-evaluation-immobiliere',
      teams: '/experts-immobiliers-agrees',
      news: '/actualites-expertise-immobiliere',
      contact: '/contact-expert-immobilier',
    },
    en: {
      // ✅ About canonique EN (plus "/en")
      about: '/en/expert-network-chartered-valuers',
      services: '/en/real-estate-valuation-services',
      methods: '/en/valuation-methods-assets',
      teams: '/en/chartered-valuers-team',
      news: '/en/real-estate-valuation-news',
      contact: '/en/contact-chartered-valuers',
    },
  };

  /** I18N pour les libellés */
  private I18N: Record<
    Lang,
    {
      slogan_html: string;
      tagline_html: string;
      menu: string[];
      menu_overlay: string[];
      brand_text_html: string;
      extranet_text_html: string;
    }
  > = {
    fr: {
      slogan_html: `Groupement<br>d’Experts immobiliers<br>indépendants`,
      tagline_html: `Expertise amiable & judiciaire<br>en France métropolitaine<br>et Dom-Tom`,
      menu: [
        'Qui sommes-nous ?',
        'Nos Services',
        'Biens & Méthodes',
        'Équipes',
        'Actualités',
        'Contact',
      ],
      menu_overlay: [
        'QUI SOMMES-NOUS ?',
        'NOS SERVICES',
        'BIENS ET MÉTHODES',
        'ÉQUIPES',
        'ACTUALITÉS',
        'CONTACT',
      ],
      brand_text_html: `Groupement<br>d’Experts immobiliers<br>indépendants`,
      extranet_text_html: `EXTRANET`,
    },
    en: {
      slogan_html: `Group of<br>independent real estate<br>experts`,
      tagline_html: `Out-of-court & judicial expertise<br>in mainland France<br>and Overseas Territories`,
      menu: [
        'About us',
        'Our Services',
        'Assets & Methods',
        'Teams',
        'News',
        'Contact',
      ],
      menu_overlay: [
        'ABOUT US',
        'OUR SERVICES',
        'ASSETS & METHODS',
        'TEAMS',
        'NEWS',
        'CONTACT',
      ],
      brand_text_html: `Group of<br>independent real estate<br>experts`,
      extranet_text_html: `EXTRANET`,
    },
  };

  /** Langue active */
  get activeLang(): Lang {
    return this.lang.lang;
  }

  constructor(
    public lang: LanguageService,
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private doc: Document
  ) {
    // Construire EN_TO_FR à partir des canoniques
    Object.entries(this.FR_TO_EN).forEach(([fr, en]) => {
      this.EN_TO_FR[en] = fr;
    });

    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        if (!this.suppressCloseOnNextNav) {
          this.setMenu(false);
        }
        this.suppressCloseOnNextNav = false;
        this.applyI18nToDom();
      });

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mq = window.matchMedia('(max-width: 768px)');
      const onMqChange = (e: MediaQueryListEvent) => {
        if (!e.matches && this.menuOpen) this.setMenu(false);
      };
      try {
        this.mq.addEventListener('change', onMqChange);
      } catch {
        this.mq.addListener?.(onMqChange as any);
      }
    }

    this.lang.lang$.subscribe(() => this.applyI18nToDom());
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.applyI18nToDom(), 0);
  }

  /* ================= Helpers ================= */

  onBrandError(ev: Event): void {
    if (this.brandTriedPng) return;
    this.brandTriedPng = true;
    this.brandSrc = 'assets/img/header/logo-groupe-abc.png';
    const img = ev.target as HTMLImageElement | null;
    if (img) img.src = this.brandSrc;
  }

  /** Home (logo) : doit toujours aller sur la home de la langue */
  getHomeLink(): string {
    return this.activeLang === 'en' ? '/en' : '/';
  }

  /** Route de menu adaptée à la langue active */
  getLink(key: MenuKey): string {
    return this.MENU_ROUTES[this.activeLang][key];
  }

  onPrimaryAction(evt?: Event): void {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }

    const currentUrl = this.router.url || '/';
    const [pathOnly, qsHash] = currentUrl.split(/(?=[?#])/);
    const path = this.normalizePath(pathOnly);

    const currentLang: Lang =
      path === '/en' || path.startsWith('/en/') ? 'en' : 'fr';
    const targetLang: Lang = currentLang === 'fr' ? 'en' : 'fr';

    const targetPath = this.computeTargetPath(path, targetLang);
    const finalUrl = targetPath + (qsHash || '');

    this.suppressCloseOnNextNav = true;
    this.lang.set(targetLang);
    this.router.navigateByUrl(finalUrl, { replaceUrl: true });
  }

  setLang(l: Lang): void {
    const currentUrl = this.router.url || '/';
    const [pathOnly, qsHash] = currentUrl.split(/(?=[?#])/);
    const path = this.normalizePath(pathOnly);

    const targetPath = this.computeTargetPath(path, l);
    const finalUrl = targetPath + (qsHash || '');

    this.suppressCloseOnNextNav = true;
    this.lang.set(l);
    this.router.navigateByUrl(finalUrl, { replaceUrl: true });
  }

  toggleMenu(): void {
    this.setMenu(!this.menuOpen);
  }

  setMenu(state: boolean): void {
    this.menuOpen = state;
    const body = this.doc.body;
    if (state) {
      this.renderer.addClass(body, 'no-scroll');
      setTimeout(() => this.applyI18nToDom(), 0);
    } else {
      this.renderer.removeClass(body, 'no-scroll');
    }
  }

  private normalizePath(p: string): string {
    if (!p) return '/';
    const clean = p.split('?')[0].split('#')[0].replace(/\/{2,}/g, '/');
    return clean === '' ? '/' : clean;
  }

  private computeTargetPath(currPath: string, targetLang: Lang): string {
    const path = this.normalizePath(currPath);

    if (targetLang === 'en') {
      if (this.FR_TO_EN[path]) return this.FR_TO_EN[path];
      if (path === '/en' || path.startsWith('/en/')) return path;
      return path === '/' ? '/en' : `/en${path}`;
    } else {
      if (this.EN_TO_FR[path]) return this.EN_TO_FR[path];
      if (path === '/en') return '/';
      if (path.startsWith('/en/')) {
        const stripped = path.slice(3) || '/';
        return stripped === '' ? '/' : stripped;
      }
      return path || '/';
    }
  }

  private applyI18nToDom(): void {
    const L = this.activeLang;
    const dict = this.I18N[L];

    const slogan = this.doc.querySelector('.slogan') as HTMLElement | null;
    if (slogan) slogan.innerHTML = dict.slogan_html;

    const overlayBrandTxt = this.doc.querySelector(
      '.overlay-brand .brand-text'
    ) as HTMLElement | null;
    if (overlayBrandTxt) overlayBrandTxt.innerHTML = dict.brand_text_html;

    const tagline = this.doc.querySelector(
      '.tagline-text'
    ) as HTMLElement | null;
    if (tagline) tagline.innerHTML = dict.tagline_html;

    const headerMenuLinks = Array.from(
      this.doc.querySelectorAll('.menu a')
    ) as HTMLAnchorElement[];
    dict.menu.forEach((txt, i) => {
      if (headerMenuLinks[i]) headerMenuLinks[i].textContent = txt;
    });

    const overlayLinks = Array.from(
      this.doc.querySelectorAll('.overlay-nav a')
    ) as HTMLAnchorElement[];
    dict.menu_overlay.forEach((txt, i) => {
      if (overlayLinks[i]) overlayLinks[i].textContent = txt;
    });

    const extranetNodes = Array.from(
      this.doc.querySelectorAll('.extranet-badge .extranet-text')
    ) as HTMLElement[];
    extranetNodes.forEach((n) => (n.innerHTML = dict.extranet_text_html));

    const railBtn = this.doc.querySelector(
      '.lang-switch'
    ) as HTMLButtonElement | null;
    if (railBtn) {
      railBtn.setAttribute(
        'aria-label',
        L === 'fr' ? 'Basculer la langue' : 'Switch language'
      );
      railBtn.textContent = L === 'en' ? 'EN' : 'FR';
    }
  }

  closeAfterNav(): void {
    this.setMenu(false);
  }

  closeOnBackdrop(evt: MouseEvent): void {
    if ((evt.target as HTMLElement).classList.contains('menu-overlay')) {
      this.setMenu(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.menuOpen) this.setMenu(false);
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }
}
