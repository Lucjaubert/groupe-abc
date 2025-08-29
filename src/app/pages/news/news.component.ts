import {
  Component, OnInit, inject, ElementRef, QueryList, ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';

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
export class NewsComponent implements OnInit {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);

  intro: NewsIntro = {
    title: 'Actualités',
    html: `Retrouvez nos points de marché, décryptages réglementaires, retours d’expérience et temps forts de nos huit cabinets…<br/>À suivre ici et sur notre compte LinkedIn`,
    linkedinUrl: ''
  };

  posts: NewsPost[] = [];
  expanded: boolean[] = [];

  @ViewChildren('excerptClip') clips!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptBody') bodies!: QueryList<ElementRef<HTMLElement>>;

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

  private nextFrame(): Promise<void> {
    return new Promise(res => requestAnimationFrame(() => res()));
  }

  async toggleExpand(i: number): Promise<void> {
    const clip = this.clips.get(i)?.nativeElement;
    const body = this.bodies.get(i)?.nativeElement;
    if (!clip || !body) return;

    gsap.killTweensOf(clip);

    const lineH = parseFloat(getComputedStyle(body).lineHeight) || 22;
    const clampH = lineH * 5;

    if (!this.expanded[i]) {
      body.classList.remove('is-clamped');
      await this.nextFrame();

      const startH = Math.min(clip.getBoundingClientRect().height || clampH, clampH);
      const targetH = body.scrollHeight;

      this.expanded[i] = true;

      gsap.set(clip, { height: startH, willChange: 'height' });
      gsap.to(clip, {
        height: targetH,
        duration: 0.9,
        ease: 'power3.out',
        onComplete: () => { gsap.set(clip, { height: 'auto', clearProps: 'willChange' }); }
      });
    } else {
      const startH = clip.getBoundingClientRect().height || body.scrollHeight;

      body.classList.add('is-clamped');
      await this.nextFrame();

      const targetH = Math.min(body.getBoundingClientRect().height, clampH);

      gsap.set(clip, { height: startH, willChange: 'height' });
      gsap.to(clip, {
        height: targetH,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => {
          this.expanded[i] = false;
          gsap.set(clip, { height: 'auto', clearProps: 'willChange' });
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
