import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatRelative } from '../utils/locale-format';

@Pipe({ name: 'formatRelative', standalone: true, pure: false })
export class FormatRelativePipe implements PipeTransform {
  private language = inject(LanguageService);

  transform(value: unknown): string {
    return formatRelative(value, this.language.language());
  }
}