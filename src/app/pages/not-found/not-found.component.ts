import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss'],
})
export class NotFoundComponent implements OnInit {
  constructor(
    private router: Router,
    private titleService: Title,
    private metaService: Meta
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('404 – Page introuvable | Groupe ABC');
    this.metaService.updateTag({
      name: 'description',
      content:
        'La page demandée est introuvable. Vérifiez l’URL ou retournez à l’accueil du Groupe ABC.',
    });
    this.metaService.updateTag({ name: 'robots', content: 'noindex,follow' });
  }

  goToHomePage(): void {
    this.router.navigate(['/']);
  }
}
