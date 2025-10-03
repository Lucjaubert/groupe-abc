import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LangLinkPipe } from '../../../pipes/lang-link.pipe';
import { ContactService } from '../../../services/contact.service'; // ⬅️ service d’envoi

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

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, LangLinkPipe],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {
  @Input({ required: true }) footer!: FooterSection;

  sendState: SendState = 'idle';
  messageError = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private contact: ContactService,          // ⬅️ injection du service
  ) {}

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
      website: String(fd.get('website') ?? ''), // honeypot
      source:  'footer',
      lang:    'fr', // ajuste si tu as un LanguageService
    };

    // Honeypot
    if (payload.website) {
      this.sendState = 'success';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.sendState = 'idle';
        form.reset();
        this.cdr.markForCheck();
      }, 1500);
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
      this.sendState = 'success';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.sendState = 'idle';
        form.reset();
        this.cdr.markForCheck();
      }, 3000);
    } catch (e: any) {
      console.error('[Footer] API error', e);
      this.sendState = 'error';
      this.messageError = e?.message || 'Échec de l’envoi.';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.sendState = 'idle';
        this.cdr.markForCheck();
      }, 3000);
    }
  }
}
