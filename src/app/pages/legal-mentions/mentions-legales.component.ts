import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-mentions-legales',
  templateUrl: './mentions-legales.component.html',
  styleUrls: ['./mentions-legales.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class MentionsLegalesComponent implements OnInit {
  constructor(private title: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.title.setTitle('Mention légale - Groupe ABC');
    this.meta.updateTag({
      name: 'description',
      content: 'Informations et mentions légales du site groupe-abc.fr (éditeur, hébergement, médiation, propriété intellectuelle, cookies, données personnelles).',
    });
  }
}
