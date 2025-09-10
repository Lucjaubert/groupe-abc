// news.component.ts
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

type NewsIntro = { title: string; html: string; linkedinUrl?: string; };
type ThemeKey = 'expertise' | 'juridique' | 'marche' | 'autre';
type NewsPost = {
  uid?: string; theme?: string; themeKey?: ThemeKey;
  firmLogo?: string; firmName?: string; author?: string; date?: string;
  title?: string; html?: string; imageUrl?: string; linkedinUrl?: string;
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
  private baseOrder: NewsPost[] = [];
  viewPosts: NewsPost[] = [];
  pagedPosts: NewsPost[] = [];
  expanded: boolean[] = [];

  @ViewChildren('excerpt') excerpts!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('introTitle') introTitle!: ElementRef<HTMLElement>;
  @ViewChild('introSubtitle') introSubtitle!: ElementRef<HTMLElement>;
  @ViewChild('introLinkedin') introLinkedin!: ElementRef<HTMLElement>;
  @ViewChildren('newsRow') rows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptClip') clips!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptBody') bodies!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('pagerWrapper') pagerWrapper!: ElementRef<HTMLElement>;
  @ViewChild('pager') pager!: ElementRef<HTMLElement>;

  private rowsAnimationsInitialized = false;

  pageSize = 3;
  currentPage = 1;
  get totalPages(): number { return Math.max(1, Math.ceil(this.viewPosts.length / this.pageSize)); }

  promoteTheme: ThemeKey | null = null;
  filterTheme:  ThemeKey | null = null;

  private introPlayed = false;

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
      else if (typeof p.logo_firm === 'number') firmLogo = await firstValueFrom(this.wp.getMediaUrl(p.logo_firm)) || '';

      let imageUrl = '';
      if (typeof p.post_image === 'string') imageUrl = p.post_image;
      else if (typeof p.post_image === 'number') imageUrl = await firstValueFrom(this.wp.getMediaUrl(p.post_image)) || '';

      mapped.push({
        uid: (it?.id ? String(it.id) : '') + '|' + (p.post_title || '') + '|' + (p.date || ''),
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
    this.baseOrder = this.restoreOrBuildOrder(this.posts);
    this.rebuildView();

    this.seo.update({
      title: `${this.intro.title} – Groupe ABC`,
      description: this.strip(this.intro.html, 160),
    });
  }

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);

    const host = document.querySelector('.news-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    if (this.pagerWrapper?.nativeElement) {
      gsap.to(this.pagerWrapper.nativeElement, { autoAlpha: 1, duration: 0.01 });
    }

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
    this.killAllScrollTriggers();
    try { gsap.globalTimeline.clear(); } catch {}
  }

  private initIntroSequence(onComplete?: () => void): void {
    if (this.introPlayed) { onComplete?.(); return; }
    this.introPlayed = true;

    const titleEl = this.introTitle?.nativeElement;
    const subEl   = this.introSubtitle?.nativeElement;
    const linkEl  = this.introLinkedin?.nativeElement;
    if (!titleEl || !subEl || !linkEl) { onComplete?.(); return; }

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

    if ((first as any).__bound) return;
    (first as any).__bound = true;

    const bg   = first.querySelector('.news-bg') as HTMLElement | null;
    const box  = first.querySelector('.news-box') as HTMLElement | null;
    const items = first.querySelectorAll<HTMLElement>(
      '.theme-chip, .meta-line, .post-title, .post-excerpt, .card-cta, .news-col--image'
    );
    if (!box || !bg) return;

    if (items.length) gsap.set(items, { autoAlpha: 0, y: 24, willChange: 'transform,opacity' });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(bg, {
      autoAlpha: 1, duration: 0.35,
      onStart: () => { bg.classList.remove('prehide-row'); },
      onComplete: () => { gsap.set(bg, { clearProps: 'all' }); }
    });

    tl.fromTo(box, { autoAlpha: 0, y: 26 }, {
      autoAlpha: 1, y: 0, duration: 0.55,
      onStart: () => { box.classList.remove('prehide-row'); },
      onComplete: () => { gsap.set(box, { clearProps: 'all' }); }
    }, '-=0.05');

    tl.to(items, {
      autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.10,
      onComplete: () => { gsap.set(items, { clearProps: 'transform,opacity,willChange' }); }
    }, '-=0.35');
  }

  private initRowsScrollAnimations(): void {
    this.rows.forEach((rowRef, idx) => {
      const row = rowRef.nativeElement;

      if ((row as any).__bound) return;
      (row as any).__bound = true;

      if (idx === 0) return;

      const bg    = row.querySelector('.news-bg') as HTMLElement | null;
      const box   = row.querySelector('.news-box') as HTMLElement | null;
      const items = row.querySelectorAll<HTMLElement>(
        '.theme-chip, .meta-line, .post-title, .post-excerpt, .card-cta, .news-col--image'
      );
      if (!box || !bg) return;

      gsap.set(items, { autoAlpha: 0, y: 26 });

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: row, start: 'top 78%', once: true }
      });

      tl.to(bg, {
        autoAlpha: 1, duration: 0.35,
        onStart: () => { bg.classList.remove('prehide-row'); },
        onComplete: () => { gsap.set(bg, { clearProps: 'all' }); }
      })
      .fromTo(box, { autoAlpha: 0, y: 26 }, {
        autoAlpha: 1, y: 0, duration: 0.55,
        onStart: () => { box.classList.remove('prehide-row'); },
        onComplete: () => { gsap.set(box, { clearProps: 'all' }); }
      }, '-=0.15')
      .to(items, {
        autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08,
        onComplete: () => { gsap.set(items, { clearProps: 'transform,opacity' }); }
      }, '-=0.25');
    });
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private buildInitialOrder(items: NewsPost[]): NewsPost[] {
    const byTheme: Record<ThemeKey, NewsPost[]> = { expertise: [], juridique: [], marche: [], autre: [] };
    for (const p of items) byTheme[p.themeKey || 'autre'].push(p);

    const firstPage: NewsPost[] = [];
    (['marche','juridique','expertise'] as ThemeKey[]).forEach(k => {
      if (byTheme[k].length) {
        const pick = byTheme[k].splice(Math.floor(Math.random()*byTheme[k].length), 1)[0];
        firstPage.push(pick);
      }
    });

    const restPool = this.shuffle([...byTheme.expertise, ...byTheme.juridique, ...byTheme.marche, ...byTheme.autre]);
    while (firstPage.length < this.pageSize && restPool.length) firstPage.push(restPool.shift()!);
    const remaining = restPool;

    return [...firstPage, ...remaining];
  }

  private restoreOrBuildOrder(items: NewsPost[]): NewsPost[] {
    const key = 'abc_news_order_v1';
    const uids = items.map(p => p.uid || '').join(',');
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved) as { uids: string; order: string[] };
      if (parsed.uids === uids) {
        const byUid = new Map(items.map(p => [p.uid, p]));
        const ordered: NewsPost[] = [];
        parsed.order.forEach(id => { const it = byUid.get(id); if (it) ordered.push(it); });
        items.forEach(it => { if (!parsed.order.includes(it.uid!)) ordered.push(it); });
        return ordered;
      }
    }
    const order = this.buildInitialOrder(items);
    sessionStorage.setItem(key, JSON.stringify({ uids, order: order.map(p => p.uid) }));
    return order;
  }

  private rebuildView(): void {
    let list = [...this.baseOrder];

    if (this.filterTheme) {
      list = list.filter(p => p.themeKey === this.filterTheme);
    } else if (this.promoteTheme) {
      const head = list.filter(p => p.themeKey === this.promoteTheme);
      const tail = list.filter(p => p.themeKey !== this.promoteTheme);
      list = [...head, ...tail];
    }

    this.viewPosts = list;
    this.currentPage = 1;
    this.slicePage();
  }

  private slicePage(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedPosts = this.viewPosts.slice(start, start + this.pageSize);

    this.killAllScrollTriggers();

    setTimeout(() => {
      this.rows?.forEach(r => { (r.nativeElement as any).__bound = false; });

      if (this.rows?.length) {
        this.initIntroSequence(() => this.animateFirstRow());
        this.initRowsScrollAnimations();
      }
    });

    if (this.pager?.nativeElement) {
      gsap.fromTo(
        this.pager.nativeElement,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.05 }
      );
    }
  }

  onPromote(theme: ThemeKey): void {
    this.promoteTheme = (this.promoteTheme === theme) ? null : theme;
    this.filterTheme = null;
    this.rebuildView();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }

  onFilter(theme: ThemeKey): void {
    this.filterTheme = (this.filterTheme === theme) ? null : theme;
    this.promoteTheme = null;
    this.rebuildView();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }

  goPrev(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.slicePage();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
  }

  goNext(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.slicePage();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
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
      const startH = body.getBoundingClientRect().height;
      gsap.set(clip, { height: startH, overflow: 'hidden', willChange: 'height' });

      body.classList.remove('is-clamped');
      await nextFrame();

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
        onComplete: () => { ro.disconnect(); gsap.set(clip, { height: 'auto', clearProps: 'willChange,overflow' }); }
      });
    } else {
      const startH = clip.getBoundingClientRect().height || body.scrollHeight;
      body.classList.add('is-clamped');
      await nextFrame();
      const targetH = body.getBoundingClientRect().height;

      gsap.set(clip, { height: startH, overflow: 'hidden', willChange: 'height' });
      gsap.to(clip, {
        height: targetH,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => { this.expanded[i] = false; gsap.set(clip, { height: 'auto', clearProps: 'willChange,overflow' }); }
      });
    }
  }

  private toThemeKey(raw?: string): ThemeKey {
    const s = (raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (s.includes('expert')) return 'expertise';
    if (s.includes('jurid'))  return 'juridique';
    if (s.includes('march'))  return 'marche';
    return 'autre';
  }

  themeClass(k?: ThemeKey) { return k ? `theme-${k}` : 'theme-autre'; }
  trackByIndex(i: number){ return i; }

  private strip(html: string, max = 160) {
    const t = (html || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private forceInitialHidden(host: HTMLElement){
    const pre  = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private killAllScrollTriggers(){
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
  }
}
