import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService, Lang } from '../../../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnDestroy {
  menuOpen = false;
  currentLang: Lang = 'fr';
  private sub?: Subscription;

  constructor(private lang: LanguageService){
    this.currentLang = this.lang.lang;
    this.sub = this.lang.lang$.subscribe(l => this.currentLang = l);
  }

  toggleMenu(){ this.menuOpen = !this.menuOpen; }
  onToggleLang(){ this.lang.toggle(); }

  ngOnDestroy(){ this.sub?.unsubscribe(); }
}
