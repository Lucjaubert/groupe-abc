import {
  Component,
  OnDestroy,
  Inject,
  HostListener,
  Renderer2,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LanguageService, Lang } from '../../../services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnDestroy {
  menuOpen = false;
  currentLang: Lang = 'fr';

  private sub?: Subscription;
  private navSub?: Subscription;

  // MediaQuery mobile (≤ 768px)
  private mq?: MediaQueryList;
  private onMqChange = (e: MediaQueryListEvent) => {
    // Si on sort du mobile, on referme le menu pour ne pas polluer le desktop
    if (!e.matches && this.menuOpen) this.setMenu(false);
  };

  constructor(
    private lang: LanguageService,
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private doc: Document
  ) {
    // Langue courante + écoute des changements
    this.currentLang = this.lang.lang;
    this.sub = this.lang.lang$.subscribe((l) => (this.currentLang = l));

    // Ferme le menu à chaque navigation
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.setMenu(false));

    // Installe la media-query pour distinguer mobile / desktop
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mq = window.matchMedia('(max-width: 768px)');
      try {
        this.mq.addEventListener('change', this.onMqChange);
      } catch {
        // Safari / anciens navigateurs
        this.mq.addListener?.(this.onMqChange as any);
      }
    }
  }

  /** Action principale : burger en mobile, switch langue sinon */
  onPrimaryAction(): void {
    if (this.mq?.matches) this.toggleMenu();
    else this.onToggleLang();
  }

  toggleMenu(): void {
    this.setMenu(!this.menuOpen);
  }

  /** Ouvre/ferme + lock scroll body */
  private setMenu(state: boolean): void {
    this.menuOpen = state;
    const body = this.doc.body;
    if (state) this.renderer.addClass(body, 'no-scroll');
    else this.renderer.removeClass(body, 'no-scroll');
  }

  /** Ferme après clic sur un lien de navigation */
  closeAfterNav(): void {
    this.setMenu(false);
  }

  /** Ferme si clic sur le backdrop (pas sur le contenu) */
  closeOnBackdrop(evt: MouseEvent): void {
    if ((evt.target as HTMLElement).classList.contains('menu-overlay')) {
      this.setMenu(false);
    }
  }

  /** ESC pour fermer */
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.menuOpen) this.setMenu(false);
  }

  /** Bascule simple si deux langues */
  onToggleLang(): void {
    this.lang.toggle();
  }

  /** Fixe explicitement la langue (si LanguageService propose set) */
  setLang(l: Lang): void {
    if (this.currentLang !== l) {
      const anyLang = this.lang as any;
      if (typeof anyLang.set === 'function') anyLang.set(l);
      else this.lang.toggle(); // fallback FR/EN
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.navSub?.unsubscribe();

    if (this.mq) {
      try {
        this.mq.removeEventListener('change', this.onMqChange);
      } catch {
        this.mq.removeListener?.(this.onMqChange as any);
      }
    }
  }
}
