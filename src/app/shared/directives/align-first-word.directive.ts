import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  Renderer2,
  SimpleChanges,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appAlignFirstWord]',
  standalone: true,
})
export class AlignFirstWordDirective implements OnChanges {
  @Input('appAlignFirstWord') html = '';

  private readonly isBrowser: boolean;

  constructor(
    private el: ElementRef<HTMLElement>,
    private rnd: Renderer2,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnChanges(_: SimpleChanges): void {
    // SSR: ne pas manipuler le DOM (évite mismatch + effets de bord)
    if (!this.isBrowser) return;

    const host = this.el.nativeElement;

    // 1) Injecter le HTML brut (si fourni)
    if (this.html != null) {
      this.rnd.setProperty(host, 'innerHTML', this.html);
    }

    // 2) Calcul du texte à partir du DOM actuel
    const raw = (host.textContent || '').trim();
    if (!raw) return;

    const m = raw.match(/^\S+/);
    const first = m ? m[0] : raw;
    const rest = raw.replace(/^\S+\s*/, '');

    // césures après "/"
    const restWithWbr = rest.replace(/\//g, '/<wbr>');

    const wrapped =
      `<span class="ctx-line1">${this.escape(first)}</span>` +
      `<span class="ctx-rest">${this.escapeAllowWbr(restWithWbr)}</span>`;

    this.rnd.setProperty(host, 'innerHTML', wrapped);
  }

  private escape(s: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return s.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
  }

  private escapeAllowWbr(s: string): string {
    return s
      .split('<wbr>')
      .map((part) => this.escape(part))
      .join('<wbr>');
  }
}
