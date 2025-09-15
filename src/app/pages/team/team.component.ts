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
type MapSection = { title?: string; image?: string; items: string[] };

type Firm = {
  logoUrl?: string;
  name: string;
  region?: string;
  partnerDescHtml?: SafeHtml | '';
  contactEmail?: string;
  partnerImageUrl?: string;
  partnerLastname?: string;
  partnerFamilyname?: string;
  organismLogoUrl?: string;
  titlesHtml?: SafeHtml | '';
  partnerLinkedin?: string;
};

type TeachingCourse = {
  schoolLogoUrl?: string;
  schoolName?: string;
  programLevel?: string;
  city?: string;
  courseTitle?: string;
  speakerName?: string;
  speakerPhotoUrl?: string;
  speakerLinkedin?: string;
  schoolUrl?: string;
};

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);

  /* ===== Données ===== */
  heroTitle = 'Équipes';
  heroIntroHtml: SafeHtml | '' = '';
  mapSection: MapSection | null = null;

  firmsTitle = '';
  firms: Firm[] = [];
  openFirmIndex: number | null = null;

  /* Teaching */
  teachingTitle = '';
  teachingIntroHtml: SafeHtml | '' = '';
  teachingCourses: TeachingCourse[] = [];

  defaultPortrait = 'assets/fallbacks/portrait-placeholder.svg';

  /* Fallback */
  private defaultMap = 'assets/fallbacks/image-placeholder.svg';

  /* ===== Refs anims ===== */
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('heroIntroEl') heroIntroEl!: ElementRef<HTMLElement>;
  @ViewChild('mapTitleEl')  mapTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapImageEl')  mapImageEl!: ElementRef<HTMLElement>;
  @ViewChildren('mapItem')  mapItemEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('firmsTitleEl') firmsTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('firmRowEl') firmRowEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('detailEl')  detailEls!: QueryList<ElementRef<HTMLElement>>;

  /* Teaching refs */
  @ViewChild('teachingTitleEl') teachingTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('teachingIntroEl') teachingIntroEl!: ElementRef<HTMLElement>;
  @ViewChildren('teachingRowEl') teachingRowEls!: QueryList<ElementRef<HTMLElement>>;

  private hoverCleanup: Array<() => void> = [];
  private bindScheduled = false;
  private heroPlayed = false;

  /** ===== Options d’ouverture ===== */
  private RANDOMIZE_FIRMS_ON_LOAD = true;   // false = garder l’ordre reçu
  private OPEN_ONLY_IF_HAS_DETAILS = true;  // n’ouvrir que les lignes avec contenu

  /* ===== Init ===== */
  ngOnInit(): void {
    this.wp.getTeamData().subscribe((root: any) => {
      const acf = root?.acf ?? {};

      /* HERO */
      this.heroTitle = acf?.hero?.section_title || 'Équipes';
      this.heroIntroHtml = this.sanitizeTrimParagraphs(acf?.hero?.intro_body || '');

      /* MAP */
      const ms = acf?.map_section ?? {};
      const img = ms?.map_image;
      let mapImgUrl = '';
      if (typeof img === 'string' && img.trim()) mapImgUrl = img.trim();
      else if (img && typeof img === 'object') mapImgUrl = img.url || img.source_url || '';

      const items = [
        ms?.region_name_1, ms?.region_name_2, ms?.region_name_3, ms?.region_name_4,
        ms?.region_name_5, ms?.region_name_6, ms?.region_name_7, ms?.region_name_8
      ].filter((s: any) => (s || '').toString().trim())
       .map((s: string) => s.trim());

      this.mapSection = { title: ms?.section_title || 'Où ?', image: mapImgUrl || this.defaultMap, items };

      /* FIRMS */
      const fr = acf?.firms ?? {};
      this.firmsTitle = fr?.section_title || 'Les membres du Groupe ABC';

      const toFirm = (fi: any): Firm | null => {
        if (!fi) return null;
        const f: Firm = {
          logoUrl: this.pickImg(fi.logo),
          name: (fi.name || '').trim(),
          region: (fi.region_name || '').trim(),
          partnerDescHtml: fi.partner_description ? this.sanitizeTrimParagraphs(fi.partner_description) : '',
          contactEmail: (fi.contact_email || '').trim() || '',
          partnerImageUrl: this.pickImg(fi.partner_image),
          partnerLastname: (fi.partner_lastname || '').trim(),
          partnerFamilyname: (fi.partner_familyname || '').trim(),
          organismLogoUrl: this.pickImg(fi.organism_logo),
          titlesHtml: this.sanitizeTrimParagraphs(fi.titles_partner_ || ''),
          partnerLinkedin: (fi.partner_lk || '').trim()
        };
        return (f.name || f.region || f.logoUrl) ? f : null;
      };

      const rows: Firm[] = [];
      for (let i = 1; i <= 12; i++) {
        const mapped = toFirm(fr[`firm_${i}`]);
        if (mapped) rows.push(mapped);
      }
      this.firms = rows;

      /* (1) Mélange optionnel de l’ordre */
      if (this.RANDOMIZE_FIRMS_ON_LOAD && this.firms.length > 1) {
        this.shuffleInPlace(this.firms);
      }

      /* (2) Ouvre automatiquement une ligne valable */
      const idx = this.firstOpenableIndex();
      this.openFirmIndex = (idx !== null) ? idx : null;

      /* TEACHING */
      const teaching = acf?.teaching ?? {};
      this.teachingTitle = teaching?.section_title || 'Enseignement & formation';
      this.teachingIntroHtml = this.sanitizeTrimParagraphs(teaching?.intro_body || '');

      const toCourse = (ci: any): TeachingCourse | null => {
        if (!ci) return null;
        const c: TeachingCourse = {
          schoolLogoUrl   : this.pickImg(ci.school_logo),
          schoolName      : (ci.school_name || '').trim(),
          programLevel    : (ci.program_level || '').trim(),
          city            : (ci.city || '').trim(),
          courseTitle     : (ci.course_title || '').trim(),
          speakerName     : (ci.speaker_name || '').trim(),
          speakerPhotoUrl : this.pickImg(ci.speaker_photo),
          speakerLinkedin : (ci.speaker_linkedin_url || '').trim(),
          schoolUrl       : (ci.school_url || '').trim(),
        };
        return (c.schoolName || c.courseTitle) ? c : null;
      };

      const courses: TeachingCourse[] = [];
      for (let i = 1; i <= 9; i++) {
        const mapped = toCourse(teaching[`course_${i}`]);
        if (mapped) courses.push(mapped);
      }

      /* Fallback photo via Firms si besoin */
      if (courses.length && this.firms.length){
        const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        courses.forEach(c => {
          if (!c.speakerPhotoUrl && c.speakerName){
            const match = this.firms.find(f =>
              norm(`${f.partnerLastname} ${f.partnerFamilyname}`) === norm(c.speakerName!)
            );
            if (match?.partnerImageUrl) c.speakerPhotoUrl = match.partnerImageUrl;
          }
        });
      }

      this.teachingCourses = courses;

      /* SEO */
      const introText = (acf?.hero?.intro_body || '').toString();
      this.seo.update({
        title: `${this.heroTitle} – Groupe ABC`,
        description: this.strip(introText, 160),
        image: ''
      });

      this.scheduleBind();
    });
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

    // Si la ligne est fermée et n’a pas de détails, on bloque l’ouverture.
    if (!this.firmHasDetails(f) && !isOpenNow) return;

    // Toggle : ouvre/ferme la même ligne
    this.openFirmIndex = isOpenNow ? null : i;
    this.scheduleBind();
  }

  isOpen(i: number){ return this.openFirmIndex === i; }
  chevronAriaExpanded(i: number){ return this.isOpen(i) ? 'true' : 'false'; }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }

  private pickImg(input: any): string {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (typeof input === 'object') return input.url || input.source_url || input.medium_large || input.large || '';
    return '';
  }

  private sanitizeTrimParagraphs(html: string): SafeHtml {
    const compact = (html || '')
      .replace(/<p>(?:&nbsp;|&#160;|\s|<br\s*\/?>)*<\/p>/gi, '')
      .replace(/>\s+</g, '><');
    return this.sanitizer.bypassSecurityTrustHtml(compact);
  }

  onMapImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultMap; }

  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private prefersReducedMotion(): boolean {
    try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false; }
    catch { return false; }
  }

  private forceInitialHidden(host: HTMLElement){
    const pre  = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
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

  /* ===== Helpers ouverture ===== */
  private shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
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

  /* ===== Animations ===== */
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.mapItemEls?.changes?.subscribe(() => this.scheduleBind());
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
    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach(el => el?.classList?.remove('prehide','prehide-row'));
    };

    /* ---------- HERO ---------- */
    const h1  = this.heroTitleEl?.nativeElement;
    const hi  = this.heroIntroEl?.nativeElement;

    if (h1 && !this.heroPlayed) {
      gsap.fromTo(h1, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: .55, ease: EASE,
        onStart: () => { rmPrehide(h1); },
        onComplete: () => { this.heroPlayed = true; gsap.set(h1, { clearProps: 'all' }); }
      });
    }
    if (hi){
      gsap.fromTo(hi, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: .5, ease: EASE, delay: .05,
        onStart: () => { rmPrehide(hi); },
        onComplete: () => { gsap.set(hi, { clearProps: 'all' }); }
      });
    }

    /* ---------- MAP ---------- */
    const mt  = this.mapTitleEl?.nativeElement;
    const mi  = this.mapImageEl?.nativeElement;
    const items = (this.mapItemEls?.toArray() || []).map(r => r.nativeElement);
    const list  = items[0]?.parentElement as HTMLElement | null;

    if (mi){
      gsap.fromTo(mi, { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: .5, ease: EASE,
        scrollTrigger: { trigger: mi, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(mi); },
        onComplete: () => { gsap.set(mi, { clearProps: 'all' }); }
      });
    }
    if (mt){
      gsap.fromTo(mt, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: .5, ease: EASE, delay: .05,
        scrollTrigger: { trigger: mt, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(mt); },
        onComplete: () => { gsap.set(mt, { clearProps: 'all' }); }
      });
    }
    if (list && items.length) {
      gsap.set(items, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: list, start: 'top 90%', once: true },
        onStart: () => { rmPrehide([list, ...items]); }
      })
      .to(items, { autoAlpha: 1, y: 0, duration: .45, stagger: .08 }, 0)
      .add(() => { gsap.set(items, { clearProps: 'transform,opacity,willChange' }); });
    }

    this.attachListHoverZoom(items);

    /* ---------- FIRMS ---------- */
    const ft  = this.firmsTitleEl?.nativeElement;
    const rows = (this.firmRowEls?.toArray() || []).map(r => r.nativeElement);
    const listWrap = rows[0]?.closest('.firm-list') as HTMLElement | null;

    if (ft){
      gsap.fromTo(ft, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: .55, ease: EASE,
        scrollTrigger: { trigger: ft, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(ft); },
        onComplete: () => { gsap.set(ft, { clearProps: 'all' }); }
      });
    }

    if (listWrap && rows.length){
      gsap.set(rows, { autoAlpha: 0, y: 14 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: listWrap, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([listWrap, ...rows]); }
      })
      .to(rows, { autoAlpha: 1, y: 0, duration: .45, stagger: .06 }, 0)
      .add(() => { gsap.set(rows, { clearProps: 'transform,opacity' }); });
    }

    // Détails de la ligne ouverte (si existants)
    const openDetail = document.querySelector('.firm-row.open .fr-details') as HTMLElement | null;
    if (openDetail){
      const left  = openDetail.querySelector('.ff-left') as HTMLElement | null;
      const right = openDetail.querySelector('.ff-right') as HTMLElement | null;
      if (left || right){
        gsap.timeline({ defaults: { ease: EASE },
          onStart: () => { rmPrehide([left, right].filter(Boolean) as Element[]); }
        })
        .fromTo(left,  { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .45 }, 0)
        .fromTo(right, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .45 }, 0.06);
      }
    }

    /* ---------- TEACHING ---------- */
    const tt = this.teachingTitleEl?.nativeElement;
    const ti = this.teachingIntroEl?.nativeElement;
    const trows = (this.teachingRowEls?.toArray() || []).map(r => r.nativeElement);
    const tlist = document.querySelector('.teach-list') as HTMLElement | null;

    if (tt){
      gsap.fromTo(tt, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: .5, ease: EASE,
        scrollTrigger: { trigger: tt, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(tt); },
        onComplete: () => { gsap.set(tt, { clearProps: 'all' }); }
      });
    }
    if (ti){
      gsap.fromTo(ti, { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: .5, ease: EASE,
        scrollTrigger: { trigger: ti, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(ti); },
        onComplete: () => { gsap.set(ti, { clearProps: 'all' }); }
      });
    }
    if (tlist && trows.length){
      gsap.set(trows, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: tlist, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([tlist, ...trows]); }
      })
      .to(trows, { autoAlpha: 1, y: 0, duration: .45, stagger: .06 }, 0)
      .add(() => { gsap.set(trows, { clearProps: 'transform,opacity' }); });
    }

    try { ScrollTrigger.refresh(); } catch {}
  }

  onTeachImgError(e: Event){
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.defaultPortrait){
      img.src = this.defaultPortrait;
    }
  }
}
