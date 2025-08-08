import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { WordpressService } from './services/wordpress.service';
import { HeaderComponent } from './shared/components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'groupe-abc';
  currentRoute = '';
  showFooter = true;
  homepageData: any;

  constructor(
    private router: Router,
    private wordpressService: WordpressService,
    @Inject(PLATFORM_ID) private platformId: any,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.wordpressService.getHomepageData().subscribe(data => {
      this.homepageData = data;
    });

    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.showFooter = false;
      }

      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;

        this.showFooter = true;

        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo({ top: 0, behavior: 'smooth' });

          if (this.currentRoute.includes('/contact')) {
            this.renderer.addClass(document.body, 'contact-page');
          } else {
            this.renderer.removeClass(document.body, 'contact-page');
          }
        }
      }
    });
  }
}
