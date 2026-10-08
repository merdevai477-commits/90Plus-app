import '@fontsource/noto-kufi-arabic/arabic-400.css';
import '@fontsource/noto-kufi-arabic/arabic-500.css';
import '@fontsource/noto-kufi-arabic/arabic-600.css';
import '@fontsource/noto-kufi-arabic/arabic-700.css';
import '@fontsource/work-sans/latin-400.css';
import '@fontsource/work-sans/latin-500.css';
import '@fontsource/work-sans/latin-600.css';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
import './landing.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bindAppleStoreLinks } from './storeLinks.js';

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

bindAppleStoreLinks();

function setupHeader() {
  const header = document.getElementById('siteHeader');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function setupHero() {
  if (reduce) return;
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .from('.hero-media', { scale: 1.18, opacity: 0, duration: 1.8, ease: 'power2.out' }, 0)
    .from('[data-intro]', { y: 40, opacity: 0, duration: 0.9, stagger: 0.09 }, 0.25)
    .from('.chip', { y: 30, scale: 0.85, opacity: 0, duration: 0.8, stagger: 0.15 }, 0.9);

  gsap.to('.hero-media img', {
    yPercent: 12,
    scale: 1.08,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero-copy', {
    y: -60,
    opacity: 0.2,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true },
  });

  document.querySelectorAll('.chip').forEach((chip, i) => {
    gsap.to(chip, { y: i % 2 ? 10 : -10, duration: 2.6 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  });

  const hero = document.querySelector('.hero');
  if (hero && canHover) {
    const chips = [...hero.querySelectorAll('.chip')].map((el) => ({
      depth: Number(el.dataset.depth || 1),
      x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }),
    }));
    hero.addEventListener('mousemove', (e) => {
      const px = e.clientX / window.innerWidth - 0.5;
      chips.forEach((c) => c.x(px * -40 * c.depth));
    });
  }
}

function setupLiveClock() {
  const nodes = document.querySelectorAll('[data-live-minute]');
  if (!nodes.length || reduce) return;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    nodes.forEach((el) => {
      const next = Math.min(Number(el.dataset.liveMinute) + 1, 90);
      el.dataset.liveMinute = String(next);
      el.textContent = next >= 90 ? '90+' : String(next);
    });
  }, 6000);
}

function setupStory() {
  const phone = document.getElementById('storyPhone');
  const steps = [...document.querySelectorAll('.step')];
  if (!phone || !steps.length) return;

  const screens = new Map([...phone.querySelectorAll('.screen')].map((s) => [s.dataset.screen, s]));
  const dots = new Map([...document.querySelectorAll('.stage-dots li')].map((d) => [d.dataset.dot, d]));

  // Small screens drop the sticky phone, so each step gets its own copy of its screen.
  const miniScreens = [];
  steps.forEach((step) => {
    const slot = step.querySelector('.step-phone');
    const source = screens.get(step.dataset.step);
    if (!slot || !source) return;
    const mini = document.createElement('div');
    mini.className = 'phone';
    mini.setAttribute('aria-hidden', 'true');
    mini.innerHTML = '<div class="phone-island"></div><div class="phone-screen"></div>';
    const clone = source.cloneNode(true);
    mini.querySelector('.phone-screen').appendChild(clone);
    slot.appendChild(mini);
    miniScreens.push(clone);
  });

  const stage = phone.closest('.story-stage');
  const fitPhone = () => {
    if (!stage) return;
    const scale = Math.min(1, (stage.clientHeight - 16) / phone.offsetHeight, stage.clientWidth / (phone.offsetWidth + 40));
    stage.style.setProperty('--phone-scale', scale > 0 ? scale.toFixed(3) : '1');
  };
  fitPhone();
  window.addEventListener('resize', fitPhone, { passive: true });

  let current = null;
  const activate = (name) => {
    if (name === current) return;
    current = name;
    phone.dataset.active = name;
    steps.forEach((s) => s.classList.toggle('is-active', s.dataset.step === name));
    screens.forEach((s, key) => s.classList.toggle('is-on', key === name));
    dots.forEach((d, key) => d.classList.toggle('on', key === name));
  };
  activate(steps[0].dataset.step);

  const stepObserver = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.isIntersecting && activate(entry.target.dataset.step)),
    { rootMargin: '-45% 0px -45% 0px' },
  );
  steps.forEach((s) => stepObserver.observe(s));

  const miniObserver = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.target.classList.toggle('is-on', entry.isIntersecting)),
    { threshold: 0.35 },
  );
  miniScreens.forEach((s) => miniObserver.observe(s));
}

function setupCounters() {
  document.querySelectorAll('.counters [data-count-to]').forEach((el) => {
    const target = Number(el.dataset.countTo);
    if (reduce || !target) return;
    const state = { v: 0 };
    el.textContent = '0';
    gsap.to(state, {
      v: target,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = String(Math.round(state.v)); },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}

function setupReveals() {
  if (reduce) return;
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  const pops = gsap.utils.toArray('.reveal-pop');
  if (pops.length) {
    gsap.from(pops, {
      scale: 0.6,
      opacity: 0,
      duration: 0.7,
      ease: 'back.out(1.8)',
      stagger: 0.06,
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: '.prize-cloud', start: 'top 85%', once: true },
    });
  }

  gsap.from('.rank-cards', {
    y: 120,
    opacity: 0,
    duration: 1.1,
    ease: 'power3.out',
    clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '.rank-cards', start: 'top 85%', once: true },
  });

  gsap.to('.arena-bg img', {
    yPercent: -12,
    ease: 'none',
    scrollTrigger: { trigger: '.arena', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.from('.download-bg img', {
    scale: 1.2,
    ease: 'none',
    scrollTrigger: { trigger: '.download', start: 'top bottom', end: 'center center', scrub: true },
  });
}

setupHeader();
setupHero();
setupLiveClock();
setupStory();
setupCounters();
setupReveals();
