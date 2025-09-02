import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';

type ContextIntro = { title: string; html: SafeHtml | string };
type ContextItem  = { icon?: string; title: string; html?: SafeHtml | string };
type ClientItem   = { title: string; html?: SafeHtml | string };

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);

  /* Champs */
  pageTitle = 'Nos services';

  ctxIntro: ContextIntro = { title: '', html: '' };
  contexts: ContextItem[] = [];
  ctxOpen: boolean[] = [];

  clientsTitle = '';
  clients: ClientItem[] = [];
  cliOpen: boolean[] = [];

  refsTitle = 'Ils nous font confiance';
  references: string[] = [];

  /* Icône / images de secours */
  defaultCtxIcon = 'assets/fallbacks/icon-placeholder.svg';
  defaultRefLogo = 'assets/fallbacks/logo-placeholder.svg';

  ngOnInit(): void {
    this.wp.getServicesData().subscribe((payload: any) => {
      // /wp-json/wp/v2/services?per_page=1 -> tableau avec 1 post
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ===== HERO ===== */
      this.pageTitle = acf?.hero?.section_title || 'Nos services';
      const heroCtx  = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title: heroCtx?.section_title || 'Contextes d’interventions',
        html : this.safe(heroCtx?.section_presentation || '')
      };

      /* ===== CONTEXTES (context_1..8) ===== */
      const ctxObj = acf?.contexts ?? {};
      this.contexts = Object.values(ctxObj)
        .filter((it: any) => it && (it.title || it.description || it.icon))
        .map((it: any) => ({
          icon : it.icon || '',
          title: it.title || '',
          html : this.safe(it.description || '')
        }));
      this.ctxOpen = new Array(this.contexts.length).fill(false);

      /* ===== CLIENTS =====
         (on alimente depuis acf.clients.section_clients + client_type_x si existants) */
      const clientsRoot = acf?.clients ?? {};
      const sectionClients = clientsRoot?.section_clients ?? {};
      this.clientsTitle = sectionClients?.title || 'Nos Clients';

      this.clients = Object.entries(clientsRoot)
        .filter(([k, v]) => /^client_type_/i.test(k) && v)
        .map(([, v]: any) => ({
          title: v?.client_title || '',
          html : this.safe(v?.client_description || '')
        }));
      this.cliOpen = new Array(this.clients.length).fill(false);

      /* ===== RÉFÉRENCES ===== */
      const refs = acf?.references ?? {};
      this.refsTitle = refs?.section_title || 'Ils nous font confiance';
      const logos = Object.entries(refs)
        .filter(([k, v]) => /^logo_/i.test(k) && v)
        .map(([, v]) => String(v));

      // Shuffle pour affichage aléatoire (à chaque visite / refresh)
      this.references = this.shuffleArray(logos);

      /* ===== SEO ===== */
      this.seo.update({
        title: `${this.pageTitle} – Groupe ABC`,
        description: this.strip(String(heroCtx?.section_presentation || ''), 160),
        image: ''
      });
    });
  }

  /* ===== Accordéons : un seul ouvert à la fois ===== */
  toggleCtx(i: number){ this.setSingleOpen(this.ctxOpen, i); }
  toggleCli(i: number){ this.setSingleOpen(this.cliOpen, i); }

  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i];
    arr.fill(false);
    if (willOpen) arr[i] = true;
  }

  /* ===== Img fallbacks ===== */
  onImgError(evt: Event){
    const img = evt.target as HTMLImageElement;
    if (!img) return;
    img.src = this.defaultCtxIcon;
  }
  onRefImgError(evt: Event){
    const img = evt.target as HTMLImageElement;
    if (!img) return;
    img.src = this.defaultRefLogo;
  }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }

  private safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
