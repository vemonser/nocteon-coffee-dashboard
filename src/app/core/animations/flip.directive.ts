import { Directive, ElementRef } from "@angular/core";

@Directive({
  selector: '[appFlip]'
})
export class FlipDirective {

  constructor(
    private el: ElementRef
  ) {
    this.el.nativeElement.setAttribute(
      'data-flip',
      ''
    );
  }
}