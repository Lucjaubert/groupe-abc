import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import gsap from 'gsap';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent implements AfterViewInit {
  hoverGauche = false;
  hoverDroite = false;
  showEmailOptions = false;

  @ViewChild('logo', { static: true }) logo!: ElementRef;
  @ViewChild('frTitle', { static: true }) frTitle!: ElementRef;
  @ViewChild('frText', { static: true }) frText!: ElementRef;
  @ViewChild('divider', { static: true }) divider!: ElementRef;
  @ViewChild('enTitle', { static: true }) enTitle!: ElementRef;
  @ViewChild('enText', { static: true }) enText!: ElementRef;
  @ViewChild('socialIcons', { static: true }) socialIcons!: ElementRef;

  setHover(g: 'gauche' | 'droite', s: boolean) {
    g === 'gauche' ? (this.hoverGauche = s) : (this.hoverDroite = s);
  }

  ngAfterViewInit() {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    tl.from(this.logo.nativeElement, {
      opacity: 0,
      scale: 0.8,
      duration: 1
    })
      .from([this.frTitle.nativeElement, this.frText.nativeElement], {
        opacity: 0,
        y: 50,
        duration: 1.5,
        stagger: 0.2
      })
      .from(this.divider.nativeElement, {
        width: 0,
        opacity: 0,
        duration: 0.6
      })
      .from([this.enTitle.nativeElement, this.enText.nativeElement], {
        opacity: 0,
        y: 50,
        duration: 1,
        stagger: 0.2
      })
      .from(this.socialIcons.nativeElement.querySelectorAll('a'), {
        opacity: 0,
        y: 20,
        duration: 0.8,
        stagger: 0.2
      });
  }

  toggleEmailOptions() {
    this.showEmailOptions = !this.showEmailOptions;
  }
}
