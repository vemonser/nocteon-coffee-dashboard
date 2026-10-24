import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatDateTime } from '../utils/locale-format';

@Pipe({ name: 'formatDateTime', standalone: true, pure: false })
export class FormatDateTimePipe implements PipeTransform {
  private language = inject(LanguageService);

  transform(value: unknown): string {
    return formatDateTime(value, this.language.language());
  }
}