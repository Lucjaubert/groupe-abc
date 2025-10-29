import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaqService, FaqItem } from '../../../services/faq.service';

@Component({
  selector: 'app-faq-bubble',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq-bubble.component.html',
  styleUrls: ['./faq-bubble.component.scss']
})
export class FaqBubbleComponent {
  private faq = inject(FaqService);

  vm$ = this.faq.vm$;

  toggle() { this.faq.toggle(); }
  close()  { this.faq.close(); }

  track(index: number, item: FaqItem) { return index; }

  @HostListener('document:keydown.escape') onEsc() { this.close(); }
}
