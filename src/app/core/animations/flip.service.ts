import { Injectable } from '@angular/core';

/**
 * FLIP animation for the language switch.
 *
 * GSAP is imported on first use, not at module load: a static import put
 * ~95 kB in the initial bundle for an animation the login screen never runs.
 * If the chunk cannot be fetched, the callback still runs — the switch is the
 * feature, the animation is a nicety.
 */
@Injectable({
  providedIn: 'root'
})
export class FlipService {

  async animate(callback: () => void): Promise<void> {
    try {
      const [{ default: gsap }, { default: Flip }] = await Promise.all([
        import('gsap'),
        import('gsap/Flip'),
      ]);
      gsap.registerPlugin(Flip);

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
    } catch {
      callback();
    }
  }
}
