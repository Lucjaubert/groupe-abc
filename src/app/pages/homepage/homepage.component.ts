import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { RouterModule }      from '@angular/router';
import { WordpressService }  from '../../services/wordpress.service';
import { SeoService }        from '../../services/seo.service';

@Component({
  selector   : 'app-homepage',
  standalone : true,
  imports    : [CommonModule, RouterModule],
  templateUrl: './homepage.component.html',
  styleUrls  : ['./homepage.component.scss']
})
export class HomepageComponent implements OnInit {

  acf: any = {};

  heroTitle    = '';
  heroSubtitle = '';
  heroBg       = '';

  keyFigures  : { value: string; label: string }[] = [];
  whereList   : string[] = [];
  whatList    : string[] = [];
  howList     : string[] = [];
  contexts    : { icon: string; label: string }[] = [];
  clients     : string[] = [];
  teamMembers : { photo: string; area: string; name: string; job: string }[] = [];
  news        : { title: string; excerpt: string; link: string }[] = [];

  constructor(
    private wp : WordpressService,
    private seo: SeoService
  ) {}

  ngOnInit(): void {
    this.wp.getHomepageData().subscribe(acf => {
      this.acf = acf;
      this.extractHero();
      this.buildCollections();
      this.applySeo();
    });
  }

  /* -------- Hero -------- */
  private extractHero(): void {
    const h = this.acf.hero_section || {};
    this.heroTitle    = h.hero_title       || '';
    this.heroSubtitle = h.hero_subtitle    || '';
    this.heroBg       = h.hero_background  || '';
  }

  /* -------- Collections -------- */
  private buildCollections(): void {

    /* Key figures */
    const fig = this.acf.key_figures_section || {};
    for (let i = 1; i <= 10; i++) {
      const v = fig[`figure_value_${i}`];
      const l = fig[`figure_label_${i}`] || fig[`figure_label_${i}_bis`];
      if (v && l) this.keyFigures.push({ value: v, label: l });
    }

    /* Identity lists */
    const id = this.acf.identity_section || {};
    this.whereList = this.collectText(id, 'where_item_', 10);
    this.whatList  = this.collectText(id, 'what_item_', 10);
    this.howList   = this.collectText(id, 'how_item_', 10);

    /* Context cards */
    const ctx = this.acf.expertise_contact_section || {};
    for (let i = 1; i <= 8; i++) {
      const icon  = ctx[`context_icon_${i}`];
      const label = ctx[`context_label_${i}`];
      if (icon && label) this.contexts.push({ icon, label });
    }

    /* Clients */
    const cli = this.acf.clients_section || {};
    this.clients = this.collectText(cli, 'client_item_', 6);

    /* Team members */
    const team = this.acf.team_section || {};
    for (let i = 1; i <= 8; i++) {
      const photo = team[`team_photo_${i}`];
      const area  = team[`team_area_${i}`];
      const name  = team[`team_name_${i}`];
      const job   = team[`team_job_${i}`];
      if (photo && name) this.teamMembers.push({ photo, area, name, job });
    }

    /* News */
    const newsSec = this.acf.news_section || {};
    for (let i = 1; i <= 6; i++) {
      const t = newsSec[`news_title_${i}`];
      const e = newsSec[`news_bloc_${i}`];
      const l = newsSec[`news_link_${i}`];
      if (t || e || l) this.news.push({ title: t, excerpt: e, link: l });
    }
  }

  private collectText(obj: any, prefix: string, max: number): string[] {
    const arr: string[] = [];
    for (let i = 1; i <= max; i++) {
      const v = obj[`${prefix}${i}`];
      if (v) arr.push(v);
    }
    return arr;
  }

  /* -------- SEO -------- */
  private applySeo(): void {
    const s = this.acf.seo_section || {};
    this.seo.update({
      title:       s.seo_title       || this.heroTitle || 'Groupe ABC – Expertise immobilière',
      description: s.seo_description || this.heroSubtitle,
      keywords:    s.seo_keywords,
      image:       s.seo_image       || this.heroBg,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type'   : 'Organization',
        name      : 'Groupe ABC',
        url       : window.location.href,
        logo      : s.seo_image || this.heroBg,
        description: s.seo_description || this.heroSubtitle
      }
    });
  }
}
