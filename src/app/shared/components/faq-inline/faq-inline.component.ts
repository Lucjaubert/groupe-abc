// faq-inline.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type FaqItem = { q: string; a: string };

@Component({
  selector: 'app-faq-inline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq-inline.component.html',
  styleUrls: ['./faq-inline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqInlineComponent {
  @Input() title = 'FAQ';
  @Input() items: FaqItem[] = [];
  @Input() openFirst = false;
  trackByIndex(i: number) { return i; }
}
