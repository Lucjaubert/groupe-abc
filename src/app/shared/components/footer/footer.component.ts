import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

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
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {
  @Input({ required: true }) footer!: FooterSection;

  sendState: SendState = 'idle';
  messageError = '';

  private readonly sendApiBase: string = this.computeApiBase();

  constructor(private cdr: ChangeDetectorRef) {}

  private computeApiBase(): string {
    const envAny = environment as any;

    if (envAny.apiGabc) {
      return String(envAny.apiGabc).replace(/\/+$/, '');
    }

    if (envAny.apiUrl) {
      const base = String(envAny.apiUrl).replace(/\/+$/, '');
      if (base.includes('/wp-json/wp/v2')) {
        return base.replace('/wp-json/wp/v2', '/wp-json/groupeabc/v1');
      }
    }

    if (envAny.apiBase) {
      const root = String(envAny.apiBase).replace(/\/+$/, '');
      return `${root}/wp-json/groupeabc/v1`;
    }

    return '';
  }

  telHref(phone?: string | null) {
    if (!phone) return null;
    const cleaned = phone.replace(/[^\d+]/g, '');
    return `tel:${cleaned}`;
  }

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
    };

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

    if (!payload.name || !payload.email || !payload.message) {
      this.sendState = 'error';
      this.messageError = 'Merci de renseigner Nom, E-mail et Message.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.sendApiBase) {
      this.sendState = 'error';
      this.messageError = 'Configuration API manquante (apiGabc / apiUrl / apiBase).';
      this.cdr.markForCheck();
      return;
    }

    this.sendState = 'loading';
    this.messageError = '';
    this.cdr.markForCheck();

    const endpoint = `${this.sendApiBase}/send-message`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      console.log('[Footer] API →', res.status, data);

      if (res.ok && data?.status === 'success') {
        this.sendState = 'success';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.sendState = 'idle';
          form.reset();
          this.cdr.markForCheck();
        }, 3000);
      } else {
        this.sendState = 'error';
        this.messageError = data?.message || 'Échec de l’envoi.';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.sendState = 'idle';
          this.cdr.markForCheck();
        }, 3000);
      }
    } catch (e) {
      console.error('[Footer] API error', e);
      this.sendState = 'error';
      this.messageError = 'Erreur réseau.';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.sendState = 'idle';
        this.cdr.markForCheck();
      }, 3000);
    }
  }
}
