import {
  Component, OnDestroy, Inject, Renderer2
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
export class HeaderComponent implements OnDestroy {
  menuOpen = false;

  brandSrc = 'assets/img/header/logo-groupe-abc.webp';
  private brandTriedPng = false;

  private navSub?: Subscription;
  private mq?: MediaQueryList;
  private onMqChange = (e: MediaQueryListEvent) => {
    if (!e.matches && this.menuOpen) this.setMenu(false);
  };

  constructor(
    public lang: LanguageService,
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.syncLangFromUrl();

    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncLangFromUrl();
        this.setMenu(false);
      });

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mq = window.matchMedia('(max-width: 768px)');
      try { this.mq.addEventListener('change', this.onMqChange); }
      catch { this.mq.addListener?.(this.onMqChange as any); }
    }
  }

  /** Aligne le service de langue sur l’URL courante */
  private syncLangFromUrl(): void {
    const url = this.router.url || '/';
    const path = url.split('?')[0].split('#')[0];
    const first = path.split('/').filter(Boolean)[0];
    const fromUrl: Lang = first === 'en' ? 'en' : 'fr';
    if (this.lang.lang !== fromUrl) {
      this.lang.set(fromUrl);
    }
  }

  /** Construit l’URL cible dans la langue demandée (en conservant path, query, hash) */
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

  /** Bascule FR ↔ EN OBLIGATOIREMENT à chaque clic sur le bouton carré */
  onLangButtonClick(evt?: Event): void {
    if (evt) {
      // support Space/Enter depuis le clavier + évite scroll avec Space
      evt.preventDefault();
      evt.stopPropagation();
    }
    const current: Lang = this.lang.lang;
    const target: Lang = current === 'fr' ? 'en' : 'fr';
    this.goToLang(target);
  }

  /** Choix explicite depuis l’overlay (FR ou EN) */
  setLang(l: Lang): void {
    this.goToLang(l);
  }

  /** Gestion menu overlay (contrôle séparé du bouton langue) */
  toggleMenu(): void { this.setMenu(!this.menuOpen); }

  private setMenu(state: boolean): void {
    this.menuOpen = state;
    const body = this.doc.body;

    if (state) {
      this.renderer.addClass(body, 'no-scroll');
      const target =
        this.doc.querySelector('.menu-overlay-inner') ||
        this.doc.querySelector('.menu-overlay') ||
        this.doc.querySelector('.overlay-top') ||
        body;
      this.wgAddNodes(target as Element);
    } else {
      this.renderer.removeClass(body, 'no-scroll');
    }
  }

  private wgAddNodes(target?: Element): void {
    try {
      const wg: any = (window as any).Weglot;
      if (!wg?.addNodes) return;
      setTimeout(() => wg.addNodes([target || this.doc.body]), 0);
    } catch { /* no-op */ }
  }

  closeAfterNav(): void { this.setMenu(false); }

  closeOnBackdrop(evt: MouseEvent): void {
    if ((evt.target as HTMLElement).classList.contains('menu-overlay')) {
      this.setMenu(false);
    }
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    if (this.mq) {
      try { this.mq.removeEventListener('change', this.onMqChange); }
      catch { this.mq.removeListener?.(this.onMqChange as any); }
    }
  }
}
