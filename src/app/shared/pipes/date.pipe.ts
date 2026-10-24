import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatDate } from '../utils/locale-format';

@Pipe({ name: 'formatDate', standalone: true, pure: false })
export class FormatDatePipe implements PipeTransform {
  private language = inject(LanguageService);

  transform(value: unknown): string {
    return formatDate(value, this.language.language());
  }
}