import '@fontsource/noto-kufi-arabic/arabic-400.css';
import '@fontsource/noto-kufi-arabic/arabic-500.css';
import '@fontsource/noto-kufi-arabic/arabic-600.css';
import '@fontsource/noto-kufi-arabic/arabic-700.css';
import '@fontsource/work-sans/latin-400.css';
import '@fontsource/work-sans/latin-500.css';
import '@fontsource/work-sans/latin-600.css';
import '@fontsource/work-sans/latin-700.css';
import '@fontsource/fraunces/latin-700.css';
import './landing.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bindAppleStoreLinks } from './storeLinks.js';
import { mountFanCarousel } from './fanCarousel.js';

import screen1 from '../assets/screens/screen-1.svg';
import screen2 from '../assets/screens/screen-2.svg';
import screen3 from '../assets/screens/screen-3.svg';
import screen4 from '../assets/screens/screen-4.svg';
import screen5 from '../assets/screens/screen-5.svg';
import screen6 from '../assets/screens/screen-6.svg';
import screen7 from '../assets/screens/screen-7.svg';
import screen8 from '../assets/screens/screen-8.svg';

const SCREENS = [
  { imgUrl: screen1, alt: 'نتائج مباشرة' },
  { imgUrl: screen2, alt: 'كويزات يومية' },
  { imgUrl: screen3, alt: 'تنبؤات' },
  { imgUrl: screen4, alt: 'ريلز' },
  { imgUrl: screen5, alt: 'المساعد الذكي' },
  { imgUrl: screen6, alt: 'الترتيب' },
  { imgUrl: screen7, alt: 'الأخبار' },
  { imgUrl: screen8, alt: 'الملف الشخصي' },
];

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = window.matchMedia('(hover: hover)').matches;
const animate = !reduce;

bindAppleStoreLinks();

function setupReveal() {
  if (!animate) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 42, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } },
    );
  });
}

function setupCardTilt() {
  if (reduce || !canHover) return;
  document.querySelectorAll('.tilt').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) translateY(-4px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

function setupHeroPhone() {
  const stage = document.querySelector('.hero-visual');
  const phone = document.querySelector('.iphone');
  const tilt = document.querySelector('.iphone-tilt');
  if (stage && phone && tilt && animate) {
    gsap.to(phone, { y: -14, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    if (canHover) {
      stage.addEventListener('mousemove', (e) => {
        const r = stage.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(tilt, { rotationY: px * 20, rotationX: -py * 20, duration: 0.6, ease: 'power2.out' });
      });
      stage.addEventListener('mouseleave', () => {
        gsap.to(tilt, { rotationY: 0, rotationX: 0, duration: 0.9, ease: 'power3.out' });
      });
    }
  }

  const shots = document.querySelectorAll('.phone-shot');
  if (shots.length > 1 && !reduce) {
    let si = 0;
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const n = (si + 1) % shots.length;
      shots[si].style.opacity = '0';
      shots[n].style.opacity = '1';
      si = n;
    }, 3800);
  }
}

setupReveal();
setupCardTilt();
setupHeroPhone();
mountFanCarousel({ screens: SCREENS, animate, reduce });
