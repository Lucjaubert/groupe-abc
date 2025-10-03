import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../services/language.service';

@Pipe({ name: 'langLink', standalone: true, pure: false })
export class LangLinkPipe implements PipeTransform {
  constructor(private lang: LanguageService) {}
  transform(path: string): string {
    return this.lang.link(path);
  }
}

