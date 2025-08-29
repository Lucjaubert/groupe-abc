import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, QueryList, ViewChild, ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type NewsIntro = {
  title: string;
  html: string;
  linkedinUrl?: string;
};

type NewsPost = {
  theme?: string;
  themeKey?: 'expertise' | 'juridique' | 'marche' | 'autre';
  firmLogo?: string;
  firmName?: string;
  author?: string;
  date?: string;
  title?: string;
  html?: string;
  imageUrl?: string;
  linkedinUrl?: string;
};

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss'],
})
export class NewsComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);

  intro: NewsIntro = {
    title: 'Actualités',
    html: `Retrouvez nos points de marché, décryptages réglementaires, retours d’expérience et temps forts de nos huit cabinets…<br/>À suivre ici et sur notre compte LinkedIn`,
    linkedinUrl: ''
  };

  posts: NewsPost[] = [];
  expanded: boolean[] = [];

  @ViewChildren('excerpt')   excerpts!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('introTitle')   introTitle!: ElementRef<HTMLElement>;
  @ViewChild('introSubtitle')introSubtitle!: ElementRef<HTMLElement>;
  @ViewChild('introLinkedin')introLinkedin!: ElementRef<HTMLElement>;
  @ViewChildren('newsRow')   rows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptClip') clips!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptBody') bodies!: QueryList<ElementRef<HTMLElement>>;


  private rowsAnimationsInitialized = false;

  async ngOnInit(): Promise<void> {
    const list: any[] = await firstValueFrom(this.wp.getAllNews());

    this.intro.linkedinUrl =
      list.find((it: any) => it?.acf?.news?.linkedin_url)?.acf?.news?.linkedin_url || '';

    const mapped: NewsPost[] = [];
    for (const it of list) {
      const p = it?.acf?.post || {};
      if (!p) continue;

      let firmLogo = '';
      if (typeof p.logo_firm === 'string') firmLogo = p.logo_firm;
      else if (typeof p.logo_firm === 'number') {
        firmLogo = await firstValueFrom(this.wp.getMediaUrl(p.logo_firm)) || '';
      }

      let imageUrl = '';
      if (typeof p.post_image === 'string') imageUrl = p.post_image;
      else if (typeof p.post_image === 'number') {
        imageUrl = await firstValueFrom(this.wp.getMediaUrl(p.post_image)) || '';
      }

      mapped.push({
        theme: p.theme || '',
        themeKey: this.toThemeKey(p.theme),
        firmLogo,
        firmName: p.nam_firm || '',
        author: p.author || '',
        date: p.date || '',
        title: p.post_title || '',
        html: p.post_content || '',
        imageUrl,
        linkedinUrl: p.linkedin_link || '',
      });
    }

    this.posts = mapped;
    this.expanded = new Array(this.posts.length).fill(false);

    this.seo.update({
      title: `${this.intro.title} – Groupe ABC`,
      description: this.strip(this.intro.html, 160),
    });
  }

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);

    this.rows.changes.subscribe(() => {
      if (!this.rowsAnimationsInitialized && this.rows.length) {
        this.rowsAnimationsInitialized = true;
        this.initIntroSequence(() => this.animateFirstRow());
        this.initRowsScrollAnimations();
      }
    });

    if (this.rows.length && !this.rowsAnimationsInitialized) {
      this.rowsAnimationsInitialized = true;
      this.initIntroSequence(() => this.animateFirstRow());
      this.initRowsScrollAnimations();
    }
  }

  ngOnDestroy(): void {
    ScrollTrigger.getAll().forEach(t => t.kill());
    gsap.globalTimeline.clear();
  }

  private initIntroSequence(onComplete?: () => void): void {
    const titleEl = this.introTitle?.nativeElement;
    const subEl   = this.introSubtitle?.nativeElement;
    const linkEl  = this.introLinkedin?.nativeElement;
    if (!titleEl || !subEl || !linkEl) return;

    gsap.set([titleEl, subEl, linkEl], { autoAlpha: 0, y: 20 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(titleEl, { autoAlpha: 1, y: 0, duration: 0.65 })
      .to(subEl,   { autoAlpha: 1, y: 0, duration: 0.65 }, '-=0.35')
      .to(linkEl,  { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.40')
      .add(() => { onComplete && onComplete(); });
  }

  private animateFirstRow(): void {
    const first = this.rows?.first?.nativeElement;
    if (!first) return;

    const bg   = first.querySelector('.news-bg') as HTMLElement | null;
    const box  = first.querySelector('.news-box') as HTMLElement | null;
    const items = [
      first.querySelector('.theme-chip'),
      first.querySelector('.meta-line'),
      first.querySelector('.post-title'),
      first.querySelector('.post-excerpt'),
      first.querySelector('.card-cta'),
      first.querySelector('.news-col--image'),
    ].filter(Boolean) as HTMLElement[];

    if (!box || !bg) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(bg,  { autoAlpha: 1, duration: 0.35 })
      .fromTo(box, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.05');

    if (items.length) {
      tl.set(items, { autoAlpha: 0, y: 24, willChange: 'transform,opacity' })
        .to(items, {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.10,
          onComplete: () => { gsap.set(items, { clearProps: 'willChange' }); }
        }, '-=0.35');
    }
  }

  private initRowsScrollAnimations(): void {
    this.rows.forEach((rowRef, idx) => {
      const row = rowRef.nativeElement;
      if (idx === 0) return;

      const bg    = row.querySelector('.news-bg') as HTMLElement | null;
      const box   = row.querySelector('.news-box') as HTMLElement | null;
      const items = row.querySelectorAll<HTMLElement>('.theme-chip, .meta-line, .post-title, .post-excerpt, .card-cta, .news-col--image');
      if (!box || !bg) return;

      gsap.set(items, { autoAlpha: 0, y: 26 });

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: {
          trigger: row,
          start: 'top 78%',
          toggleActions: 'play none none none',
          once: true
        }
      });

      tl.to(bg,  { autoAlpha: 1, duration: 0.35 })
        .fromTo(box, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.15')
        .to(items,   { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, '-=0.25');
    });
  }

  private nextFrame(): Promise<void> {
    return new Promise(res => requestAnimationFrame(() => res()));
  }

  async toggleExpand(i: number): Promise<void> {
    const clip = this.clips.get(i)?.nativeElement;
    const body = this.bodies.get(i)?.nativeElement;
    if (!clip || !body) return;

    gsap.killTweensOf(clip);

    const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

    if (!this.expanded[i]) {
      // OUVERTURE — fige la hauteur CLAMPÉE avant de dé-clamper
      const startH = body.getBoundingClientRect().height; // hauteur clampée réelle
      gsap.set(clip, { height: startH, overflow: 'hidden', willChange: 'height' });

      body.classList.remove('is-clamped');
      await nextFrame(); // recalcul du layout une fois dé-clampé

      const targetH = body.scrollHeight;
      this.expanded[i] = true;

      const ro = new ResizeObserver(() => {
        if (clip.style.height !== 'auto') gsap.set(clip, { height: body.scrollHeight });
      });
      ro.observe(body);

      gsap.to(clip, {
        height: targetH,
        duration: 0.9,
        ease: 'power3.out',
        onComplete: () => {
          ro.disconnect();
          gsap.set(clip, { height: 'auto', clearProps: 'willChange,overflow' });
        }
      });
    } else {
      // FERMETURE — calcule la hauteur clampée après ré-application du clamp
      const startH = clip.getBoundingClientRect().height || body.scrollHeight;

      body.classList.add('is-clamped');
      await nextFrame();
      const targetH = body.getBoundingClientRect().height;

      gsap.set(clip, { height: startH, overflow: 'hidden', willChange: 'height' });
      gsap.to(clip, {
        height: targetH,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => {
          this.expanded[i] = false;
          gsap.set(clip, { height: 'auto', clearProps: 'willChange,overflow' });
        }
      });
    }
  }



  private toThemeKey(raw?: string): NewsPost['themeKey'] {
    const s = (raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (s.includes('expert')) return 'expertise';
    if (s.includes('jurid'))  return 'juridique';
    if (s.includes('march'))  return 'marche';
    return 'autre';
  }

  themeClass(k: NewsPost['themeKey']) { return k ? `theme-${k}` : 'theme-autre'; }
  trackByIndex(i: number){ return i; }

  private strip(html: string, max = 160) {
    const t = (html || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
}
