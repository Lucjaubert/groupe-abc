import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ]
})
export class FooterComponent implements OnInit, OnDestroy {

  constructor() {}

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }

  openLinkedIn(event: MouseEvent) {
    event.preventDefault();

    if (typeof navigator !== 'undefined' && typeof window !== 'undefined') {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile) {
        window.location.href = 'linkedin://company/cb2pavocats';

        setTimeout(() => {
          window.open('https://www.linkedin.com/company/cb2pavocats/', '_blank');
        }, 800);
      } else {
        window.open('https://www.linkedin.com/company/cb2pavocats/', '_blank');
      }
    }
  }
}
