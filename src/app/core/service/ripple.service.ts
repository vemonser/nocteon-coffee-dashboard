import { Injectable } from '@angular/core';
import gsap from 'gsap';

@Injectable({
  providedIn: 'root',
})
export class RippleService {
  private animating = false;

  /**
   * Material-style ripple: دايرة بلون الـ accent الجديد (solid) بتكبر من
   * نقطة الضغط لحد ما تغطي الـ container بالكامل. لما تغطيه بالكامل،
   * بيتغير الـ state الحقيقي (فيبقى تحتها بالظبط نفس اللون)، وبعدين
   * الدايرة بتختفي بسرعة من غير أي "قفلة" بصرية لأن اللونين متطابقين.
   *
   * @param container العنصر اللي هيتحط جواه الـ ripple — لازم يكون هو
   *                  الزرار/الكارت نفسه (event.currentTarget)، مش أي
   *                  parent أكبر زي الشيت كله
   * @param x, y إحداثيات نقطة الضغط (event.clientX / event.clientY)
   * @param color اللون الـ hex الجديد (accent.color)
   * @param onCovered بيتنفذ لما الدايرة تغطي الـ container بالكامل —
   *                  هنا بنغيّر الـ state الحقيقي (theme.setColor)
   */
  playColorRipple(
    container: HTMLElement,
    x: number,
    y: number,
    color: string,
    onCovered: () => void,
  ): void {
    if (this.animating) {
      return;
    }

    this.animating = true;

    const rect = container.getBoundingClientRect();
    const relativeX = x - rect.left;
    const relativeY = y - rect.top;

    // أبعد نقطة من نقطة الضغط لأي ركن في الـ container — ده حجم
    // الدايرة المطلوب عشان تغطي كل حاجة بالكامل من غير ما تسيب فراغ
    const maxRadius = Math.hypot(
      Math.max(relativeX, rect.width - relativeX),
      Math.max(relativeY, rect.height - relativeY),
    );

    const ripple = document.createElement('div');

    Object.assign(ripple.style, {
      position: 'absolute',
      left: `${relativeX - maxRadius}px`,
      top: `${relativeY - maxRadius}px`,
      width: `${maxRadius * 2}px`,
      height: `${maxRadius * 2}px`,
      borderRadius: '9999px',
      background: color,
      pointerEvents: 'none',
      zIndex: '0',
      transform: 'scale(0)',
      transformOrigin: 'center',
      willChange: 'transform, opacity',
    });

    const computed = getComputedStyle(container);
    const oldPosition = container.style.position;
    if (computed.position === 'static') {
      container.style.position = 'relative';
    }

    const oldOverflow = container.style.overflow;
    container.style.overflow = 'hidden';

    container.appendChild(ripple);

    const cleanup = () => {
      ripple.remove();
      container.style.overflow = oldOverflow;
      container.style.position = oldPosition;
      this.animating = false;
    };

    gsap
      .timeline({ onComplete: cleanup })
      .to(ripple, {
        scale: 1,
        duration: 0.5,
        ease: 'power2.out',
        onComplete: onCovered, // هنا الدايرة غطت كل حاجة + اللون اتغير فعليًا
      })
      .to(ripple, {
        opacity: 0,
        duration: 0.2,
        ease: 'power1.out',
      });
  }
}
