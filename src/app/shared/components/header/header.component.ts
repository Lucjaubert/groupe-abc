import {
  Component,
  OnDestroy,
  Inject,
  HostListener,
  Renderer2,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
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

  private mq?: MediaQueryList;
  private onMqChange = (e: MediaQueryListEvent) => {
    if (!e.matches && this.menuOpen) this.setMenu(false);
  };

  constructor(
    private lang: LanguageService,
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private doc: Document
  ) {
    // Langue courante + écoute des changements (tipée)
    this.currentLang = this.lang.lang;
    this.sub = this.lang.lang$.subscribe((l: Lang) => (this.currentLang = l));

    // Ferme le menu à chaque navigation
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.setMenu(false));

    // Media query mobile
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mq = window.matchMedia('(max-width: 768px)');
      try {
        this.mq.addEventListener('change', this.onMqChange);
      } catch {
        this.mq.addListener?.(this.onMqChange as any);
      }
    }
  }

  onPrimaryAction(): void {
    if (this.mq?.matches) this.toggleMenu();
    else this.onToggleLang();
  }

  toggleMenu(): void { this.setMenu(!this.menuOpen); }

  private setMenu(state: boolean): void {
    this.menuOpen = state;
    const body = this.doc.body;
    if (state) this.renderer.addClass(body, 'no-scroll');
    else this.renderer.removeClass(body, 'no-scroll');
  }

  closeAfterNav(): void { this.setMenu(false); }

  closeOnBackdrop(evt: MouseEvent): void {
    if ((evt.target as HTMLElement).classList.contains('menu-overlay')) {
      this.setMenu(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.menuOpen) this.setMenu(false); }

  onToggleLang(): void { this.lang.toggle(); }

  setLang(l: Lang): void {
    if (this.currentLang !== l) this.lang.set(l);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.navSub?.unsubscribe();
    if (this.mq) {
      try { this.mq.removeEventListener('change', this.onMqChange); }
      catch { this.mq.removeListener?.(this.onMqChange as any); }
    }
  }
}
