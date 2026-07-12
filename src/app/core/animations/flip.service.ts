import { Injectable } from '@angular/core';
import gsap from 'gsap';
import Flip from 'gsap/Flip';

gsap.registerPlugin(Flip);

@Injectable({
  providedIn: 'root'
})
export class FlipService {

  animate(callback: () => void) {
    const state = Flip.getState('[data-flip]');

    callback();

    requestAnimationFrame(() => {
      Flip.from(state, {
        duration: .8,
        ease: 'power1.out',
        absolute: true,
        nested: true,
        stagger: 0.02
      });
    });
  }
}