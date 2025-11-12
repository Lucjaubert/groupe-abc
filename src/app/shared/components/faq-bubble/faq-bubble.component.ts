import {
  Component, AfterViewInit, OnDestroy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FaqService } from '../../../services/faq.service';

@Component({
  selector: 'app-faq-bubble',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq-bubble.component.html',
  styleUrls: ['./faq-bubble.component.scss']
})
export class FaqBubbleComponent implements AfterViewInit, OnDestroy {

  /** ViewModel consommé par le template */
  public vm$ = inject(FaqService).vm$;

  private faq = inject(FaqService);
  private vmSub?: Subscription;

  /* ---------- Template API ---------- */
  toggle(): void { this.faq.toggle(); }
  close(): void  { this.faq.close(); }
  track = (_: number, __: unknown) => _;

  /* ---------- A11y / UX: ESC pour fermer + scroll lock body ---------- */
  private keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  ngAfterViewInit(): void {
    // Fermer au clavier (Esc)
    try { window.addEventListener('keydown', this.keyHandler); } catch {}

    // Scroll lock du body quand le panneau est ouvert
    this.vmSub = this.vm$.subscribe(vm => {
      try {
        if (vm.open) {
          document.body.style.overflow = 'hidden';
          document.body.style.touchAction = 'none';
        } else {
          document.body.style.overflow = '';
          document.body.style.touchAction = '';
        }
      } catch { /* no-op in SSR */ }
    });
  }

  ngOnDestroy(): void {
    try { window.removeEventListener('keydown', this.keyHandler); } catch {}
    try {
      // Restaure le body si besoin
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    } catch {}
    this.vmSub?.unsubscribe();
  }
}
