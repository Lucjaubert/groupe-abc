import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent, FooterSection } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'groupe-abc';
  currentRoute = '';
  showFooter = true;

  footerData: FooterSection = {
    title: 'Prise de contact rapide',
    subtitle: 'Parlez à un expert du Groupe ABC',
    phone_label: 'Téléphone',
    phone: '+33 1 23 45 67 89',
    email_label: 'Email',
    email: 'contact@groupe-abc.fr',
    address_label: 'Adresse',
    address: '12 rue Exemple, 75000 Paris',
    cta_text: 'Nous écrire',
    cta_url: '/contact',
    links: [
      { label: 'Mentions légales', url: '/mentions-legales' },
      { label: 'Politique de confidentialité', url: '/politique-de-confidentialite' },
      { label: 'Cookies', url: '/cookies' }
    ],
    socials: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/groupe-abc' }
    ]
  };

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: any,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
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
