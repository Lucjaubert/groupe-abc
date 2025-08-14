import {
  Component, OnDestroy, OnInit, AfterViewInit, inject,
  ViewChildren, QueryList, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';

type Slide = { title: string; subtitle: string; bg: string };

type KeyFigure = {
  value: number;
  label: string;
  labelBis?: string;
  display: string;
  typed: string;
  fullLabel: string;
  digits: number;
  played: boolean;
};

type Identity = {
  whoTitle: string;
  whoHtml: string;
  whereTitle: string;
  whereMap?: string;
  whereItems: string[];
};

type WhatHow = {
  whatTitle: string;
  whatItems: string[];
  howTitle: string;
  howItems: string[];
};

type Presentation = {
  text1: string;
  text2: string;
  file: string | null;
};

type ContextItem = { icon: string; label: string };
type ExpertiseContext = { title: string; items: ContextItem[] };

/* ===== Clients ===== */
type Clients = { icon: string; title: string; items: string[] };

/* ===== Team ===== */
type TeamMember = {
  photo: string;
  nameFirst: string;
  nameLast: string;
  area: string;
  jobHtml: string;
};

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent implements OnInit, AfterViewInit, OnDestroy {
  acf: any = {};

  /* ---------- HERO ---------- */
  heroSlides: Slide[] = [];
  heroIndex = 0;
  autoplayMs = 5000;
  private autoplayRef: any = null;

  /* swipe hero */
  private pointerStartX: number | null = null;
  private swipeThreshold = 40;

  /* ---------- KEY FIGURES ---------- */
  keyFigures: KeyFigure[] = [];
  @ViewChildren('kfItem') kfItems!: QueryList<ElementRef<HTMLLIElement>>;

  /* ---------- IDENTITY / WHAT-HOW / DOWNLOAD ---------- */
  identity: Identity = {
    whoTitle: '',
    whoHtml: '',
    whereTitle: '',
    whereMap: '',
    whereItems: []
  };
  whereItems: string[] = [];
  whereOpen = false;
  toggleWhere(): void { this.whereOpen = !this.whereOpen; }

  whatHow: WhatHow | null = null;
  presentation: Presentation = { text1: '', text2: '', file: null };

  /* ---------- CONTEXTES ---------- */
  contexts: ExpertiseContext | null = null;

  /* ---------- CLIENTS ---------- */
  clients: Clients | null = null;

  /* ---------- TEAM ---------- */
  teamTitle = '';
  teamMembers: TeamMember[] = [];
  teamPages: TeamMember[][] = [];      // groupes de 2
  teamPageIndex = 0;
  private teamAutoplayRef: any = null;
  teamAutoplayMs = 5000;
  teamAutoplayStoppedByUser = false;

  get currentSlide(): Slide | undefined { return this.heroSlides[this.heroIndex]; }

  private wp = inject(WordpressService);
  private seo = inject(SeoService);

  // Titre sur 2 lignes
  teamTitleLine1 = 'Une équipe';
  teamTitleLine2 = 'de 8 experts à vos côtés';

  /* ==================================================== */
  /*                        LIFECYCLE                     */
  /* ==================================================== */
  ngOnInit(): void {
    this.wp.getHomepageData().subscribe(acf => {
      this.acf = acf;

      // HERO
      this.extractHero();
      this.preloadHeroImages();
      this.applySeoFromHero();
      this.startAutoplay();

      // CONTENT
      this.extractKeyFigures();
      this.extractIdentity();
      this.extractWhatHowAndPresentation();
      this.extractExpertiseContext();
      this.extractClientsSection();

      // TEAM
      this.extractTeamSection();
      this.startTeamAutoplay();
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngAfterViewInit(): void {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = Number((e.target as HTMLElement).dataset['index']);
          this.playFigure(idx);
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 });

    this.kfItems.changes.subscribe(() => {
      this.kfItems.forEach(el => io.observe(el.nativeElement));
    });
    setTimeout(() => this.kfItems.forEach(el => io.observe(el.nativeElement)));
  }

  ngOnDestroy(): void {
    this.clearAutoplay();        // hero
    this.clearTeamAutoplay();    // team
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /* ==================================================== */
  /*                         HERO                         */
  /* ==================================================== */
  private extractHero(): void {
    const h = this.acf?.hero_section || {};
    this.heroSlides = [
      { title: h.hero_title_1 || '', subtitle: h.hero_subtitle_1 || '', bg: h.hero_background_1 || '' },
      { title: h.hero_title_2 || '', subtitle: h.hero_subtitle_2 || '', bg: h.hero_background_2 || '' },
      { title: h.hero_title_3 || '', subtitle: h.hero_subtitle_3 || '', bg: h.hero_background_3 || '' }
    ].filter(s => !!s.bg);

    if (!this.heroSlides.length && (h.hero_background || '')) {
      this.heroSlides = [{ title: h.hero_title || '', subtitle: h.hero_subtitle || '', bg: h.hero_background || '' }];
    }
    this.heroIndex = 0;
  }

  private preloadHeroImages(): void {
    for (const s of this.heroSlides) {
      const img = new Image();
      img.src = s.bg;
    }
  }

  goTo(i: number): void {
    if (!this.heroSlides.length) return;
    const len = this.heroSlides.length;
    this.heroIndex = ((i % len) + len) % len;
  }
  next(): void { this.goTo(this.heroIndex + 1); }
  prev(): void { this.goTo(this.heroIndex - 1); }

  startAutoplay(): void {
    this.clearAutoplay();
    if (this.heroSlides.length > 1) {
      this.autoplayRef = setInterval(() => this.next(), this.autoplayMs);
    }
  }
  pauseAutoplay(): void { this.clearAutoplay(); }
  resumeAutoplay(): void {
    if (document.visibilityState === 'visible') this.startAutoplay();
  }
  private clearAutoplay(): void {
    if (this.autoplayRef) {
      clearInterval(this.autoplayRef);
      this.autoplayRef = null;
    }
  }
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.pauseAutoplay();
      this.clearTeamAutoplay();
    } else {
      this.resumeAutoplay();
      // ne relance l’autoplay Team que si l’utilisateur ne l’a pas stoppé
      if (!this.teamAutoplayStoppedByUser) this.startTeamAutoplay();
    }
  };

  onKeydown(evt: KeyboardEvent): void {
    if (this.heroSlides.length < 2) return;
    if (evt.key === 'ArrowRight') { this.pauseAutoplay(); this.next(); }
    else if (evt.key === 'ArrowLeft') { this.pauseAutoplay(); this.prev(); }
  }
  onPointerDown(evt: PointerEvent): void { this.pointerStartX = evt.clientX; }
  onPointerUp(evt: PointerEvent): void {
    if (this.pointerStartX == null) return;
    const dx = evt.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(dx) > this.swipeThreshold) {
      this.pauseAutoplay();
      if (dx < 0) this.next(); else this.prev();
    }
  }

  /* ==================================================== */
  /*                     KEY FIGURES                      */
  /* ==================================================== */
  private extractKeyFigures(): void {
    const fig = this.acf?.key_figures_section || {};
    const out: KeyFigure[] = [];
    for (let i = 1; i <= 10; i++) {
      const vRaw = fig[`figure_value_${i}`];
      const l = fig[`figure_label_${i}`];
      const lBis = fig[`figure_label_${i}_bis`];
      if (vRaw && (l || lBis)) {
        const value = Number(String(vRaw).replace(/[^\d]/g, '')) || 0;
        const fullLabel = (l || '') + (lBis ? ` ${lBis}` : '');
        out.push({
          value,
          label: l || '',
          labelBis: lBis || '',
          display: '',
          typed: '',
          fullLabel,
          digits: String(value).length || 1,
          played: false
        });
      }
    }
    this.keyFigures = out;
  }

  private playFigure(index: number): void {
    const f = this.keyFigures[index];
    if (!f || f.played) return;
    f.played = true;

    const target = f.value;
    const dur = 4000;
    const start = performance.now();
    const totalChars = f.fullLabel.length;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const p = easeOutCubic(t);

      const val = Math.round(target * p);
      f.display = val ? String(val) : '';

      const chars = Math.floor(totalChars * p);
      f.typed = f.fullLabel.slice(0, chars);

      if (t < 1) requestAnimationFrame(step);
      else {
        f.display = String(target);
        f.typed = f.fullLabel;
      }
    };

    requestAnimationFrame(step);
  }

  /* ==================================================== */
  /*                     IDENTITY / WH                    */
  /* ==================================================== */
  private extractIdentity(): void {
    const id = this.acf?.identity_section || {};
    this.identity = {
      whoTitle: id.who_title || 'Qui ?',
      whoHtml: id.who_text || '',
      whereTitle: id.where_title || 'Où ?',
      whereMap: id.where_map || '',
      whereItems: [
        id.where_item_1, id.where_item_2, id.where_item_3, id.where_item_4,
        id.where_item_5, id.where_item_6, id.where_item_7, id.where_item_8
      ].filter(Boolean)
    };
    this.whereItems = this.identity.whereItems;
  }

  private applySeoFromHero(): void {
    const s = this.acf?.seo_section || {};
    const first = this.heroSlides[0] || { title: '', subtitle: '', bg: '' };
    const seoImage = (s.seo_image && (s.seo_image.url || s.seo_image)) || first.bg;

    this.seo.update({
      title: s.seo_title || first.title || 'Groupe ABC – Expertise immobilière',
      description: s.seo_description || first.subtitle,
      keywords: s.seo_keywords,
      image: seoImage,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Groupe ABC',
        url: window.location.href,
        logo: seoImage,
        description: s.seo_description || first.subtitle
      }
    });
  }

  private extractWhatHowAndPresentation(): void {
    const id = this.acf?.identity_section || {};

    const whatItems = [ id.what_item_1, id.what_item_2, id.what_item_3 ].filter(Boolean) as string[];
    const howItems = [
      id.how_item_1, id.how_item_2, id.how_item_3, id.how_item_4,
      id.how_item_5, id.how_item_6, id.how_item_7, id.how_item_8
    ].filter(Boolean) as string[];

    this.whatHow = {
      whatTitle: id.what_title || 'Quoi ?',
      whatItems,
      howTitle: id.how_title || 'Comment ?',
      howItems
    };

    const dl = this.acf?.presentation_download_section || {};
    const fileUrl =
      (typeof dl.presentation_file === 'string' && dl.presentation_file) ||
      (dl.presentation_file?.url ?? null) || null;

    this.presentation = {
      text1: dl.presentation_button_text_1 || 'Télécharger la présentation du',
      text2: dl.presentation_button_text_2 || 'Groupe ABC',
      file: fileUrl
    };
  }

  /* ==================================================== */
  /*                       CONTEXTES                      */
  /* ==================================================== */
  private extractExpertiseContext(): void {
    const ctx = this.acf?.expertise_contact_section || {};
    const items: ContextItem[] = [];
    for (let i = 1; i <= 8; i++) {
      const icon = ctx[`context_icon_${i}`];
      const label = ctx[`context_label_${i}`];
      if (label) items.push({ icon: icon || '', label });
    }
    this.contexts = { title: ctx.context_title || 'Contextes d’intervention', items };
  }

  /* ==================================================== */
  /*                         CLIENTS                       */
  /* ==================================================== */
  private extractClientsSection(): void {
    const c = this.acf?.clients_section || {};
    const items = [
      c.client_item_1, c.client_item_2, c.client_item_3,
      c.client_item_4, c.client_item_5, c.client_item_6
    ].filter(Boolean) as string[];

    if (c.clients_title || items.length) {
      this.clients = {
        icon: c.clients_icon || '',
        title: c.clients_title || 'Nos clients',
        items
      };
    } else {
      this.clients = null;
    }
  }

  /* ==================================================== */
  /*                           TEAM                        */
  /* ==================================================== */
  private extractTeamSection(): void {
    const t = this.acf?.team_section || {};

    // 1) Titre
    this.teamTitle = t.team_title_1 || 'Une équipe de 8 experts à vos côtés';
    this.setTeamTitleTwoLines(this.teamTitle);


    // 2) Mapping
    const tmp: TeamMember[] = [];
    for (let i = 1; i <= 8; i++) {
      const photo = t[`team_photo_${i}`];
      const name = (t[`team_name_${i}`] || '').toString().trim() || '';
      const area = t[`team_area_${i}`] || '';
      const jobHtml = t[`team_job_${i}`] || '';

      if (photo || name || area || jobHtml) {
        let nameFirst = name, nameLast = '';
        const parts = name.split(/\s+/);
        if (parts.length > 1) {
          nameFirst = parts.slice(0, -1).join(' ');
          nameLast  = parts.slice(-1)[0];
        }
        tmp.push({ photo: photo || '', nameFirst, nameLast, area, jobHtml });
      }
    }

    // 3) Shuffle à chaque visite
    this.teamMembers = this.shuffleArray(tmp);

    // 4) Groupes de 2 (pages)
    this.teamPages = [];
    for (let i = 0; i < this.teamMembers.length; i += 2) {
      this.teamPages.push(this.teamMembers.slice(i, i + 2));
    }

    // 5) Page de départ aléatoire
    if (this.teamPages.length) {
      this.teamPageIndex = Math.floor(Math.random() * this.teamPages.length);
    }
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private setTeamTitleTwoLines(full: string | undefined): void {
    const s = (full || '').replace(/\s+/g, ' ').trim();
    // Si un retour ligne existe déjà dans l’ACF, on le respecte
    if (s.includes('\n')) {
      const [l1, l2] = s.split('\n');
      this.teamTitleLine1 = l1?.trim() || this.teamTitleLine1;
      this.teamTitleLine2 = l2?.trim() || this.teamTitleLine2;
      return;
    }
    // Sinon, on applique la coupe maquette après "Une équipe"
    if (s.toLowerCase().startsWith('une équipe')) {
      const rest = s.slice('une équipe'.length).trim();
      if (rest) this.teamTitleLine2 = rest;
    }
  }

  /* Navigation utilisateur -> stoppe l’autoplay Team */
  goTeamTo(i: number): void {
    if (!this.teamPages.length) return;
    const len = this.teamPages.length;
    this.teamPageIndex = ((i % len) + len) % len;
    this.stopTeamAutoplayByUser();
  }
  nextTeam(): void { this.goTeamTo(this.teamPageIndex + 1); }
  prevTeam(): void { this.goTeamTo(this.teamPageIndex - 1); }

  /* Autoplay aléatoire Team (sans répéter la page courante) */
  private startTeamAutoplay(): void {
    this.clearTeamAutoplay();
    if (this.teamPages.length < 2) return;
    if (this.teamAutoplayStoppedByUser) return; // si l’utilisateur a cliqué, on ne relance pas

    this.teamAutoplayRef = setInterval(() => {
      const len = this.teamPages.length;
      if (len < 2) return;

      let next = this.teamPageIndex;
      while (next === this.teamPageIndex) {
        next = Math.floor(Math.random() * len);
      }
      this.teamPageIndex = next;
    }, this.teamAutoplayMs);
  }
  private clearTeamAutoplay(): void {
    if (this.teamAutoplayRef) {
      clearInterval(this.teamAutoplayRef);
      this.teamAutoplayRef = null;
    }
  }
  private stopTeamAutoplayByUser(): void {
    this.teamAutoplayStoppedByUser = true;
    this.clearTeamAutoplay();
  }

  /* ==================================================== */
  /*                        UTILS                          */
  /* ==================================================== */
  trackByIndex(i: number): number { return i; }
}
