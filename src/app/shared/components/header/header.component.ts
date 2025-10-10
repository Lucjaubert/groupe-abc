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
  /** Empêche la fermeture de l’overlay sur la prochaine navigation (ex : changement de langue) */
  private suppressCloseOnNextNav = false;

  private onMqChange = (e: MediaQueryListEvent) => {
    if (!e.matches && this.menuOpen) this.setMenu(false);
  };

  /** Dictionnaire I18N “en dur” */
  private I18N: Record<Lang, {
    slogan_html: string;
    tagline_html: string;
    menu: string[];
    menu_overlay: string[];
    brand_text_html: string;
    extranet_text_html: string;
  }> = {
    fr: {
      slogan_html: `Groupement<br>d’Experts immobiliers<br>indépendants`,
      tagline_html: `Expertise amiable & judiciaire<br>en France métropolitaine<br>et Dom-Tom`,
      menu: ['Qui sommes-nous ?','Nos Services','Biens & Méthodes','Équipes','Actualités','Contact'],
      menu_overlay: ['QUI SOMMES-NOUS ?','NOS SERVICES','BIENS ET MÉTHODES','ÉQUIPES','ACTUALITÉS','CONTACT'],
      brand_text_html: `Groupement<br>d’Experts immobiliers<br>indépendants`,
      extranet_text_html: `GROUPE ABC <span class="extranet-slash">/</span> EXTRANET`,
    },
    en: {
      // 3 lignes comme demandé
      slogan_html: `Groupe of independant<br>real estate<br>experts`,
      tagline_html: `Out-of-court & judicial expertise<br>in mainland France<br>and Overseas Territories`,
      menu: ['About us','Our Services','Assets & Methods','Teams','News','Contact'],
      menu_overlay: ['ABOUT US','OUR SERVICES','ASSETS & METHODS','TEAMS','NEWS','CONTACT'],
      brand_text_html: `Groupe of independant<br>real estate<br>experts`,
      extranet_text_html: `ABC GROUP <span class="extranet-slash">/</span> EXTRANET`,
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

        // Ne pas fermer l’overlay si la nav vient d’un clic FR/ENG
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

  /** Aligne la langue sur l’URL courante */
  private syncLangFromUrl(): void {
    const url = this.router.url || '/';
    const path = url.split('?')[0].split('#')[0];
    const first = path.split('/').filter(Boolean)[0];
    const fromUrl: Lang = first === 'en' ? 'en' : 'fr';
    if (this.lang.lang !== fromUrl) this.lang.set(fromUrl);
  }

  /** Construit l’URL cible dans la langue demandée */
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

  /** Fallback PNG du logo */
  onBrandError(ev: Event): void {
    if (this.brandTriedPng) return;
    this.brandTriedPng = true;
    this.brandSrc = 'assets/img/header/logo-groupe-abc.png';
    const img = ev.target as HTMLImageElement | null;
    if (img) img.src = this.brandSrc;
  }

  /**
   * Action principale du bouton du rail :
   * - MOBILE : ouvre/ferme l’overlay
   * - DESKTOP : bascule la langue (et reste sur la page)
   */
  onPrimaryAction(evt?: Event): void {
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    if (this.mq?.matches) {
      this.toggleMenu();
    } else {
      const current: Lang = this.lang.lang;
      const target: Lang = current === 'fr' ? 'en' : 'fr';
      this.lang.set(target);
      this.applyI18nToDom();
      this.suppressCloseOnNextNav = true;   // ne pas fermer si la nav est due au switch langue
      this.goToLang(target);
    }
  }

  /** Choix explicite depuis l’overlay (FR ou EN) — garder l’overlay ouvert */
  setLang(l: Lang): void {
    if (this.lang.lang !== l) {
      this.lang.set(l);
      this.applyI18nToDom();
      this.suppressCloseOnNextNav = true;   // ⬅️ clé : l’overlay reste ouvert
      this.goToLang(l);
    }
  }

  /** Gestion menu overlay */
  toggleMenu(): void { this.setMenu(!this.menuOpen); }

  /** Publique car appelée depuis le template (bouton X) */
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

  /** Applique les libellés FR/EN dans le DOM (sans Weglot) */
  private applyI18nToDom(): void {
    const L = this.lang.lang;
    const dict = this.I18N[L];

    const slogan = this.doc.querySelector('.slogan') as HTMLElement | null;
    if (slogan) slogan.innerHTML = dict.slogan_html;

    const tagline = this.doc.querySelector('.tagline-text') as HTMLElement | null;
    if (tagline) tagline.innerHTML = dict.tagline_html;

    const headerMenuLinks = Array.from(this.doc.querySelectorAll('.menu a')) as HTMLAnchorElement[];
    dict.menu.forEach((txt, i) => { if (headerMenuLinks[i]) headerMenuLinks[i].textContent = txt; });

    const overlayBrandTxt = this.doc.querySelector('.overlay-brand .brand-text') as HTMLElement | null;
    if (overlayBrandTxt) overlayBrandTxt.innerHTML = dict.brand_text_html;

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
