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
import { firstValueFrom } from 'rxjs';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { ImgFromPipe } from '../../pipes/img-from.pipe';
import { ActivatedRoute, Router } from '@angular/router';

/* ===== Types ===== */
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

  /* URLs résolues (pour le template) */
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

  /* URL résolue (pour le template) */
  _speakerImgUrl?: string;
};

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, ImgFromPipe, ImgFastDirective],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  s(v: unknown): string { return v == null ? '' : '' + v; }

  /* ===== Données ===== */
  heroTitle = 'Équipes';
  heroIntroHtml: SafeHtml | '' = '';
  mapSection: MapSection | null = null;
  whereOpen = true; // pour [attr.aria-hidden] dans ton HTML

  firmsTitle = '';
  firms: Firm[] = [];
  openFirmIndex: number | null = null;

  /* Doc à télécharger (pattern "presentation.file") */
  contactsSheet: { file: string | null } = { file: null };

  /* Teaching */
  teachingTitle = '';
  teachingIntroHtml: SafeHtml | '' = '';
  teachingCourses: TeachingCourse[] = [];

  defaultPortrait = 'assets/fallbacks/portrait-placeholder.svg';
  private defaultMap = 'assets/fallbacks/image-placeholder.svg';

  /* ===== Refs anims ===== */
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('heroIntroEl') heroIntroEl!: ElementRef<HTMLElement>;

  @ViewChild('firmsBarEl') firmsBarEl!: ElementRef<HTMLElement>;
  @ViewChild('mapTitleEl')  mapTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapImageEl')  mapImageEl!: ElementRef<HTMLElement>;
  // Ton HTML de la map n'a plus #mapItem ; on animera en querySelectorAll dans bindAnimations.

  @ViewChild('firmsTitleEl') firmsTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('firmRowEl') firmRowEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('detailEl')  detailEls!: QueryList<ElementRef<HTMLElement>>;

  /* Teaching refs */
  @ViewChild('teachingTitleEl') teachingTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('teachingIntroEl') teachingIntroEl!: ElementRef<HTMLElement>;
  @ViewChildren('teachingRowEl') teachingRowEls!: QueryList<ElementRef<HTMLElement>>;

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

  /* ===== Helpers fail-safe ===== */
  private revealAllFailSafe(host?: HTMLElement){
    try {
      const root = host || (document.querySelector('.team-wrapper') as HTMLElement) || document.body;
      root?.querySelectorAll<HTMLElement>('.prehide, .prehide-row').forEach(el => {
        el.style.opacity = '1';
        (el.style as any).visibility = 'visible';
        el.style.transform = 'none';
      });
    } catch {}
  }
  private isInView(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  /* ===== Normalisation & régions ===== */
  private norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private regionKeyFromLabel(label?: string | null): string {
    const n = this.norm(label || '');
    if (!n) return '';
    if (n.includes('paris') || n.includes('ile-de-france') || n.includes('ile de france')) return 'idf';
    if (n.includes('grand ouest'))                          return 'grand-ouest';
    if (n.includes('rhone') || n.includes('auvergne'))      return 'rhone-alpes';
    if (n.includes('cote d\'azur') || n.includes('cote d azur') || n.includes('cote-d-azur') || n.includes('sud-est')) return 'cote-azur';
    if (n.includes('sud-ouest') || n.includes('sud ouest')) return 'sud-ouest';
    if (n.includes('grand est') || n.includes('nord & est') || n.includes('nord et est') || n.includes('nord-est') || n.includes('nord est')) return 'grand-est';
    if (n.includes('antilles') || n.includes('guyane'))     return 'antilles-guyane';
    if (n.includes('reunion') || n.includes('mayotte'))     return 'reunion-mayotte';
    return n.replace(/[^a-z0-9- ]/g,'').replace(/\s+/g,'-');
  }

  /** Déplace la ligne i en tête de liste. Retourne true si déplacé. */
  private moveFirmToTop(i: number): boolean {
    if (i <= 0 || i >= this.firms.length) return false;
    const [pick] = this.firms.splice(i, 1);
    this.firms.unshift(pick);
    return true;
  }

  /** id d’ancre pour la 1re row d’une région (sinon null) */
  rowAnchorId(i: number, f: Firm): string | null {
    const key = this.regionKeyFromLabel(f.region || '');
    if (!key) return null;
    const first = this.firms.findIndex(x => this.regionKeyFromLabel(x.region || '') === key);
    return first === i ? key : null;
  }

  /** click sur un lien de région (“Où ?”) */
  goToRegion(label: string): void {
    const key = this.regionKeyFromLabel(label);
    if (!key) return;
    const idx = this.firms.findIndex(f => this.regionKeyFromLabel(f.region || '') === key);
    if (idx >= 0) {
      // mets le fragment dans l’URL (pour partage/navigation) puis ouvre/scroll
      this.router.navigate([], { queryParams: { region: key }, fragment: key, replaceUrl: true });
      this.openAndScrollTo(idx);
    }
  }

  /** applique auto-ouverture si ?region=xxx présent */
  private applyRegionFromUrl(): void {
    const qp = this.route.snapshot.queryParamMap.get('region') || '';
    const key = this.regionKeyFromLabel(qp);
    if (!key) return;
    const idx = this.firms.findIndex(f => this.regionKeyFromLabel(f.region || '') === key);
    if (idx >= 0) {
      this.animateDetailOnFirstLoad = true;
      this.openAndScrollTo(idx);
    }
  }

  /* ===== Init ===== */
  ngOnInit(): void {
    this.wp.getTeamData().subscribe({
      next: (root: any) => {
        (async () => {
          try {
            const acf = root?.acf ?? {};

            /* HERO */
            this.heroTitle = acf?.hero?.section_title || 'Équipes';
            this.heroIntroHtml = this.sanitizeTrimParagraphs(acf?.hero?.intro_body || '');

            /* MAP (liste des régions) */
            const ms = acf?.map_section ?? {};
            const items = [
              ms?.region_name_1, ms?.region_name_2, ms?.region_name_3, ms?.region_name_4,
              ms?.region_name_5, ms?.region_name_6, ms?.region_name_7, ms?.region_name_8
            ]
              .filter((s: any) => (s || '').toString().trim())
              .map((s: string) => s.trim());
            this.mapSection = { title: ms?.section_title || 'Où ?', image: ms?.map_image || '', items };

            /* FIRMS */
            const fr = acf?.firms ?? {};
            this.firmsTitle = fr?.section_title || 'Les membres du Groupe ABC';

            // PDF contacts
            try {
              const raw = fr?.team_contacts ?? null;
              const url = await this.resolveMedia(raw);
              this.contactsSheet.file = url || null;
            } catch { this.contactsSheet.file = null; }

            const toFirm = (fi: any): Firm | null => {
              if (!fi) return null;
              const f: Firm = {
                logoUrl          : fi.logo,
                name             : (fi.name || '').trim(),
                region           : (fi.region_name || '').trim(),
                partnerDescHtml  : fi.partner_description ? this.sanitizeTrimParagraphs(fi.partner_description) : '',
                contactEmail     : (fi.contact_email || '').trim() || '',
                partnerImageUrl  : fi.partner_image,
                partnerLastname  : (fi.partner_lastname || '').trim(),
                partnerFamilyname: (fi.partner_familyname || '').trim(),
                organismLogoUrl  : fi.organism_logo,
                titlesHtml       : this.sanitizeTrimParagraphs(fi.titles_partner_ || ''),
                partnerLinkedin  : (fi.partner_lk || '').trim()
              };
              return (f.name || f.region || f.logoUrl) ? f : null;
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

            const idx = this.firstOpenableIndex();
            this.openFirmIndex = (idx !== null) ? idx : null;
            this.animateDetailOnFirstLoad = (idx !== null);

            /* TEACHING */
            const teaching = acf?.teaching ?? {};
            this.teachingTitle = teaching?.section_title || 'Enseignement & formation';
            this.teachingIntroHtml = this.sanitizeTrimParagraphs(teaching?.intro_body || '');

            const toCourse = (ci: any): TeachingCourse | null => {
              if (!ci) return null;
              const c: TeachingCourse = {
                schoolLogoUrl   : ci.school_logo,
                schoolName      : (ci.school_name || '').trim(),
                programLevel    : (ci.program_level || '').trim(),
                city            : (ci.city || '').trim(),
                courseTitle     : (ci.course_title || '').trim(),
                speakerName     : (ci.speaker_name || '').trim(),
                speakerPhotoUrl : ci.speaker_photo,
                speakerLinkedin : (ci.speaker_linkedin_url || '').trim(),
                schoolUrl       : (ci.school_url || '').trim(),
              };
              return (c.schoolName || c.courseTitle) ? c : null;
            };

            const courses: TeachingCourse[] = [];
            for (let i = 1; i <= 9; i++) {
              const key = `course_${i}`;
              const mapped = toCourse((teaching as any)[key]);
              if (mapped) courses.push(mapped);
            }

            // backfill des photos intervenant depuis firms si mêmes noms
            if (courses.length && this.firms.length){
              const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
              courses.forEach(c => {
                if (!c.speakerPhotoUrl && c.speakerName){
                  const needle = norm(`${c.speakerName}`);
                  const match = this.firms.find(f => norm(`${f.partnerLastname || ''} ${f.partnerFamilyname || ''}`) === needle);
                  if (match?.partnerImageUrl) c.speakerPhotoUrl = match.partnerImageUrl;
                }
              });
            }
            this.teachingCourses = courses;

            /* Images */
            await this.hydrateImages();

            /* SEO */
            const introText = (acf?.hero?.intro_body || '').toString();
            this.applySeo(introText);

            // Ouverture auto si ?region=xxx
            this.applyRegionFromUrl();

            this.scheduleBind();
          } catch (err) {
            console.error('[Team] init failed:', err);
            this.revealAllFailSafe();
          }
        })();
      },
      error: (err) => {
        console.error('[Team] API error:', err);
        this.revealAllFailSafe();
      }
    });
  }

  /** Hauteur du header fixé en haut (si présent) */
  private getFixedHeaderOffset(): number {
    const hdr =
      (document.querySelector('.site-header.is-sticky') as HTMLElement) ||
      (document.querySelector('header.sticky') as HTMLElement) ||
      (document.querySelector('header') as HTMLElement);
    return hdr ? Math.ceil(hdr.getBoundingClientRect().height) : 0;
  }

  /** Fait défiler la page pour amener la ligne i en haut de la fenêtre */
  private scrollFirmRowIntoView(i: number): void {
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

  /** Enchaîne ouverture + (option) remontée en tête + scroll */
  private openAndScrollTo(i: number): void {
    this.moveFirmToTop(i);
    this.openFirmIndex = 0;
    this.scheduleBind();
    requestAnimationFrame(() => this.scrollFirmRowIntoView(0));
  }

  /* ===== Accordéon ===== */
  private firmHasDetails(f: Firm): boolean {
    return !!(f.partnerDescHtml || f.partnerImageUrl || f.partnerLastname || f.partnerFamilyname ||
              f.titlesHtml || f.contactEmail || f.partnerLinkedin || f.organismLogoUrl);
  }

  toggleFirm(i: number){
    const f = this.firms[i];
    if (!f) return;

    const isOpenNow = (this.openFirmIndex === i);

    if (!this.firmHasDetails(f) && !isOpenNow) return;

    this.skipDetailAnimNextBind = true;

    if (isOpenNow) {
      this.openFirmIndex = null;
      this.scheduleBind();
      return;
    }

    this.openAndScrollTo(i);
  }

  isOpen(i: number){ return this.openFirmIndex === i; }
  chevronAriaExpanded(i: number){ return this.isOpen(i) ? 'true' : 'false'; }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }

  private sanitizeTrimParagraphs(html: string): SafeHtml {
    const compact = (html || '')
      .replace(/<p>(?:&nbsp;|&#160;|\s|<br\s*\/?>)*<\/p>/gi, '')
      .replace(/>\s+</g, '><');
    return this.sanitizer.bypassSecurityTrustHtml(compact);
  }

  onMapImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultMap; }

  onTeachImgError(e: Event){
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.defaultPortrait){
      img.src = this.defaultPortrait;
    }
  }

  onFirmImgError(e: Event){
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.defaultPortrait){
      img.src = this.defaultPortrait;
    }
  }

  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private prefersReducedMotion(): boolean {
    try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false; }
    catch { return false; }
  }

  private forceInitialHidden(host: HTMLElement){
    try {
      if (!host) return;
      const pre  = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
      const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
      if (pre.length)  gsap.set(pre,  { opacity: 0, y: 20 });
      if (rows.length) gsap.set(rows, { opacity: 0 });
    } catch {}
  }

  private attachListHoverZoom(items: HTMLElement[]) {
    this.hoverCleanup.forEach(fn => { try { fn(); } catch {} });
    this.hoverCleanup = [];
    if (!items?.length || this.prefersReducedMotion()) return;

    items.forEach((el) => {
      el.style.transformOrigin = 'left center';
      el.style.willChange = 'transform';
      const enter = () => { gsap.to(el, { scale: 1.045, duration: 0.18, ease: 'power3.out' }); };
      const leave = () => { gsap.to(el, { scale: 1,     duration: 0.22, ease: 'power2.out' }); };
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('focus',      enter, true);
      el.addEventListener('blur',       leave, true);
      this.hoverCleanup.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('focus',      enter, true);
        el.removeEventListener('blur',       leave, true);
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

  private firstOpenableIndex(): number | null {
    if (!this.firms?.length) return null;
    if (!this.OPEN_ONLY_IF_HAS_DETAILS) return 0;
    for (let i = 0; i < this.firms.length; i++) {
      if (this.firmHasDetails(this.firms[i])) return i;
    }
    return null;
  }

  /* ======= Média : résolution + préchargement ======= */
  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src = idOrUrl?.source_url || idOrUrl?.url || idOrUrl?.medium_large || idOrUrl?.large || '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }

    if (typeof idOrUrl === 'number' || (typeof idOrUrl === 'string' && /^\d+$/.test(idOrUrl.trim()))) {
      try { return (await firstValueFrom(this.wp.getMediaUrl(+idOrUrl))) || ''; }
      catch { return ''; }
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
    if (!src) return Promise.resolve();
    return new Promise<void>(res => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res();
      img.decoding = 'async';
      img.loading  = 'eager';
      img.src = src;
    });
  }

  private async hydrateImages(): Promise<void> {
    // MAP
    if (this.mapSection?.image) {
      const u = await this.resolveMedia(this.mapSection.image);
      this.mapSection.image = u || this.defaultMap;
    }

    // FIRMS
    await Promise.all(this.firms.map(async f => {
      const partner = await this.resolveMedia(f.partnerImageUrl);
      const finalPartner = partner || this.defaultPortrait;
      await this.preload(finalPartner);
      (f as any)._partnerImgUrl = finalPartner;

      if (f.logoUrl) {
        const logo = await this.resolveMedia(f.logoUrl);
        f.logoUrl = logo || f.logoUrl || '';
      }
      if (f.organismLogoUrl) {
        const org = await this.resolveMedia(f.organismLogoUrl);
        f.organismLogoUrl = org || f.organismLogoUrl || '';
      }
    }));

    // TEACHING
    await Promise.all(this.teachingCourses.map(async c => {
      const sp = await this.resolveMedia(c.speakerPhotoUrl);
      const finalSpeaker = sp || this.defaultPortrait;
      await this.preload(finalSpeaker);
      (c as any)._speakerImgUrl = finalSpeaker;

      if (c.schoolLogoUrl) {
        const sl = await this.resolveMedia(c.schoolLogoUrl);
        c.schoolLogoUrl = sl || c.schoolLogoUrl || '';
      }
    }));
  }

  /* ===== Animations ===== */
  ngAfterViewInit(): void {
    try { gsap.registerPlugin(ScrollTrigger); } catch {}
    this.firmRowEls?.changes?.subscribe(() => this.scheduleBind());
    this.detailEls?.changes?.subscribe(() => this.scheduleBind());
    this.teachingRowEls?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
    this.hoverCleanup.forEach(fn => { try { fn(); } catch {} });
    this.hoverCleanup = [];
  }

  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  private bindAnimations(): void {
    const host = (document.querySelector('.team-wrapper') as HTMLElement) || document.body;
    this.forceInitialHidden(host);
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}

    const EASE = 'power3.out';
    const rmPrehide = (els: Element | Element[] | null | undefined) => {
      if (!els) return;
      (Array.isArray(els) ? els : [els]).forEach(el => el?.classList?.remove('prehide','prehide-row'));
    };

    /* ---------- HERO ---------- */
    const h1 = this.heroTitleEl?.nativeElement || null;
    const hi = this.heroIntroEl?.nativeElement || null;

    /* ---------- FIRMS ---------- */
    const bar  = this.firmsBarEl?.nativeElement as HTMLElement | null;
    const h2   = this.firmsTitleEl?.nativeElement as HTMLElement | null;
    const link = bar?.querySelector('.dl-link') as HTMLElement | null;

    const rows = (this.firmRowEls?.toArray() || []).map(r => r.nativeElement);
    const listWrap = rows[0]?.closest('.firm-list') as HTMLElement | null;

    /* ---------- TEACHING ---------- */
    const tt = this.teachingTitleEl?.nativeElement || null;
    const ti = this.teachingIntroEl?.nativeElement || null;
    const trows = (this.teachingRowEls?.toArray() || []).map(r => r.nativeElement);
    const tlist = (trows.length ? trows[0].closest('.teach-list') : null) as HTMLElement | null;

    /* ---------- MAP (nouveau HTML) ---------- */
    const mt = this.mapTitleEl?.nativeElement || null;
    const mi = this.mapImageEl?.nativeElement || null;
    const mapListEl = document.querySelector('.where-panel') as HTMLElement | null;
    const mapItems = Array.from(mapListEl?.querySelectorAll<HTMLElement>('a.where-link') || []);

    // ---------- FONCTIONS UTILITAIRES ----------
    const playFirmList = () => {
      if (!listWrap || !rows.length) return;
      gsap.set(rows, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        onStart: () => rmPrehide([listWrap, ...rows])
      })
      .to(rows, { autoAlpha: 1, y: 0, duration: .45, stagger: .06 }, 0)
      .add(() => { gsap.set(rows, { clearProps: 'transform,opacity' }); });
    };

    const playTeaching = () => {
      if (tt) {
        rmPrehide(tt);
        gsap.fromTo(tt, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .5, ease: EASE,
          onComplete: () => { gsap.set(tt, { clearProps: 'all' }); }
        });
      }
      if (ti) {
        rmPrehide(ti);
        gsap.fromTo(ti, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .5, ease: EASE,
          onComplete: () => { gsap.set(ti, { clearProps: 'all' }); }
        });
      }
      if (tlist && trows.length) {
        gsap.set(trows, { autoAlpha: 0, y: 12 });
        gsap.timeline({
          defaults: { ease: EASE },
          onStart: () => rmPrehide([tlist, ...trows])
        })
        .to(trows, { autoAlpha: 1, y: 0, duration: .45, stagger: .06 }, 0)
        .add(() => { gsap.set(trows, { clearProps: 'transform,opacity' }); });
      }
    };

    const playMap = () => {
      if (mi) {
        rmPrehide(mi);
        gsap.fromTo(mi, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .5, ease: EASE,
          onComplete: () => { gsap.set(mi, { clearProps: 'all' }); }
        });
      }
      if (mt) {
        rmPrehide(mt);
        gsap.fromTo(mt, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .5, ease: EASE,
          onComplete: () => { gsap.set(mt, { clearProps: 'all' }); }
        });
      }
      if (mapListEl && mapItems.length) {
        gsap.set(mapItems, { autoAlpha: 0, y: 12 });
        gsap.timeline({
          defaults: { ease: EASE },
          onStart: () => rmPrehide([mapListEl, ...mapItems])
        })
        .to(mapItems, { autoAlpha: 1, y: 0, duration: .45, stagger: .08 }, 0)
        .add(() => { gsap.set(mapItems, { clearProps: 'transform,opacity' }); });
        this.attachListHoverZoom(mapItems);
      }
    };

    // ---------- TIMELINE PRINCIPALE ----------
    const tl = gsap.timeline({ defaults: { ease: EASE } });

    // 1) HERO H1
    if (h1 && !this.heroPlayed) {
      rmPrehide(h1);
      tl.fromTo(h1, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: .55,
        onComplete: () => { this.heroPlayed = true; gsap.set(h1, { clearProps: 'all' }); }
      });
    }

    // 2) HERO intro
    if (hi) {
      rmPrehide(hi);
      tl.fromTo(hi, { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: .5
      }, '>-0.10').add(() => { gsap.set(hi, { clearProps: 'all' }); }, '>');
    }

    // 3) Titlebar des firms
    if (bar) {
      if (!this.firmsTitlebarPlayed) {
        if (h2) rmPrehide(h2);
        if (link) rmPrehide(link);
        tl.addLabel('firmsTitlebar')
          .fromTo(h2,   { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: .50 }, 'firmsTitlebar')
          .fromTo(link, { autoAlpha: 0, x:  24 }, { autoAlpha: 1, x: 0, duration: .50 }, 'firmsTitlebar+=0.08')
          .add(() => { gsap.set([h2, link].filter(Boolean) as HTMLElement[], { clearProps: 'all' }); });
        this.firmsTitlebarPlayed = true;
      } else {
        rmPrehide([h2, link].filter(Boolean) as Element[]);
        gsap.set([h2, link].filter(Boolean) as HTMLElement[], { autoAlpha: 1, x: 0, clearProps: 'all' });
      }
    }

    // 4) Liste des firms
    if (listWrap && rows.length && !this.firmListPlayed) {
      const isNearView = listWrap.getBoundingClientRect().top < (window.innerHeight * 0.95);
      const playOnce = () => { playFirmList(); this.firmListPlayed = true; };
      if (isNearView) {
        tl.add(() => { playOnce(); }, '+=0.10');
      } else {
        tl.add(() => {
          ScrollTrigger.create({
            trigger: listWrap,
            start: 'top 85%',
            once: true,
            onEnter: playOnce
          });
        }, '+=0.10');
      }
    } else if (listWrap && rows.length) {
      rmPrehide([listWrap, ...rows]);
      gsap.set(rows, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity' });
    }

    // 5) TEACHING
    if (tt || ti || (tlist && trows.length)) {
      const triggerEl = tlist || tt || ti;
      if (triggerEl) {
        ScrollTrigger.create({
          trigger: triggerEl,
          start: 'top 85%',
          once: true,
          onEnter: playTeaching
        });
      }
    }

    // 6) MAP
    if (mi || mt || (mapListEl && mapItems.length)) {
      const triggerEl = mi || mt || mapListEl;
      if (triggerEl) {
        ScrollTrigger.create({
          trigger: triggerEl,
          start: 'top 85%',
          once: true,
          onEnter: playMap
        });
      }
    }

    // 7) Détails de la row ouverte
    const openDetail = document.querySelector('.firm-row.open .fr-details') as HTMLElement | null;
    if (openDetail){
      const left  = openDetail.querySelector('.ff-left') as HTMLElement | null;
      const right = openDetail.querySelector('.ff-right') as HTMLElement | null;
      const parts = [left, right].filter(Boolean) as HTMLElement[];

      if (parts.length) {
        if (this.animateDetailOnFirstLoad && !this.skipDetailAnimNextBind) {
          rmPrehide(parts);
          tl.fromTo(left,  { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .45 }, '>-0.10')
            .fromTo(right, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .45 }, '>-0.36');
          this.animateDetailOnFirstLoad = false;
        } else {
          rmPrehide(parts);
          gsap.set(parts, { autoAlpha: 1, y: 0, clearProps: 'all' });
        }
      }
    }
    this.skipDetailAnimNextBind = false;

    try { ScrollTrigger.refresh(); } catch {}
  }

  /* ===================== SEO ===================== */
  private applySeo(rawIntro: string): void {
    const path = this.currentPath();
    const isEN = path.startsWith('/en/');

    const site   = 'https://groupe-abc.fr';
    const pathFR = '/equipes';
    const pathEN = '/en/team';
    const canonPath = isEN ? pathEN : pathFR;
    const canonical = this.normalizeUrl(site, canonPath);

    const alternates = [
      { lang: 'fr',        href: this.normalizeUrl(site, pathFR) },
      { lang: 'en',        href: this.normalizeUrl(site, pathEN) },
      { lang: 'x-default', href: this.normalizeUrl(site, pathFR) }
    ];

    const orgName = 'Groupe ABC';

    const orgBlurbFR = 'Le Groupe ABC est un groupement d’Experts immobiliers indépendants présent à Paris, en Régions et DOM-TOM (6 cabinets, 20+ collaborateurs), intervenant en amiable et judiciaire pour tous types de biens : résidentiel, commercial, tertiaire, industriel, hôtellerie, loisirs, santé, charges foncières et terrains. Les experts sont membres RICS, IFEI et CNEJI.';
    const orgBlurbEN = 'Groupe ABC is a network of independent real-estate valuation experts across Paris, Regions and Overseas (6 firms, 20+ professionals), acting in amicable and judicial contexts for residential, commercial, office, industrial, hospitality, leisure & healthcare assets, land and development rights. Members of RICS, IFEI and CNEJI.';

    const introShort = this.strip(rawIntro, 110);
    const title = isEN ? `Our team – ${orgName}` : `Équipes – ${orgName}`;
    const description = this.strip(
      (introShort ? `${introShort} ` : '') + (isEN ? orgBlurbEN : orgBlurbFR),
      160
    );

    const ogImage = '/assets/og/og-default.jpg';
    const ogAbs   = this.absUrl(ogImage, site);
    const isDefaultOg = ogImage.endsWith('/og-default.jpg');

    const siteId = site.replace(/\/+$/, '') + '#website';
    const orgId  = site.replace(/\/+$/, '') + '#organization';

    const organization = {
      '@type': 'Organization',
      '@id': orgId,
      name: orgName,
      url: site,
      logo: `${site}/assets/favicons/android-chrome-512x512.png`,
      sameAs: ['https://www.linkedin.com/company/groupe-abc-experts/']
    };

    const website = {
      '@type': 'WebSite',
      '@id': siteId,
      url: site,
      name: orgName,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      publisher: { '@id': orgId },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${site}/?s={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };

    const collectionPage = {
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': siteId },
      about: { '@id': orgId },
      primaryImageOfPage: ogAbs
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: site },
        { '@type': 'ListItem', position: 2, name: isEN ? 'Team' : 'Équipes', item: canonical }
      ]
    };

    this.seo.update({
      title,
      description,
      canonical: canonPath,
      image: ogAbs,
      imageAlt: isEN ? `${orgName} – Team` : `${orgName} – Équipes`,
      ...(isDefaultOg ? { imageWidth: 1200, imageHeight: 630 } : {}),
      type: 'website',
      locale: isEN ? 'en_US' : 'fr_FR',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [website, organization, collectionPage, breadcrumb]
      }
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
    } catch { return url; }
  }
  private currentPath(): string {
    try { return window?.location?.pathname || '/'; } catch { return '/'; }
  }
}
