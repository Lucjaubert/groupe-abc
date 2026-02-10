// src/app/pages/team/team.component.ts

import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { getSeoForRoute } from '../../config/seo.routes';

import { FaqService } from '../../services/faq.service';
import { FaqItem, getFaqForRoute } from '../../config/faq.routes';

/* ===== Types ===== */
type Lang = 'fr' | 'en';
type MapSection = { title?: string; image?: any; items: string[] };

type Firm = {
  logoUrl?: any;
  name: string;
  region?: string;
  partnerDescHtml?: SafeHtml | '';
  contactEmail?: string;
  partnerImageUrl?: any;
  partnerLastname?: string;
  partnerFamilyname?: string;
  organismLogoUrl?: any;
  titlesHtml?: SafeHtml | '';
  partnerLinkedin?: string;
  _partnerImgUrl?: string;
};

type TeachingCourse = {
  schoolLogoUrl?: any;
  schoolName?: string;
  programLevel?: string;
  city?: string;
  courseTitle?: string;
  speakerName?: string;
  speakerPhotoUrl?: any;
  speakerLinkedin?: string;
  schoolUrl?: string;
  _speakerImgUrl?: string;
};

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, ImgFastDirective, RouterLink],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss'],
})
export class TeamComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private faq = inject(FaqService);

  // GSAP lazy (SSR-safe)
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // ✅ Fix: si scheduleBind() est appelé avant setupGsap(), on rejoue plus tard
  private pendingBind = false;

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser() || this.gsap) return;

    try {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      this.gsap = gsap;
      this.ScrollTrigger = ScrollTrigger;
      try {
        this.gsap.registerPlugin(this.ScrollTrigger);
      } catch {}
    } catch {
      // si import échoue, on laisse gsap/null
      // ✅ IMPORTANT : on ne doit jamais rester en "boot" sinon la FAQ/sections restent invisibles
      this.boot = false;
      // fail-safe d’affichage (si tu utilises .prehide/.prehide-row sans GSAP)
      this.defer(() => this.revealAllFailSafe());
    }

    // ✅ rejoue un bind demandé trop tôt
    if (this.pendingBind && this.gsap) {
      this.pendingBind = false;
      this.scheduleBind();
    }
  }

  s(v: unknown): string {
    return v == null ? '' : '' + v;
  }

  /* =====================================================================
   * Tracking (GA4 via GTM / dataLayer)
   * ===================================================================== */
  private pushToDataLayer(payload: Record<string, any>): void {
    if (!this.isBrowser()) return;
    try {
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push(payload);
    } catch {
      // no-op
    }
  }

  private firmDisplayName(f: Firm): string {
    const name = (f?.name || '').toString().trim();
    const person = `${(f?.partnerLastname || '').toString().trim()} ${(f?.partnerFamilyname || '')
      .toString()
      .trim()}`.trim();
    return name || person || 'unknown';
  }

  private firmRegion(f: Firm): string {
    return (f?.region || '').toString().trim();
  }

  private pageLang(): 'fr' | 'en' {
    return this.isEN ? 'en' : 'fr';
  }

  /** Event commun GA4 */
  private trackFirmCta(kind: 'linkedin' | 'contact', f: Firm, url?: string): void {
    const label = this.firmDisplayName(f);
    const region = this.firmRegion(f);

    this.pushToDataLayer({
      event: 'team_cta_click',
      team_cta_type: kind,
      team_member: label,
      team_region: region,
      page_lang: this.pageLang(),
      outbound_url: url || undefined,
      page_path: this.currentPath() || undefined,
    });
  }

  /** Handlers appelés par le HTML */
  trackFirmLinkedinClick(f: Firm): void {
    this.trackFirmCta('linkedin', f, (f?.partnerLinkedin || '').toString().trim());
  }

  trackFirmContactClick(f: Firm): void {
    this.trackFirmCta('contact', f);
  }

  /* =====================================================================
   * CTA contact (mailto + navigation page contact)
   * ===================================================================== */

  /** route contact (FR/EN) */
  contactRoute(): any[] {
    return this.isEN ? ['/en', 'contact-chartered-valuers'] : ['/contact-expert-immobilier'];
  }

  /** URL absolue de la page contact (utile dans le body du mail) */
  private contactPageAbsUrl(): string {
    const base = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
    const path = this.isEN ? '/en/contact-chartered-valuers' : '/contact-expert-immobilier';
    return base + path;
  }

  /** mailto final (subject + body encodés) */
  firmContactMailtoHref(): string {
    const subject = 'Demande de contact – Groupe ABC';
    const body =
      `Bonjour,\n\n` +
      `Je souhaite entrer en contact avec Groupe ABC.\n\n` +
      `Page contact : ${this.contactPageAbsUrl()}\n\n` +
      `Cordialement,`;

    return (
      `mailto:contact@groupe-abc.fr` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`
    );
  }

  handleFirmContactClick(ev: MouseEvent, f: Firm): void {
    ev.preventDefault();
    this.trackFirmContactClick(f);

    if (!this.isBrowser()) return;

    window.location.href = this.firmContactMailtoHref();
    this.router.navigate(this.contactRoute());
  }

  /* ===== Données ===== */

  // ✅ BOOT MODE: tu peux le garder si tu veux H1-only au tout début,
  // mais on S’ASSURE qu’il ne reste jamais vrai (sinon FAQ/sections invisibles).
  boot = true;

  heroTitle = 'Équipe';
  heroIntroHtml: SafeHtml | '' = '';
  mapSection: MapSection | null = null;
  whereOpen = true;

  firmsTitle = '';
  firms: Firm[] = [];
  openFirmIndex: number | null = null;

  contactsSheet: { file: string | null } = { file: null };

  /* Teaching */
  teachingTitle = '';
  teachingIntroHtml: SafeHtml | '' = '';
  teachingCourses: TeachingCourse[] = [];

  /* FAQ inline + langue (désormais issue de faq.routes) */
  faqItems: FaqItem[] = [];
  faqOpen: boolean[] = [];
  isEN = false;

  /** FAQ */
  openFaqIndexes = new Set<number>();

  defaultPortrait = 'assets/fallbacks/portrait-placeholder.svg';
  defaultMap = 'assets/fallbacks/image-placeholder.svg';

  /* ===== Refs anims ===== */
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('heroIntroEl') heroIntroEl!: ElementRef<HTMLElement>;

  @ViewChild('firmsBarEl') firmsBarEl!: ElementRef<HTMLElement>;
  @ViewChild('mapTitleEl') mapTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapImageEl') mapImageEl!: ElementRef<HTMLElement>;

  @ViewChild('firmsTitleEl') firmsTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('firmRowEl') firmRowEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('detailEl') detailEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('teachingTitleEl') teachingTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('teachingIntroEl') teachingIntroEl!: ElementRef<HTMLElement>;
  @ViewChildren('teachingRowEl') teachingRowEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('faqWrapEl') faqWrapEl!: ElementRef<HTMLElement>;
  @ViewChild('faqTitleEl') faqTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('faqItemEl') faqItemEls!: QueryList<ElementRef<HTMLElement>>;

  // optionnel : sub pour rebinder si la FAQ change
  private faqChangesSub?: Subscription;

  // flag pour ne jouer le reveal qu'une fois
  private faqPlayed = false;

  /* ===== Flags d’animation ===== */
  private heroPlayed = false;
  private firmsTitlebarPlayed = false;
  private firmListPlayed = false;
  private skipDetailAnimNextBind = false;
  private animateDetailOnFirstLoad = false;

  private hoverCleanup: Array<() => void> = [];
  private bindScheduled = false;

  private RANDOMIZE_FIRMS_ON_LOAD = true;
  private OPEN_ONLY_IF_HAS_DETAILS = true;

  private TEACHING_RANDOMIZE = true;
  private TEACHING_MAX_TRIES = 200;

  /* ======= Préchargement borné (anti-OOM) ======= */
  private MAX_PARALLEL_PRELOAD = 2;
  private preloadQueue: string[] = [];
  private preloadInFlight = 0;

  // ✅ Fix fuites : on garde les subs pour unsubscribe
  private firmRowChangesSub?: Subscription;
  private detailChangesSub?: Subscription;
  private teachingChangesSub?: Subscription;

  private defer(fn: () => void) {
    if (!this.isBrowser()) {
      setTimeout(fn, 0);
      return;
    }
    try {
      const ric = (window as any)?.requestIdleCallback as
        | ((cb: () => void, opts?: any) => void)
        | undefined;
      if (ric) ric(() => fn(), { timeout: 1500 });
      else setTimeout(fn, 0);
    } catch {
      setTimeout(fn, 0);
    }
  }

  private enqueuePreload(src: string) {
    if (!src) return;
    this.preloadQueue.push(src);
    this.kickQueue();
  }

  private kickQueue() {
    while (this.preloadInFlight < this.MAX_PARALLEL_PRELOAD && this.preloadQueue.length) {
      const src = this.preloadQueue.shift()!;
      this.preloadInFlight++;
      this.preload(src).finally(() => {
        this.preloadInFlight = Math.max(0, this.preloadInFlight - 1);
        if (this.preloadQueue.length) this.kickQueue();
      });
    }
  }

  toggleFaqItem(i: number): void {
    if (this.openFaqIndexes.has(i)) this.openFaqIndexes.delete(i);
    else this.openFaqIndexes.add(i);
  }

  isFaqItemOpen(i: number): boolean {
    return this.openFaqIndexes.has(i);
  }

  /* ===== Helpers fail-safe ===== */
  private revealAllFailSafe(host?: HTMLElement) {
    if (!this.isBrowser()) return;
    try {
      const root = host || ((document.querySelector('.team-wrapper') as HTMLElement) || document.body);
      root?.querySelectorAll<HTMLElement>('.prehide, .prehide-row').forEach((el) => {
        el.style.opacity = '1';
        (el.style as any).visibility = 'visible';
        el.style.transform = 'none';
      });
    } catch {}
  }

  private isInView(el: HTMLElement): boolean {
    if (!this.isBrowser()) return false;
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  /* ===== Normalisation & régions ===== */
  private norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private regionKeyFromLabel(label?: string | null): string {
    const n = this.norm(label || '');
    if (!n) return '';
    if (n.includes('paris') || n.includes('ile-de-france') || n.includes('ile de france')) return 'idf';
    if (n.includes('grand ouest')) return 'grand-ouest';
    if (n.includes('rhone') || n.includes('auvergne')) return 'rhone-alpes';
    if (
      n.includes("cote d'azur") ||
      n.includes('cote d azur') ||
      n.includes('cote-d-azur') ||
      n.includes('sud-est')
    )
      return 'cote-azur';
    if (n.includes('sud-ouest') || n.includes('sud ouest')) return 'sud-ouest';
    if (
      n.includes('grand est') ||
      n.includes('nord & est') ||
      n.includes('nord et est') ||
      n.includes('nord-est') ||
      n.includes('nord est')
    )
      return 'grand-est';
    if (n.includes('antilles') || n.includes('guyane')) return 'antilles-guyane';
    if (n.includes('reunion') || n.includes('mayotte')) return 'reunion-mayotte';
    return n.replace(/[^a-z0-9- ]/g, '').replace(/\s+/g, '-');
  }

  private moveFirmToTop(i: number): boolean {
    if (i <= 0 || i >= this.firms.length) return false;
    const [pick] = this.firms.splice(i, 1);
    this.firms.unshift(pick);
    return true;
  }

  rowAnchorId(i: number, f: Firm): string | null {
    const key = this.regionKeyFromLabel(f.region || '');
    if (!key) return null;
    const first = this.firms.findIndex((x) => this.regionKeyFromLabel(x.region || '') === key);
    return first === i ? key : null;
  }

  goToRegion(label: string): void {
    const key = this.regionKeyFromLabel(label);
    if (!key) return;
    const idx = this.firms.findIndex((f) => this.regionKeyFromLabel(f.region || '') === key);
    if (idx >= 0) {
      this.router.navigate([], {
        queryParams: { region: key },
        fragment: key,
        replaceUrl: true,
      });
      this.openAndMaybeScrollTo(idx, true);
    }
  }

  private applyRegionFromUrl(): void {
    const qp = this.route.snapshot.queryParamMap.get('region') || '';
    const key = this.regionKeyFromLabel(qp);
    if (!key) return;
    const idx = this.firms.findIndex((f) => this.regionKeyFromLabel(f.region || '') === key);
    if (idx >= 0) {
      this.animateDetailOnFirstLoad = true;
      this.openAndMaybeScrollTo(idx, true);
    }
  }

  /* ===== Init ===== */
  ngOnInit(): void {
    // Langue
    this.isEN = this.currentPath().startsWith('/en/');

    // ✅ FAQ centralisée : récupération + exposition globale pour la bulle
    const lang: Lang = this.isEN ? 'en' : 'fr';
    this.faqItems = getFaqForRoute('team', lang) || [];
    this.faqOpen = new Array(this.faqItems.length).fill(false);

    if (this.faqItems.length) {
      if (lang === 'en') this.faq.set([], this.faqItems);
      else this.faq.set(this.faqItems, []);
    } else {
      this.faq.clear();
    }

    this.wp.getTeamData().subscribe({
      next: (root: any) => {
        (async () => {
          try {
            const acf = root?.acf ?? {};

            /* HERO */
            this.heroTitle = acf?.hero?.section_title || (this.isEN ? 'Team' : 'Équipe');
            this.heroIntroHtml = this.sanitizeTrimParagraphs(acf?.hero?.intro_body || '');

            /* MAP */
            const ms = acf?.map_section ?? {};
            const items = [
              ms?.region_name_1,
              ms?.region_name_2,
              ms?.region_name_3,
              ms?.region_name_4,
              ms?.region_name_5,
              ms?.region_name_6,
              ms?.region_name_7,
              ms?.region_name_8,
            ]
              .filter((s: any) => (s || '').toString().trim())
              .map((s: string) => s.trim());

            this.mapSection = {
              title: ms?.section_title || (this.isEN ? 'Where?' : 'Où ?'),
              image: ms?.map_image || '',
              items,
            };

            /* FIRMS */
            const fr = acf?.firms ?? {};
            this.firmsTitle =
              fr?.section_title || (this.isEN ? 'Groupe ABC members' : 'Les membres du Groupe ABC');

            // PDF contacts
            try {
              const raw = fr?.team_contacts ?? null;
              const url = await this.resolveMedia(raw);
              this.contactsSheet.file = url || null;
            } catch {
              this.contactsSheet.file = null;
            }

            const toFirm = (fi: any): Firm | null => {
              if (!fi) return null;
              const f: Firm = {
                logoUrl: fi.logo,
                name: (fi.name || '').trim(),
                region: (fi.region_name || '').trim(),
                partnerDescHtml: fi.partner_description ? this.sanitizeTrimParagraphs(fi.partner_description) : '',
                contactEmail: (fi.contact_email || '').trim() || '',
                partnerImageUrl: fi.partner_image,
                partnerLastname: (fi.partner_lastname || '').trim(),
                partnerFamilyname: (fi.partner_familyname || '').trim(),
                organismLogoUrl: fi.organism_logo,
                titlesHtml: this.sanitizeTrimParagraphs(fi.titles_partner_ || ''),
                partnerLinkedin: (fi.partner_lk || '').trim(),
              };
              return f.name || f.region || f.logoUrl ? f : null;
            };

            const rows: Firm[] = [];
            for (let i = 1; i <= 12; i++) {
              const key = `firm_${i}`;
              const mapped = toFirm((fr as any)[key]);
              if (mapped) rows.push(mapped);
            }
            this.firms = rows;

            if (this.RANDOMIZE_FIRMS_ON_LOAD && this.firms.length > 1) {
              this.shuffleInPlace(this.firms);
            }

            this.openFirmIndex = null;
            this.animateDetailOnFirstLoad = false;

            /* TEACHING */
            const teaching = acf?.teaching ?? {};
            this.teachingTitle =
              teaching?.section_title || (this.isEN ? 'Teaching & training' : 'Enseignement & formation');
            this.teachingIntroHtml = this.sanitizeTrimParagraphs(teaching?.intro_body || '');

            const toCourse = (ci: any): TeachingCourse | null => {
              if (!ci) return null;
              const c: TeachingCourse = {
                schoolLogoUrl: ci.school_logo,
                schoolName: (ci.school_name || '').trim(),
                programLevel: (ci.program_level || '').trim(),
                city: (ci.city || '').trim(),
                courseTitle: (ci.course_title || '').trim(),
                speakerName: (ci.speaker_name || '').trim(),
                speakerPhotoUrl: ci.speaker_photo,
                speakerLinkedin: (ci.speaker_linkedin_url || '').trim(),
                schoolUrl: (ci.school_url || '').trim(),
              };
              return c.schoolName || c.courseTitle ? c : null;
            };

            const courses: TeachingCourse[] = [];
            for (let i = 1; i <= 9; i++) {
              const key = `course_${i}`;
              const mapped = toCourse((teaching as any)[key]);
              if (mapped) courses.push(mapped);
            }

            // backfill photos intervenant depuis firms
            if (courses.length && this.firms.length) {
              const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
              courses.forEach((c) => {
                if (!c.speakerPhotoUrl && c.speakerName) {
                  const needle = norm(`${c.speakerName}`);
                  const match = this.firms.find(
                    (f) => norm(`${f.partnerLastname || ''} ${f.partnerFamilyname || ''}`) === needle,
                  );
                  if (match?.partnerImageUrl) c.speakerPhotoUrl = match.partnerImageUrl;
                }
              });
            }

            this.teachingCourses = courses;

            if (this.TEACHING_RANDOMIZE && this.teachingCourses.length > 1) {
              this.shuffleTeachingCourses(this.teachingCourses);
            }

            /* Images */
            await this.hydrateImages();

            /* SEO */
            const introText = (acf?.hero?.intro_body || '').toString();
            this.applySeo(introText);

            // ?region=xxx
            this.applyRegionFromUrl();

            // ✅ ok même si gsap pas encore prêt
            this.scheduleBind();
          } catch (err) {
            console.error('[Team] init failed:', err);
            this.boot = false;
            this.revealAllFailSafe();
          }
        })();
      },
      error: (err) => {
        console.error('[Team] API error:', err);
        this.boot = false;
        this.revealAllFailSafe();
      },
    });
  }

  private getFixedHeaderOffset(): number {
    if (!this.isBrowser()) return 0;
    try {
      const hdr =
        (document.querySelector('.site-header.is-sticky') as HTMLElement) ||
        (document.querySelector('header.sticky') as HTMLElement) ||
        (document.querySelector('header') as HTMLElement);
      return hdr ? Math.ceil(hdr.getBoundingClientRect().height) : 0;
    } catch {
      return 0;
    }
  }

  private scrollFirmRowIntoView(i: number): void {
    if (!this.isBrowser()) return;
    const rows = this.firmRowEls?.toArray() ?? [];
    const row = rows[i]?.nativeElement;
    if (!row) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const offset = this.getFixedHeaderOffset() + 12;
        const top = row.getBoundingClientRect().top + window.scrollY - offset;
        const behavior: ScrollBehavior = this.prefersReducedMotion() ? 'auto' : 'smooth';
        window.scrollTo({ top, behavior });
      });
    });
  }

  private openAndMaybeScrollTo(i: number, doScroll: boolean): void {
    this.openFirmIndex = i;
    this.scheduleBind();
    if (!this.isBrowser() || !doScroll) return;
    requestAnimationFrame(() => this.scrollFirmRowIntoView(i));
  }

  /* ===== Accordéon ===== */
  private firmHasDetails(f: Firm): boolean {
    return !!(
      f.partnerDescHtml ||
      f.partnerImageUrl ||
      f.partnerLastname ||
      f.partnerFamilyname ||
      f.titlesHtml ||
      f.contactEmail ||
      f.partnerLinkedin ||
      f.organismLogoUrl
    );
  }

  toggleFirm(i: number) {
    const f = this.firms[i];
    if (!f) return;

    const isOpenNow = this.openFirmIndex === i;

    if (!this.firmHasDetails(f) && !isOpenNow) return;

    this.skipDetailAnimNextBind = true;

    if (isOpenNow) {
      this.openFirmIndex = null;
      this.scheduleBind();
      return;
    }

    this.openAndMaybeScrollTo(i, false);

    const opened = this.firms[i];
    if (opened) {
      if (opened._partnerImgUrl) this.defer(() => this.enqueuePreload(opened._partnerImgUrl!));
      if (opened.logoUrl) this.defer(() => this.enqueuePreload(opened.logoUrl as string));
      if (opened.organismLogoUrl)
        this.defer(() => this.enqueuePreload(opened.organismLogoUrl as string));
    }
  }

  isOpen(i: number) {
    return this.openFirmIndex === i;
  }

  chevronAriaExpanded(i: number) {
    return this.isOpen(i) ? 'true' : 'false';
  }

  /* ===== Utils ===== */
  trackByIndex(i: number) {
    return i;
  }

  private sanitizeTrimParagraphs(html: string): SafeHtml {
    const compact = (html || '')
      .replace(/<p>(?:&nbsp;|&#160;|\s|<br\s*\/?>)*<\/p>/gi, '')
      .replace(/>\s+</g, '><');
    return this.sanitizer.bypassSecurityTrustHtml(compact);
  }

  onMapImgError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img) img.src = this.defaultMap;
  }

  onTeachImgError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.defaultPortrait) {
      img.src = this.defaultPortrait;
    }
  }

  onFirmImgError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.defaultPortrait) {
      img.src = this.defaultPortrait;
    }
  }

  private strip(html: string, max = 160): string {
    const t = (html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private prefersReducedMotion(): boolean {
    if (!this.isBrowser()) return false;
    try {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  }

  private forceInitialHidden(host: HTMLElement) {
    if (!this.isBrowser() || !this.gsap) return;
    try {
      const gsap = this.gsap!;
      const pre = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
      const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
      if (pre.length) gsap.set(pre, { autoAlpha: 0, y: 20, visibility: 'hidden' });
      if (rows.length) gsap.set(rows, { autoAlpha: 0, y: 12, visibility: 'hidden' });
    } catch {}
  }

  private attachListHoverZoom(items: HTMLElement[]) {
    this.hoverCleanup.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.hoverCleanup = [];

    if (!items?.length || this.prefersReducedMotion() || !this.isBrowser() || !this.gsap) return;

    const gsap = this.gsap!;

    items.forEach((el) => {
      el.style.transformOrigin = 'left center';
      el.style.willChange = 'transform';

      const enter = () => {
        gsap.to(el, { scale: 1.045, duration: 0.18, ease: 'power3.out' });
      };
      const leave = () => {
        gsap.to(el, { scale: 1, duration: 0.22, ease: 'power2.out' });
      };

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('focus', enter, true);
      el.addEventListener('blur', leave, true);

      this.hoverCleanup.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('focus', enter, true);
        el.removeEventListener('blur', leave, true);
        gsap.set(el, { clearProps: 'transform' });
      });
    });
  }

  private shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp: T = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ======= Média : résolution + préchargement borné ======= */
  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src =
        idOrUrl?.source_url ||
        idOrUrl?.url ||
        idOrUrl?.medium_large ||
        idOrUrl?.large ||
        '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }

    if (
      typeof idOrUrl === 'number' ||
      (typeof idOrUrl === 'string' && /^\d+$/.test(idOrUrl.trim()))
    ) {
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(+idOrUrl))) || '';
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (!s) return '';
      if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
      return s;
    }

    return '';
  }

  private preload(src: string): Promise<void> {
    if (!src || !this.isBrowser()) return Promise.resolve();
    return new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  private async hydrateImages(): Promise<void> {
    // MAP
    if (this.mapSection?.image) {
      const u = await this.resolveMedia(this.mapSection.image);
      this.mapSection.image = u || this.defaultMap;
      this.defer(() => this.enqueuePreload(this.mapSection!.image as string));
    }

    // FIRMS
    for (const f of this.firms) {
      if (f.partnerImageUrl) {
        const partner = await this.resolveMedia(f.partnerImageUrl);
        (f as any)._partnerImgUrl = partner || this.defaultPortrait;
      } else {
        (f as any)._partnerImgUrl = this.defaultPortrait;
      }

      if (f.logoUrl) f.logoUrl = (await this.resolveMedia(f.logoUrl)) || f.logoUrl || '';
      if (f.organismLogoUrl)
        f.organismLogoUrl =
          (await this.resolveMedia(f.organismLogoUrl)) || f.organismLogoUrl || '';
    }

    // TEACHING
    for (let i = 0; i < this.teachingCourses.length; i++) {
      const c = this.teachingCourses[i];
      const sp = await this.resolveMedia(c.speakerPhotoUrl);
      (c as any)._speakerImgUrl = sp || this.defaultPortrait;

      if (c.schoolLogoUrl)
        c.schoolLogoUrl =
          (await this.resolveMedia(c.schoolLogoUrl)) || c.schoolLogoUrl || '';

      if (i < 2 && (c as any)._speakerImgUrl) {
        this.defer(() => this.enqueuePreload((c as any)._speakerImgUrl as string));
      }
    }

    if (this.openFirmIndex != null && this.firms[this.openFirmIndex]) {
      const f = this.firms[this.openFirmIndex];
      if (f._partnerImgUrl) this.defer(() => this.enqueuePreload(f._partnerImgUrl!));
      if (f.logoUrl) this.defer(() => this.enqueuePreload(f.logoUrl as string));
      if (f.organismLogoUrl) this.defer(() => this.enqueuePreload(f.organismLogoUrl as string));
    }
  }

  /* ================= Animations ================= */
  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();

    // ✅ CRITICAL : on ne laisse jamais "boot" actif après le 1er paint,
    // sinon la FAQ peut rester invisble (team--boot masque les sections).
    // Les sections restent cachées via .prehide / ScrollTrigger, donc pas de flash.
    queueMicrotask(() => (this.boot = false));

    this.firmRowChangesSub = this.firmRowEls?.changes?.subscribe(() => this.scheduleBind());
    this.detailChangesSub = this.detailEls?.changes?.subscribe(() => this.scheduleBind());
    this.teachingChangesSub = this.teachingRowEls?.changes?.subscribe(() => this.scheduleBind());

    // ✅ IMPORTANT : la FAQ est rendue en fin de page → on rebinde quand elle apparaît / change
    this.faqChangesSub = this.faqItemEls?.changes?.subscribe(() => this.scheduleBind());

    this.scheduleBind();

    // ✅ fallback ultime si gsap indispo: on dévoile tout (sinon .prehide peut bloquer)
    if (!this.gsap) {
      this.defer(() => this.revealAllFailSafe());
    }
  }

  ngOnDestroy(): void {
    this.firmRowChangesSub?.unsubscribe();
    this.detailChangesSub?.unsubscribe();
    this.teachingChangesSub?.unsubscribe();
    this.faqChangesSub?.unsubscribe();

    if (!this.isBrowser()) return;

    try {
      this.ScrollTrigger?.getAll().forEach((t: any) => t.kill());
    } catch {}
    try {
      this.gsap?.globalTimeline?.clear?.();
    } catch {}

    this.hoverCleanup.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.hoverCleanup = [];
    this.faq.clear();
  }

  private scheduleBind() {
    if (!this.isBrowser()) return;

    if (!this.gsap) {
      this.pendingBind = true;
      return;
    }

    if (this.bindScheduled) return;
    this.bindScheduled = true;

    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      }),
    );
  }

  // --------------------------
  // bindAnimations(): ✅ FAQ reveal (tardif, comme methods) + boot safe
  // --------------------------
  private bindAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;

    // ✅ on s’assure de sortir du boot (sinon sections/FAQ invisibles)
    if (this.boot) this.boot = false;

    const host = (document.querySelector('.team-wrapper') as HTMLElement) || document.body;
    this.forceInitialHidden(host);

    try {
      ScrollTrigger.getAll().forEach((t: any) => t.kill());
    } catch {}

    const EASE = 'power3.out';
    const rmPrehide = (els: Element | Element[] | null | undefined) => {
      if (!els) return;
      (Array.isArray(els) ? els : [els]).forEach((el) =>
        el?.classList?.remove('prehide', 'prehide-row'),
      );
    };

    /* HERO */
    const h1 = this.heroTitleEl?.nativeElement || null;
    const hi = this.heroIntroEl?.nativeElement || null;

    /* FIRMS */
    const bar = (this.firmsBarEl?.nativeElement as HTMLElement | null) || null;
    const h2 = (this.firmsTitleEl?.nativeElement as HTMLElement | null) || null;
    const link = (bar?.querySelector('.dl-link') as HTMLElement | null) || null;

    const rows = (this.firmRowEls?.toArray() || []).map((r) => r.nativeElement);
    const listWrap = (rows[0]?.closest('.firm-list') as HTMLElement | null) || null;

    /* TEACHING */
    const tt = this.teachingTitleEl?.nativeElement || null;
    const ti = this.teachingIntroEl?.nativeElement || null;
    const trows = (this.teachingRowEls?.toArray() || []).map((r) => r.nativeElement);
    const tlist = (trows.length
      ? (trows[0].closest('.teach-list') as HTMLElement)
      : null) as HTMLElement | null;

    /* MAP */
    const mt = this.mapTitleEl?.nativeElement || null;
    const mi = this.mapImageEl?.nativeElement || null;
    const mapListEl = (document.querySelector('.where-panel') as HTMLElement | null) || null;
    const mapItems = Array.from(mapListEl?.querySelectorAll<HTMLElement>('a.where-link') || []);

    /* FAQ */
    const faqWrap = (this.faqWrapEl?.nativeElement as HTMLElement | null) || null;
    const faqTitle = (this.faqTitleEl?.nativeElement as HTMLElement | null) || null;
    const faqItemsEls = (this.faqItemEls?.toArray() || []).map((r) => r.nativeElement);

    const playFirmList = () => {
      if (!listWrap || !rows.length) return;
      gsap.set(rows, { autoAlpha: 0, y: 12 });
      gsap
        .timeline({
          defaults: { ease: EASE },
          onStart: () => rmPrehide([listWrap, ...rows]),
        })
        .to(rows, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06 }, 0)
        .add(() => {
          gsap.set(rows, { clearProps: 'transform,opacity,visibility' });
        });
    };

    const playTeaching = () => {
      if (tt) {
        rmPrehide(tt);
        gsap.fromTo(
          tt,
          { autoAlpha: 0, y: 16, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            onComplete: () => gsap.set(tt, { clearProps: 'all' }),
          },
        );
      }
      if (ti) {
        rmPrehide(ti);
        gsap.fromTo(
          ti,
          { autoAlpha: 0, y: 14, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            onComplete: () => gsap.set(ti, { clearProps: 'all' }),
          },
        );
      }
      if (tlist && trows.length) {
        gsap.set(trows, { autoAlpha: 0, y: 12, visibility: 'hidden' });
        gsap
          .timeline({
            defaults: { ease: EASE },
            onStart: () => rmPrehide([tlist, ...trows]),
          })
          .to(trows, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06 }, 0)
          .add(() => gsap.set(trows, { clearProps: 'transform,opacity,visibility' }));
      }
    };

    const playMap = () => {
      if (mi) {
        rmPrehide(mi);
        gsap.fromTo(
          mi,
          { autoAlpha: 0, y: 14, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            onComplete: () => gsap.set(mi, { clearProps: 'all' }),
          },
        );
      }
      if (mt) {
        rmPrehide(mt);
        gsap.fromTo(
          mt,
          { autoAlpha: 0, y: 16, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            onComplete: () => gsap.set(mt, { clearProps: 'all' }),
          },
        );
      }
      if (mapListEl && mapItems.length) {
        gsap.set(mapItems, { autoAlpha: 0, y: 12, visibility: 'hidden' });
        gsap
          .timeline({
            defaults: { ease: EASE },
            onStart: () => rmPrehide([mapListEl, ...mapItems]),
          })
          .to(mapItems, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.08 }, 0)
          .add(() => gsap.set(mapItems, { clearProps: 'transform,opacity,visibility' }));
        this.attachListHoverZoom(mapItems);
      }
    };

    // ✅ FAQ reveal tardif (comme methods)
    const playFaq = () => {
      if (!faqWrap) return;

      // déjà joué => on sécurise l’affichage
      if (this.faqPlayed) {
        const all = [faqWrap, faqTitle, ...faqItemsEls].filter(Boolean) as HTMLElement[];
        rmPrehide(all);
        gsap.set(all, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility' });
        return;
      }

      rmPrehide(faqWrap);
      if (faqTitle) rmPrehide(faqTitle);
      if (faqItemsEls.length) rmPrehide(faqItemsEls);

      // garde tout caché jusqu’au déclenchement exact
      gsap.set(faqWrap, { autoAlpha: 0, y: 14, visibility: 'hidden' });
      if (faqTitle) gsap.set(faqTitle, { autoAlpha: 0, y: 16, visibility: 'hidden' });
      if (faqItemsEls.length) gsap.set(faqItemsEls, { autoAlpha: 0, y: 12, visibility: 'hidden' });

      gsap
        .timeline({ defaults: { ease: EASE } })
        .to(faqWrap, { autoAlpha: 1, y: 0, duration: 0.35, visibility: 'visible' }, 0)
        .to(
          faqTitle,
          { autoAlpha: 1, y: 0, duration: 0.45, visibility: 'visible' },
          0.06,
        )
        .to(
          faqItemsEls,
          { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.08, visibility: 'visible' },
          0.12,
        )
        .add(() => {
          this.faqPlayed = true;
          const all = [faqWrap, faqTitle, ...faqItemsEls].filter(Boolean) as HTMLElement[];
          gsap.set(all, { clearProps: 'transform,opacity,visibility' });
        });
    };

    const tl = gsap.timeline({ defaults: { ease: EASE } });

    // HERO
    if (h1 && !this.heroPlayed) {
      rmPrehide(h1);
      tl.fromTo(
        h1,
        { autoAlpha: 0, y: 16, visibility: 'hidden' },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          visibility: 'visible',
          onComplete: () => {
            this.heroPlayed = true;
            gsap.set(h1, { clearProps: 'all' });
          },
        },
      );
    }

    if (hi) {
      rmPrehide(hi);
      tl.fromTo(
        hi,
        { autoAlpha: 0, y: 14, visibility: 'hidden' },
        { autoAlpha: 1, y: 0, duration: 0.5, immediateRender: false, visibility: 'visible' },
        '>-0.10',
      ).add(() => gsap.set(hi, { clearProps: 'all' }), '>');
    }

    // Titlebar firms
    if (bar) {
      if (!this.firmsTitlebarPlayed) {
        if (h2) rmPrehide(h2);
        if (link) rmPrehide(link);
        tl.addLabel('firmsTitlebar')
          .fromTo(
            h2,
            { autoAlpha: 0, x: -24, visibility: 'hidden' },
            { autoAlpha: 1, x: 0, duration: 0.5, immediateRender: false, visibility: 'visible' },
            'firmsTitlebar',
          )
          .fromTo(
            link,
            { autoAlpha: 0, x: 24, visibility: 'hidden' },
            { autoAlpha: 1, x: 0, duration: 0.5, immediateRender: false, visibility: 'visible' },
            'firmsTitlebar+=0.08',
          )
          .add(() => {
            gsap.set([h2, link].filter(Boolean) as HTMLElement[], { clearProps: 'all' });
          });
        this.firmsTitlebarPlayed = true;
      } else {
        rmPrehide([h2, link].filter(Boolean) as Element[]);
        gsap.set([h2, link].filter(Boolean) as HTMLElement[], {
          autoAlpha: 1,
          x: 0,
          clearProps: 'all',
        });
      }
    }

    // Liste firms
    if (listWrap && rows.length && !this.firmListPlayed) {
      const isNearView = this.isInView(listWrap);
      const playOnce = () => {
        playFirmList();
        this.firmListPlayed = true;
      };
      if (isNearView) {
        tl.add(() => playOnce(), '+=0.10');
      } else {
        ScrollTrigger.create({
          trigger: listWrap,
          start: 'top 85%',
          once: true,
          onEnter: playOnce,
        });
      }
    } else if (listWrap && rows.length) {
      rmPrehide([listWrap, ...rows]);
      gsap.set(rows, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility' });
    }

    // Teaching
    const teachingTriggerEl = (tlist || tt || ti) as HTMLElement | null;
    if (teachingTriggerEl) {
      ScrollTrigger.create({
        trigger: teachingTriggerEl,
        start: 'top 85%',
        once: true,
        onEnter: () => playTeaching(),
      });
    }

    // Map
    const mapTriggerEl = (mi || mt || mapListEl) as HTMLElement | null;
    if (mapTriggerEl) {
      ScrollTrigger.create({
        trigger: mapTriggerEl,
        start: 'top 85%',
        once: true,
        onEnter: () => playMap(),
      });
    }

    // ✅ FAQ: déclenchement très tardif (comme methods) + mini délai
    if (faqWrap) {
      if (!this.faqPlayed) {
        ScrollTrigger.create({
          id: 'faq-last',
          trigger: faqWrap,
          start: 'top 25%', // ✅ tardif : évite qu’elle parte “au démarrage”
          once: true,
          onEnter: () => {
            gsap.delayedCall(0.15, () => playFaq());
          },
        });
      } else {
        playFaq();
      }
    }

    // Détail row ouverte
    const openDetail = document.querySelector('.firm-row.open .fr-details') as HTMLElement | null;
    if (openDetail) {
      const left = openDetail.querySelector('.ff-left') as HTMLElement | null;
      const right = openDetail.querySelector('.ff-right') as HTMLElement | null;
      const parts = [left, right].filter(Boolean) as HTMLElement[];

      if (parts.length) {
        if (this.animateDetailOnFirstLoad && !this.skipDetailAnimNextBind) {
          rmPrehide(parts);
          tl.fromTo(
            left,
            { autoAlpha: 0, y: 14, visibility: 'hidden' },
            { autoAlpha: 1, y: 0, duration: 0.45, immediateRender: false, visibility: 'visible' },
            '>-0.10',
          ).fromTo(
            right,
            { autoAlpha: 0, y: 14, visibility: 'hidden' },
            { autoAlpha: 1, y: 0, duration: 0.45, immediateRender: false, visibility: 'visible' },
            '>-0.36',
          );
          this.animateDetailOnFirstLoad = false;
        } else {
          rmPrehide(parts);
          gsap.set(parts, { autoAlpha: 1, y: 0, clearProps: 'all' });
        }
      }
    }
    this.skipDetailAnimNextBind = false;

    try {
      ScrollTrigger.refresh();
    } catch {}
  }

  /* ===================== SEO – basé sur seo.routes + FAQ JSON-LD ===================== */
  private applySeo(rawIntro: string): void {
    const lang: Lang = this.isEN ? 'en' : 'fr';
    const baseSeo = getSeoForRoute('team', lang);

    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
    const fallbackPathFR = '/equipes';
    const fallbackPathEN = '/en/team';
    const fallbackPath = this.isEN ? fallbackPathEN : fallbackPathFR;

    const canonicalAbs =
      baseSeo.canonical && /^https?:\/\//i.test(baseSeo.canonical)
        ? baseSeo.canonical
        : this.normalizeUrl(siteUrl, baseSeo.canonical || fallbackPath);

    const ogCandidate = baseSeo.image || '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(ogCandidate, siteUrl);

    const introShort = this.strip(rawIntro || '', 90);
    const computedDesc = this.strip(
      (baseSeo.description || '') || (introShort ? `${introShort}` : ''),
      160,
    );
    const description = baseSeo.description || computedDesc;

    const faqSource = this.faqItems || [];
    const faqLd =
      faqSource.length
        ? {
            '@type': 'FAQPage',
            '@id': `${canonicalAbs}#faq`,
            mainEntity: faqSource.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }
        : null;

    const existingJsonLd: any = baseSeo.jsonLd;
    let baseGraph: any[] = [];
    let baseContext = 'https://schema.org';

    if (existingJsonLd) {
      if (Array.isArray(existingJsonLd['@graph'])) baseGraph = existingJsonLd['@graph'];
      else baseGraph = [existingJsonLd];
      if (typeof existingJsonLd['@context'] === 'string') baseContext = existingJsonLd['@context'];
    }

    const graph: any[] = [...baseGraph];
    if (faqLd) graph.push(faqLd);

    this.seo.update({
      ...baseSeo,
      description,
      canonical: canonicalAbs,
      image: ogAbs,
      jsonLd: graph.length ? { '@context': baseContext, '@graph': graph } : undefined,
    });
  }

  private normalizeUrl(base: string, path: string): string {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
  }

  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url)) return url;
      if (/^\/\//.test(url)) return 'https:' + url;
      const o = origin.endsWith('/') ? origin.slice(0, -1) : origin;
      return url.startsWith('/') ? o + url : `${o}/${url}`;
    } catch {
      return url;
    }
  }

  private currentPath(): string {
    if (!this.isBrowser()) return this.router?.url || '/';
    try {
      return window?.location?.pathname || this.router?.url || '/';
    } catch {
      return this.router?.url || '/';
    }
  }

  /* ========= Teaching shuffle helper ========= */
  private speakerKey(c?: TeachingCourse | null): string {
    const n = this.norm((c?.speakerName || '').toString());
    return n;
  }

  private noAdjacentSameSpeaker(arr: TeachingCourse[]): boolean {
    for (let i = 1; i < arr.length; i++) {
      if (this.speakerKey(arr[i]) && this.speakerKey(arr[i]) === this.speakerKey(arr[i - 1])) {
        return false;
      }
    }
    return true;
  }

  private shuffleTeachingCourses(arr: TeachingCourse[]): void {
    if (arr.length < 2) return;

    let tries = 0;
    while (tries++ < this.TEACHING_MAX_TRIES) {
      this.shuffleInPlace(arr);
      if (this.noAdjacentSameSpeaker(arr)) return;
    }

    for (let i = 1; i < arr.length; i++) {
      if (this.speakerKey(arr[i]) && this.speakerKey(arr[i]) === this.speakerKey(arr[i - 1])) {
        let j = i + 1;
        while (
          j < arr.length &&
          (!this.speakerKey(arr[j]) || this.speakerKey(arr[j]) === this.speakerKey(arr[i]))
        )
          j++;
        if (j < arr.length) {
          const tmp = arr[i];
          arr[i] = arr[j];
          arr[j] = tmp;
        }
      }
    }

    if (!this.noAdjacentSameSpeaker(arr)) {
      const buckets = new Map<string, TeachingCourse[]>();
      const order: string[] = [];
      for (const c of arr) {
        const k = this.speakerKey(c) || '__unknown__';
        if (!buckets.has(k)) {
          buckets.set(k, []);
          order.push(k);
        }
        buckets.get(k)!.push(c);
      }
      order.sort((a, b) => buckets.get(b)!.length - buckets.get(a)!.length);

      const result: TeachingCourse[] = [];
      let placed = true;
      while (placed) {
        placed = false;
        for (const k of order) {
          const list = buckets.get(k)!;
          if (list.length) {
            if (
              result.length &&
              this.speakerKey(result[result.length - 1]) === (k === '__unknown__' ? '' : k)
            ) {
              continue;
            }
            result.push(list.shift()!);
            placed = true;
          }
        }
      }
      for (const k of order) {
        const list = buckets.get(k)!;
        while (list.length) result.push(list.shift()!);
      }
      for (let i = 1; i < result.length; i++) {
        if (this.speakerKey(result[i]) && this.speakerKey(result[i]) === this.speakerKey(result[i - 1])) {
          const kPrev = this.speakerKey(result[i - 1]);
          for (let j = i + 1; j < result.length; j++) {
            if (this.speakerKey(result[j]) !== kPrev) {
              const t = result[i];
              result[i] = result[j];
              result[j] = t;
              break;
            }
          }
        }
      }
      arr.splice(0, arr.length, ...result);
    }
  }
}
