import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';


export const languageInterceptor: HttpInterceptorFn = (req, next) => {
    const langService = inject(LanguageService);

    const langReq = req.clone({
        headers: req.headers.set('Accept-Language', langService.current())
    });

    return next(langReq);
};