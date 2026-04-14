import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  Inject,
  PLATFORM_ID,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { LangLinkPipe } from '../../../pipes/lang-link.pipe';
import { ContactService } from '../../../services/contact.service';

export interface FooterLink { label: string; url: string; external?: boolean; }
export interface FooterSocial { label: string; url: string; }
export interface FooterSection {
  title: string;
  subtitle?: string;
  phone_label?: string; phone?: string;
  email_label?: string; email?: string;
  address_label?: string; address?: string;
  cta_text?: string; cta_url?: string;
  links?: FooterLink[];
  socials?: FooterSocial[];
}

type SendState = 'idle' | 'loading' | 'success' | 'error';
type Lang = 'fr' | 'en';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, LangLinkPipe],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent implements OnInit, OnDestroy {
  @Input({ required: true }) footer!: FooterSection;

  sendState: SendState = 'idle';
  messageError = '';

  /** ✅ Lang courante exposée au template */
  currentLang: Lang = 'fr';

  /**
   * ✅ FIX Mentions légales :
   * EN n'est pas "/en/mentions-legales" mais "/en/legal-notice"
   * -> on génère un routerLink correct selon la langue courante
   */
  get legalRouteLink(): any[] {
    return this.currentLang === 'en'
      ? ['/en/legal-notice']
      : ['/mentions-legales'];
  }

  private subs = new Subscription();
  private readonly isBrowser: boolean;

  constructor(
    private cdr: ChangeDetectorRef,
    private contact: ContactService,
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Lang au chargement
    this.currentLang = this.detectLangNow();
    this.cdr.markForCheck();

    // Sur navigation : /en/... => EN, sinon FR
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => {
          const next = this.detectLangNow();
          if (next !== this.currentLang) {
            this.currentLang = next;
            this.cdr.markForCheck();
          }
        })
    );

    // Weglot events (si présent)
    if (this.isBrowser) {
      try {
        const wg: any = (window as any).Weglot;
        if (wg?.on) {
          const onChanged = (lang: string) => {
            const next: Lang = lang === 'en' ? 'en' : 'fr';
            if (next !== this.currentLang) {
              this.currentLang = next;
              this.cdr.markForCheck();
            }
          };

          wg.on('initialized', () => onChanged(wg.getCurrentLang?.()));
          wg.on('languageChanged', (newLang: string) => onChanged(newLang));

          // cleanup
          this.subs.add({
            unsubscribe: () => {
              try { wg?.off?.('initialized', onChanged); } catch {}
              try { wg?.off?.('languageChanged', onChanged); } catch {}
            }
          });
        }
      } catch {}
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // 👉 Getters utilisés dans le template
  get isLoading(): boolean { return this.sendState === 'loading'; }
  get isSuccess(): boolean { return this.sendState === 'success'; }
  get isError(): boolean { return this.sendState === 'error'; }

  // --- Liens externes (pour le template si besoin) ----------
  isExternal(url?: string | null): boolean {
    if (!url) return false;
    return /^(?:https?:|mailto:|tel:|#)/i.test(url);
  }

  telHref(phone?: string | null) {
    if (!phone) return null;
    const cleaned = phone.replace(/[^\d+]/g, '');
    return `tel:${cleaned}`;
  }

  // --- Quand l'utilisateur modifie un champ, on repasse à "idle"
  onFormChange() {
    if (this.sendState === 'success' || this.sendState === 'error') {
      this.sendState = 'idle';
      this.cdr.markForCheck();
    }
  }

  // ---------------- Formulaire ------------------------------
  async onSubmit(ev: Event) {
    ev.preventDefault();
    if (this.sendState === 'loading') return;

    const form = ev.target as HTMLFormElement;
    const fd   = new FormData(form);

    const payload = {
      name:    String(fd.get('name') ?? '').trim(),
      email:   String(fd.get('email') ?? '').trim(),
      phone:   String(fd.get('phone') ?? '').trim(),
      message: String(fd.get('message') ?? '').trim(),
      website: String(fd.get('website') ?? ''),
      source:  'footer',
      lang:    this.currentLang, // ✅ en/fr selon la version affichée
    };

    // Honeypot → succès immédiat (on reste en vert, bouton désactivé)
    if (payload.website) {
      this.sendState = 'success';
      form.reset();
      this.cdr.markForCheck();
      return;
    }

    // Validations mini
    if (!payload.name || !payload.email || !payload.message) {
      this.sendState = 'error';
      this.messageError = 'Merci de renseigner Nom, E-mail et Message.';
      this.cdr.markForCheck();
      return;
    }

    this.sendState = 'loading';
    this.messageError = '';
    this.cdr.markForCheck();

    try {
      await this.contact.send(payload);
      this.sendState = 'success'; // reste vert tant que l'utilisateur ne retape pas
      form.reset();               // on vide le formulaire
      this.cdr.markForCheck();
    } catch (e: any) {
      console.error('[Footer] API error', e);
      this.sendState = 'error';
      this.messageError = e?.message || 'Échec de l’envoi.';
      this.cdr.markForCheck();

      // Option : repasser en idle après quelques secondes sur erreur
      setTimeout(() => {
        this.sendState = 'idle';
        this.cdr.markForCheck();
      }, 3000);
    }
  }

  // ===========================
  // Lang detection
  // ===========================
  private detectLangNow(): Lang {
    // 1) Weglot (prioritaire côté browser)
    if (this.isBrowser) {
      try {
        const wg: any = (window as any).Weglot;
        const l = wg?.getCurrentLang?.();
        if (l === 'en' || l === 'fr') return l;
      } catch {}
    }

    // 2) URL
    try {
      const url = (this.router?.url || '').split('?')[0].split('#')[0];
      if (url === '/en' || url.startsWith('/en/')) return 'en';
    } catch {}

    // 3) <html lang="">
    try {
      const htmlLang = (this.doc?.documentElement?.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('fr')) return 'fr';
    } catch {}

    return 'fr';
  }
}
