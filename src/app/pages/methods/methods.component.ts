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

/* ===== Types ===== */
type Hero = { title: string; subtitle?: string; html?: SafeHtml | string };

type DomainItem = {
  kind: 'text' | 'group';
  text?: string;
  title?: string;
  sub?: string[];
};

type Domain = { title: string; icon?: string; items: DomainItem[] };

/** Wheel sans labels : on n’affiche que l’image centrale */
type Wheel = {
  title: string;
  image?: string;
  centerAlt?: string;
};

type EvalMethod = { icon?: string; title: string; html?: SafeHtml | string };

type Piloting = { html?: SafeHtml | string; flows: { src: string; caption?: string }[] };

@Component({
  selector: 'app-methods',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './methods.component.html',
  styleUrls: ['./methods.component.scss']
})
export class MethodsComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);

  /* ===== Données ===== */
  hero: Hero = { title: 'Biens & Méthodes', subtitle: '', html: '' };

  domains: Domain[] = [];
  wheel: Wheel = { title: '', image: '', centerAlt: '' };

  evalTitleText = 'Nos méthodes d’évaluation';
  methods: EvalMethod[] = [];
  evalOpen: boolean[] = [];

  pilotingTitle = 'Pilotage des missions';
  piloting: Piloting = { html: '', flows: [] };

  /* ===== Fallbacks ===== */
  defaultDomainIcon = 'assets/fallbacks/icon-placeholder.svg';
  defaultEvalIcon   = 'assets/fallbacks/icon-placeholder.svg';
  defaultPilotImg   = 'assets/fallbacks/image-placeholder.svg';
  defaultWheelImg   = 'assets/fallbacks/image-placeholder.svg';

  /* ===== Refs Animations ===== */
  @ViewChild('heroTitle')     heroTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('heroSubtitle')  heroSubRef!: ElementRef<HTMLElement>;
  @ViewChild('heroIntro')     heroIntroRef!: ElementRef<HTMLElement>;

  @ViewChildren('assetCol') assetCols!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('assetsList') assetsListRef!: ElementRef<HTMLElement>;

  @ViewChild('wheelTitle') wheelTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('wheelWrap')  wheelWrapRef!: ElementRef<HTMLElement>;

  @ViewChild('evalTitle') evalTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('evalRow') evalRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('evalList')  evalListRef!: ElementRef<HTMLElement>;

  @ViewChild('pilotTitle') pilotTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('pilotIntro') pilotIntroRef!: ElementRef<HTMLElement>;
  @ViewChild('pilotGrid')  pilotGridRef!: ElementRef<HTMLElement>;

  /* ===== Init ===== */
  ngOnInit(): void {
    this.wp.getMethodsData().subscribe((payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ---------- HERO ---------- */
      this.hero = {
        title   : acf?.hero?.section_title || 'Biens & Méthodes',
        subtitle: acf?.hero?.section_subtitle || '',
        html    : this.safe(acf?.hero?.intro_body || '')
      };

      /* ---------- DOMAINES ---------- */
      const ad = acf?.asset_domains ?? {};
      const list: any[] = [ad?.domain_1, ad?.domain_2, ad?.domain_3].filter(Boolean);

      this.domains = list.map((d: any) => {
        const items: DomainItem[] = [];
        for (let i = 1; i <= 4; i++) {
          const v = d?.[`item_${i}`];
          if (typeof v === 'string' && v.trim()) items.push({ kind: 'text', text: v.trim() });
        }
        const it5 = d?.item_5;
        if (it5 && (it5.item_5_title || it5.item_5_subtitle_1 || it5.item_5_subtitle_2 || it5.item_5_subtitle_3)) {
          const sub = [it5.item_5_subtitle_1, it5.item_5_subtitle_2, it5.item_5_subtitle_3]
            .filter((s: any) => (s || '').toString().trim())
            .map((s: string) => s.trim());
          items.push({ kind: 'group', title: (it5.item_5_title || '').trim(), sub });
        }
        if (typeof d?.item_6 === 'string' && d.item_6.trim()) {
          items.push({ kind: 'text', text: d.item_6.trim() });
        }

        return {
          title: d?.title || '',
          icon : d?.icon || d?.icon_1 || d?.icon_2 || '',
          items
        } as Domain;
      });

      /* ---------- VALEURS (image uniquement) ---------- */
      const vw = acf?.values_wheel ?? {};
      this.wheel = {
        title    : vw?.section_title || 'Un immeuble, des valeurs',
        image    : '',
        centerAlt: (vw?.center_label || '').toString()
      };

      const wimg = vw?.wheel_image;
      const setWheelUrl = (url: string) => { if (url) this.wheel.image = url; };
      if (typeof wimg === 'number') this.wp.getMediaUrl(wimg).subscribe(setWheelUrl);
      else if (typeof wimg === 'string') setWheelUrl(wimg);
      else if (wimg && typeof wimg === 'object') setWheelUrl(wimg.url || wimg.source_url || '');

      /* ---------- MÉTHODES ---------- */
      const mroot = acf?.methods ?? {};
      this.evalTitleText = mroot?.section_title || 'Nos méthodes d’évaluation';

      const keys = Object.keys(mroot).filter(k => /^method_\d+$/i.test(k));
      const coll = keys.map(k => mroot[k]).filter(Boolean);

      this.methods = coll
        .filter((m: any) => m?.title || m?.description || m?.icon)
        .map((m: any) => ({
          icon : m?.icon || '',
          title: m?.title || '',
          html : this.safe(m?.description || '')
        }));
      this.evalOpen = new Array(this.methods.length).fill(false);

      /* ---------- PILOTAGE ---------- */
      const pil = acf?.mission_piloting ?? {};
      this.pilotingTitle = pil?.section_title || 'Pilotage des missions';
      this.piloting = {
        html: this.safe(pil?.intro_body || ''),
        flows: [
          pil?.flow_1 ? { src: pil.flow_1, caption: 'Demande d’expertise régionale (bien)' } : null,
          pil?.flow_2 ? { src: pil.flow_2, caption: 'Demande d’expertise nationale (portefeuille)' } : null
        ].filter(Boolean) as {src: string; caption?: string}[]
      };

      /* ---------- SEO ---------- */
      const introForDesc = (acf?.hero?.intro_body || '').toString();
      this.seo.update({
        title: `${this.hero.title} – Groupe ABC`,
        description: this.strip(introForDesc, 160),
        image: ''
      });

      this.scheduleBind();
    });
  }

  /* ===== Accordéon des méthodes ===== */
  toggleEval(i: number){ this.setSingleOpen(this.evalOpen, i); }
  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i]; arr.fill(false); if (willOpen) arr[i] = true;
  }

  /* ===== Img fallbacks ===== */
  onDomainImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultDomainIcon; }
  onMethodImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultEvalIcon; }
  onPilotImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultPilotImg; }
  onWheelImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultWheelImg; }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }
  private safe(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html || ''); }
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  /* ================= Animations ================= */
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.assetCols?.changes?.subscribe(() => this.scheduleBind());
    this.evalRows?.changes?.subscribe(() => this.scheduleBind());
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
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  private bindAnimations(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    const EASE = 'power3.out';
    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));
    };

    /* ---------- HERO ---------- */
    const h1 = this.heroTitleRef?.nativeElement;
    const h2 = this.heroSubRef?.nativeElement;
    const hi = this.heroIntroRef?.nativeElement;

    if (h1) gsap.fromTo(
      h1,
      { autoAlpha: 0, y: 20 },
      {
        autoAlpha: 1, y: 0, duration: 0.6, ease: EASE,
        onStart: () => { rmPrehide(h1); },
        onComplete: () => { gsap.set(h1, { clearProps: 'all' }); }
      }
    );
    if (h2) gsap.fromTo(
      h2,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE, delay: 0.08,
        onStart: () => { rmPrehide(h2); },
        onComplete: () => { gsap.set(h2, { clearProps: 'all' }); }
      }
    );
    if (hi) gsap.fromTo(
      hi,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE, delay: 0.14,
        onStart: () => { rmPrehide(hi); },
        onComplete: () => { gsap.set(hi, { clearProps: 'all' }); }
      }
    );

    /* ---------- DOMAINES ---------- */
    const assetsList = this.assetsListRef?.nativeElement;
    const cols = (this.assetCols?.toArray() || []).map(r => r.nativeElement);

    if (assetsList && cols.length){
      const heads  = cols.map(c => c.querySelector<HTMLElement>('.asset-head'));
      const lists  = cols.map(c => Array.from(c.querySelectorAll<HTMLElement>('.panel-list > li')));
      gsap.set((heads.filter(Boolean) as HTMLElement[]), { autoAlpha: 0, y: 14 });
      lists.forEach(arr => arr.length && gsap.set(arr, { autoAlpha: 0, y: 10 }));

      const tl = gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger:{ trigger: assetsList, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([assetsList, ...cols]); }
      });

      tl.fromTo(assetsList, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38 }, 0);

      cols.forEach((_, i) => {
        const at  = 0.10 + i * 0.12;
        const hd  = heads[i];
        const its = lists[i] || [];
        if (hd)  tl.to(hd,  { autoAlpha: 1, y: 0, duration: 0.40 }, at);
        if (its.length) tl.to(its, { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.04 }, at + 0.06);
      });
    }

    /* ---------- WHEEL ---------- */
    const wTitle = this.wheelTitleRef?.nativeElement;
    const wWrap  = this.wheelWrapRef?.nativeElement;

    if (wTitle){
      gsap.fromTo(
        wTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
          scrollTrigger:{ trigger: wTitle, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(wTitle); },
          onComplete: () => { gsap.set(wTitle, { clearProps: 'all' }); }
        }
      );
    }
    if (wWrap){
      gsap.fromTo(
        wWrap,
        { autoAlpha: 0, scale: 0.985 },
        {
          autoAlpha: 1, scale: 1, duration: 0.52, ease: 'power2.out',
          scrollTrigger:{ trigger: wWrap, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(wWrap); },
          onComplete: () => { gsap.set(wWrap, { clearProps: 'all' }); }
        }
      );
    }

    /* ---------- MÉTHODES ---------- */
    const eTitle = this.evalTitleRef?.nativeElement;
    const eList  = this.evalListRef?.nativeElement;
    const eRows  = (this.evalRows?.toArray() || []).map(r => r.nativeElement);

    if (eTitle){
      gsap.fromTo(
        eTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
          scrollTrigger:{ trigger: eTitle, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(eTitle); },
          onComplete: () => { gsap.set(eTitle, { clearProps: 'all' }); }
        }
      );
    }
    if (eList && eRows.length){
      gsap.set(eRows, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger:{ trigger: eList, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([eList, ...eRows]); }
      })
      .fromTo(eList, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.36 }, 0)
      .to(eRows, { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.08 }, 0.08);
    }

    /* ---------- PILOTAGE ---------- */
    const pTitle = this.pilotTitleRef?.nativeElement;
    const pIntro = this.pilotIntroRef?.nativeElement;
    const pGrid  = this.pilotGridRef?.nativeElement;

    if (pTitle){
      gsap.fromTo(
        pTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
          scrollTrigger:{ trigger: pTitle, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(pTitle); },
          onComplete: () => { gsap.set(pTitle, { clearProps: 'all' }); }
        }
      );
    }
    if (pIntro){
      gsap.fromTo(
        pIntro,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
          scrollTrigger:{ trigger: pIntro, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(pIntro); },
          onComplete: () => { gsap.set(pIntro, { clearProps: 'all' }); }
        }
      );
    }
    if (pGrid){
      const figures = Array.from(pGrid.querySelectorAll<HTMLElement>('.pilot-figure'));
      gsap.set(figures, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger:{ trigger: pGrid, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([pGrid, ...figures]); }
      })
      .fromTo(pGrid, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.38 }, 0)
      .to(figures, { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.08 }, 0.06);
    }

    try { ScrollTrigger.refresh(); } catch {}
  }
}
