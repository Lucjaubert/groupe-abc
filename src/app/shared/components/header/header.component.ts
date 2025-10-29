import {
  Component, OnDestroy, Inject, Renderer2, HostListener, AfterViewInit
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LanguageService, Lang } from '../../../services/language.service';
import { LangLinkPipe } from '../../../pipes/lang-link.pipe';

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

  private onMqChange = (e: MediaQueryListEvent) => {
    if (!e.matches && this.menuOpen) this.setMenu(false);
  };

  /** Dictionnaire I18N */
  private I18N: Record<Lang, {
    slogan_html: string;
    tagline_html: string;
    menu: string[];
    menu_overlay: string[];
    brand_text_html: string;   // ← on garde la clé pour compat, mais on la calera = slogan_html
    extranet_text_html: string;
  }> = {
    fr: {
      slogan_html: `Groupement<br>d’Experts immobiliers<br>indépendants`,
      tagline_html: `Expertise amiable & judiciaire<br>en France métropolitaine<br>et Dom-Tom`,
      menu: ['Qui sommes-nous ?','Nos Services','Biens & Méthodes','Équipes','Actualités','Contact'],
      menu_overlay: ['QUI SOMMES-NOUS ?','NOS SERVICES','BIENS ET MÉTHODES','ÉQUIPES','ACTUALITÉS','CONTACT'],
      brand_text_html: `Groupement<br>d’Experts immobiliers<br>indépendants`,
      extranet_text_html: `EXTRANET`,
    },
    en: {
      // ✅ mêmes 3 lignes en EN (orthographe corrigée)
      slogan_html: `Group of<br>independent real estate<br>experts`,
      tagline_html: `Out-of-court & judicial expertise<br>in mainland France<br>and Overseas Territories`,
      menu: ['About us','Our Services','Assets & Methods','Teams','News','Contact'],
      menu_overlay: ['ABOUT US','OUR SERVICES','ASSETS & METHODS','TEAMS','NEWS','CONTACT'],
      // on force brand_text_html identique au slogan pour overlay
      brand_text_html: `Group of<br>independent real estate<br>experts`,
      extranet_text_html: `EXTRANET`,
    }
  };

  constructor(
    public lang: LanguageService,
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.syncLangFromUrl();
    this.applyI18nToDom();

    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncLangFromUrl();
        setTimeout(() => this.applyI18nToDom(), 0);

        if (!this.suppressCloseOnNextNav) {
          this.setMenu(false);
        }
        this.suppressCloseOnNextNav = false;
      });

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mq = window.matchMedia('(max-width: 768px)');
      try { this.mq.addEventListener('change', this.onMqChange); }
      catch { this.mq.addListener?.(this.onMqChange as any); }
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.applyI18nToDom(), 0);
  }

  private syncLangFromUrl(): void {
    const url = this.router.url || '/';
    const path = url.split('?')[0].split('#')[0];
    const first = path.split('/').filter(Boolean)[0];
    const fromUrl: Lang = first === 'en' ? 'en' : 'fr';
    if (this.lang.lang !== fromUrl) this.lang.set(fromUrl);
  }

  private goToLang(target: Lang): void {
    const full = this.router.url || '/';
    const [beforeHash, hash = ''] = full.split('#');
    const [pathname, qs = ''] = beforeHash.split('?');

    const pathNoEn = pathname.startsWith('/en') ? (pathname.slice(3) || '/') : pathname;
    const nextPath = target === 'en'
      ? (pathNoEn === '/' ? '/en' : '/en' + pathNoEn)
      : pathNoEn;

    const nextUrl = nextPath + (qs ? `?${qs}` : '') + (hash ? `#${hash}` : '');
    this.router.navigateByUrl(nextUrl);
  }

  onBrandError(ev: Event): void {
    if (this.brandTriedPng) return;
    this.brandTriedPng = true;
    this.brandSrc = 'assets/img/header/logo-groupe-abc.png';
    const img = ev.target as HTMLImageElement | null;
    if (img) img.src = this.brandSrc;
  }

  onPrimaryAction(evt?: Event): void {
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    const current: Lang = this.lang.lang;
    const target: Lang  = current === 'fr' ? 'en' : 'fr';
    this.lang.set(target);
    this.applyI18nToDom();
    this.suppressCloseOnNextNav = true;
    this.goToLang(target);
  }

  setLang(l: Lang): void {
    if (this.lang.lang !== l) {
      this.lang.set(l);
      this.applyI18nToDom();
      this.suppressCloseOnNextNav = true;
      this.goToLang(l);
    }
  }

  toggleMenu(): void { this.setMenu(!this.menuOpen); }

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

  /** Applique FR/EN dans le DOM – slogan & overlay brand synchronisés */
  private applyI18nToDom(): void {
    const L = this.lang.lang;
    const dict = this.I18N[L];

    // même HTML pour le slogan du header et le texte de marque de l’overlay
    const slogan = this.doc.querySelector('.slogan') as HTMLElement | null;
    if (slogan) slogan.innerHTML = dict.slogan_html;

    const overlayBrandTxt = this.doc.querySelector('.overlay-brand .brand-text') as HTMLElement | null;
    if (overlayBrandTxt) overlayBrandTxt.innerHTML = dict.slogan_html;

    const tagline = this.doc.querySelector('.tagline-text') as HTMLElement | null;
    if (tagline) tagline.innerHTML = dict.tagline_html;

    const headerMenuLinks = Array.from(this.doc.querySelectorAll('.menu a')) as HTMLAnchorElement[];
    dict.menu.forEach((txt, i) => { if (headerMenuLinks[i]) headerMenuLinks[i].textContent = txt; });

    const overlayLinks = Array.from(this.doc.querySelectorAll('.overlay-nav a')) as HTMLAnchorElement[];
    dict.menu_overlay.forEach((txt, i) => { if (overlayLinks[i]) overlayLinks[i].textContent = txt; });

    const extranetNodes = Array.from(this.doc.querySelectorAll('.extranet-badge .extranet-text')) as HTMLElement[];
    extranetNodes.forEach(n => n.innerHTML = dict.extranet_text_html);

    const railBtn = this.doc.querySelector('.lang-switch') as HTMLButtonElement | null;
    if (railBtn) {
      railBtn.setAttribute('aria-label', L === 'fr' ? 'Basculer la langue' : 'Switch language');
      railBtn.textContent = (L === 'en') ? 'EN' : 'FR';
    }
  }

  closeAfterNav(): void { this.setMenu(false); }

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
    if (this.mq) {
      try { this.mq.removeEventListener('change', this.onMqChange); }
      catch { this.mq.removeListener?.(this.onMqChange as any); }
    }
  }
}
