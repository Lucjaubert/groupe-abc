import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
export class ServicesComponent implements OnInit, AfterViewInit, OnDestroy {
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

  /* Icônes / fallbacks */
  defaultCtxIcon = 'assets/fallbacks/icon-placeholder.svg';
  defaultRefLogo = 'assets/fallbacks/logo-placeholder.svg';

  /* ===== Refs pour animations ===== */
  @ViewChild('heroTitle') heroTitle!: ElementRef<HTMLElement>;

  @ViewChild('ctxTitle') ctxTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('ctxSub')   ctxSubRef!: ElementRef<HTMLElement>;
  @ViewChildren('ctxRow') ctxRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('ctxList')  ctxListRef!: ElementRef<HTMLElement>;

  @ViewChild('clientsTitleEl') clientsTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('cliRow') cliRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('cliList')  cliListRef!: ElementRef<HTMLElement>;

  @ViewChild('refsTitleEl') refsTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('refLogo') refLogos!: QueryList<ElementRef<HTMLImageElement>>;
  @ViewChild('refsGrid')  refsGridRef!: ElementRef<HTMLElement>;

  /* ===== Guards pour éviter les doubles animations ===== */
  private heroPlayed = false;

  ngOnInit(): void {
    this.wp.getServicesData().subscribe((payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ===== HERO ===== */
      this.pageTitle = acf?.hero?.section_title || 'Nos services';
      const heroCtx  = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title: heroCtx?.section_title || 'Contextes d’interventions',
        html : this.safe(heroCtx?.section_presentation || '')
      };

      /* ===== CONTEXTES ===== */
      const ctxObj = acf?.contexts ?? {};
      this.contexts = Object.values(ctxObj)
        .filter((it: any) => it && (it.title || it.description || it.icon))
        .map((it: any) => ({
          icon : it.icon || '',
          title: it.title || '',
          html : this.safe(it.description || '')
        }));
      this.ctxOpen = new Array(this.contexts.length).fill(false);

      /* ===== CLIENTS ===== */
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

      // ordre aléatoire
      this.references = this.shuffleArray(logos);

      /* ===== SEO ===== */
      this.seo.update({
        title: `${this.pageTitle} – Groupe ABC`,
        description: this.strip(String(heroCtx?.section_presentation || ''), 160),
        image: ''
      });

      // Lier/relier les animations après rendu
      this.scheduleBind();
    });
  }

  /* ===== Accordéons : un seul ouvert ===== */
  toggleCtx(i: number){ this.setSingleOpen(this.ctxOpen, i); }
  toggleCli(i: number){ this.setSingleOpen(this.cliOpen, i); }
  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i];
    arr.fill(false);
    if (willOpen) arr[i] = true;
  }

  /* ===== Img fallbacks ===== */
  onImgError(evt: Event){ const img = evt.target as HTMLImageElement; if (img) img.src = this.defaultCtxIcon; }
  onRefImgError(evt: Event){ const img = evt.target as HTMLImageElement; if (img) img.src = this.defaultRefLogo; }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }
  private safe(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html || ''); }
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

  /* ================= Animations ================= */
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.ctxRows?.changes?.subscribe(() => this.scheduleBind());
    this.cliRows?.changes?.subscribe(() => this.scheduleBind());
    this.refLogos?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
  }

  private bindScheduled = false;
  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      })
    );
  }

  /** Force l’état initial comme sur About (évite le flash si la CSS charge tard) */
  private forceInitialHidden(root: HTMLElement){
    const pre = Array.from(root.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private bindAnimations(): void {
    const host = document.querySelector('.services-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    const EASE = 'power3.out';

    const rmPrehide = (els: Element | Element[]) => {
      const list = Array.isArray(els) ? els : [els];
      list.forEach(el => el.classList.remove('prehide', 'prehide-row'));
    };

    /* ---------- HERO (joué une seule fois) ---------- */
    if (this.heroTitle?.nativeElement && !this.heroPlayed) {
      const el = this.heroTitle.nativeElement;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1, y: 0, duration: 0.6, ease: EASE,
          onStart: () => { rmPrehide(el); },
          onComplete: () => { gsap.set(el, { clearProps: 'all' }); this.heroPlayed = true; }
        }
      );
    }

    /* ---------- CONTEXTES ---------- */
    const ctxTitleEl = this.ctxTitleRef?.nativeElement;
    const ctxSubEl   = this.ctxSubRef?.nativeElement;
    const ctxListEl  = this.ctxListRef?.nativeElement;
    const ctxRowEls  = (this.ctxRows?.toArray() || []).map(r => r.nativeElement);

    if (ctxTitleEl) {
      gsap.fromTo(ctxTitleEl, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
        scrollTrigger: { trigger: ctxTitleEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(ctxTitleEl); },
        onComplete: () => { gsap.set(ctxTitleEl, { clearProps: 'all' }); }
      });
    }
    if (ctxSubEl) {
      gsap.fromTo(ctxSubEl, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
        scrollTrigger: { trigger: ctxSubEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(ctxSubEl); },
        onComplete: () => { gsap.set(ctxSubEl, { clearProps: 'all' }); }
      });
    }
    if (ctxListEl && ctxRowEls.length) {
      gsap.fromTo(
        ctxListEl,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1, y: 0, duration: 0.48, ease: EASE,
          scrollTrigger: { trigger: ctxListEl, start: 'top 85%', once: true },
          onStart: () => { rmPrehide([ctxListEl, ...ctxRowEls]); },
          onComplete: () => { gsap.set(ctxListEl, { clearProps: 'all' }); }
        }
      );
    }

    /* ---------- CLIENTS ---------- */
    const cliTitleEl = this.clientsTitleRef?.nativeElement;
    const cliListEl  = this.cliListRef?.nativeElement;
    const cliRowEls  = (this.cliRows?.toArray() || []).map(r => r.nativeElement);

    if (cliTitleEl) {
      gsap.fromTo(cliTitleEl, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
        scrollTrigger: { trigger: cliTitleEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(cliTitleEl); },
        onComplete: () => { gsap.set(cliTitleEl, { clearProps: 'all' }); }
      });
    }
    if (cliListEl && cliRowEls.length) {
      gsap.fromTo(
        cliListEl,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1, y: 0, duration: 0.46, ease: EASE,
          scrollTrigger: { trigger: cliListEl, start: 'top 85%', once: true },
          onStart: () => { rmPrehide([cliListEl, ...cliRowEls]); },
          onComplete: () => { gsap.set(cliListEl, { clearProps: 'all' }); }
        }
      );
    }

    /* ---------- RÉFÉRENCES ---------- */
    const refsTitleEl = this.refsTitleRef?.nativeElement;
    const refsGridEl  = this.refsGridRef?.nativeElement;
    const logoEls     = (this.refLogos?.toArray() || []).map(r => r.nativeElement);

    if (refsTitleEl) {
      gsap.fromTo(refsTitleEl, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
        scrollTrigger: { trigger: refsTitleEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(refsTitleEl); },
        onComplete: () => { gsap.set(refsTitleEl, { clearProps: 'all' }); }
      });
    }

    if (refsGridEl && logoEls.length) {
      const tl = gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: refsGridEl, start: 'top 88%', once: true }
      });

      tl.to(refsGridEl, {
        autoAlpha: 1, duration: 0.2,
        onStart: () => { rmPrehide(refsGridEl); }
      });

      tl.fromTo(
        logoEls,
        { autoAlpha: 0, y: 12, scale: 0.985 },
        {
          autoAlpha: 1, y: 0, scale: 1,
          duration: 0.42,
          ease: 'power2.out',
          stagger: 0.12,
          onStart: () => { rmPrehide(logoEls); },
          onComplete: () => { gsap.set([refsGridEl, ...logoEls], { clearProps: 'all' }); }
        },
        '-=0.05'
      );
    }

    try { ScrollTrigger.refresh(); } catch {}
  }
}
