import { Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appAlignFirstWord]',
  standalone: true
})
export class AlignFirstWordDirective implements OnChanges {
  @Input('appAlignFirstWord') html = '';

  constructor(private el: ElementRef<HTMLElement>, private rnd: Renderer2) {}

  ngOnChanges(_: SimpleChanges): void {
    if (this.html != null) this.el.nativeElement.innerHTML = this.html;

    const raw = this.el.nativeElement.textContent?.trim() ?? '';
    if (!raw) return;

    const m = raw.match(/^\S+/);
    const first = m ? m[0] : raw;
    const rest  = raw.replace(/^\S+\s*/, '');

    const restHtml = rest.replace(/\//g, '/<wbr>');

    const wrapped =
      `<span class="ctx-line1">${this.escape(first)}</span>` +
      `<span class="ctx-rest">${this.escapeAllowWbr(restHtml)}</span>`;
    this.el.nativeElement.innerHTML = wrapped;
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
  }
  private escapeAllowWbr(s: string): string {
    return s.split('<wbr>').map(part => this.escape(part)).join('<wbr>');
  }
}
