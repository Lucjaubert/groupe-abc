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

  @ViewChild('logoGrid',      {static:true}) logoGrid!: ElementRef;
  @ViewChild('verticalTitle', {static:true}) verticalTitle!: ElementRef;
  @ViewChild('titlesBlock',   {static:true}) titlesBlock!: ElementRef;
  @ViewChild('announcement',  {static:true}) announcement!: ElementRef;
  @ViewChild('socialIcons',   {static:true}) socialIcons!: ElementRef;

  setHover(g:'gauche'|'droite', s:boolean){ g==='gauche'? this.hoverGauche=s : this.hoverDroite=s; }

  ngAfterViewInit() {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    tl.to(this.logoGrid.nativeElement.querySelectorAll('.logo-piece'), {
        opacity: 1,
        scale: 1,
        duration: 1.4,
        stagger: 0.3
      })
      .from(
        [this.verticalTitle.nativeElement, this.titlesBlock.nativeElement],
        { opacity: 0, y: 70, duration: 1.1 },
        "-=0.3" // Commence juste après la fin de l'animation précédente
      )
      .from(
        this.announcement.nativeElement,
        { opacity: 0, y: 70, duration: 1.1 },
        "-=0.3" // Commence juste après la fin de l'animation précédente
      )
      .to(
        this.socialIcons.nativeElement.querySelectorAll('.icon-link'),
        { opacity: 1, scale: 1, duration: 1.1, stagger: 0.35 },
        "-=0.3" // Commence juste après la fin de l'animation précédente
      );
  }
}
