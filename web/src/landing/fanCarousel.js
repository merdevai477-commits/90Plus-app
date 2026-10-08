import { gsap } from 'gsap';

const MAX_VISIBLE = 7;
const HALF = 3;
const FAN = [
  { rot: -21, scale: 0.7756, x: -30, y: 7.3, z: 1 },
  { rot: -14, scale: 0.8498, x: -22, y: 4.0, z: 2 },
  { rot: -7, scale: 0.9346, x: -11, y: 1.3, z: 3 },
  { rot: 0, scale: 1.0, x: 0, y: 0.0, z: 10 },
  { rot: 7, scale: 0.9346, x: 11, y: 1.3, z: 3 },
  { rot: 14, scale: 0.8498, x: 22, y: 4.0, z: 2 },
  { rot: 21, scale: 0.7756, x: 30, y: 7.3, z: 1 },
];

function respMul(w) {
  if (w < 480) return 0.28;
  if (w < 640) return 0.38;
  if (w < 768) return 0.5;
  if (w < 1024) return 0.75;
  return 1;
}

function hMul(w) {
  let ideal;
  if (w < 480) ideal = 22 * 16;
  else if (w < 640) ideal = 26 * 16;
  else if (w < 768) ideal = 28 * 16;
  else if (w < 1024) ideal = 34 * 16;
  else ideal = 38 * 16;
  const avail = window.innerHeight * 0.7;
  return avail >= ideal ? 1 : avail / ideal;
}

/**
 * Card-fan carousel of app screens: elastic entry, hover spread, arrow/autoplay cycling.
 * @param {{ screens: { imgUrl: string, alt: string, linkUrl?: string }[], animate: boolean, reduce: boolean }} opts
 */
export function mountFanCarousel({ screens, animate, reduce }) {
  const container = document.getElementById('fanLayout');
  if (!container) return;
  const dotsWrap = document.getElementById('fanDots');
  const prevBtn = document.getElementById('fanPrev');
  const nextBtn = document.getElementById('fanNext');

  const total = screens.length;
  const needsPag = total > MAX_VISIBLE;
  const canHover = window.matchMedia('(hover: hover)').matches;

  const els = screens.map((c, idx) => {
    const el = document.createElement(c.linkUrl ? 'a' : 'div');
    el.className = 'fan-card';
    if (c.linkUrl) {
      el.href = c.linkUrl;
      el.target = c.linkUrl.startsWith('http') ? '_blank' : '_self';
      el.rel = 'noopener noreferrer';
    }
    const img = document.createElement('img');
    img.src = c.imgUrl;
    img.alt = c.alt || `لقطة ${idx + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
    container.appendChild(el);
    return el;
  });

  const dots = [];
  if (needsPag && dotsWrap) {
    screens.forEach(() => {
      const s = document.createElement('span');
      s.className = 'fan-dot';
      dotsWrap.appendChild(s);
      dots.push(s);
    });
  }

  const slotCfg = (count, slot) => {
    if (count >= MAX_VISIBLE) return FAN[slot];
    const center = count >> 1;
    const dist = count > 1 ? (slot - center) / center : 0;
    const ad = Math.abs(dist);
    return { rot: dist * 21, scale: 1 - 0.2244 * ad * ad, x: dist * 30, y: ad * ad * 7.3, z: 10 - Math.abs(slot - center) };
  };

  const visMap = (center) => {
    const m = new Map();
    if (!needsPag) {
      screens.forEach((_, i) => m.set(i, i));
      return m;
    }
    for (let s = 0; s < MAX_VISIBLE; s++) {
      m.set((((center + s - HALF) % total) + total) % total, s);
    }
    return m;
  };

  let centerIndex = needsPag ? HALF : total >> 1;
  let isAnimating = false;
  let hasEntered = false;
  let paused = false;
  let prevVisible = new Set();
  let hoverCleanup = null;

  const setDots = () => dots.forEach((d, i) => d.classList.toggle('active', i === centerIndex));

  const setStatic = (card, t) => {
    card.style.transform = `translate(${t.x}, ${t.y}) rotate(${t.rotation}deg) scale(${t.scale})`;
    card.style.opacity = String(t.opacity);
    card.style.zIndex = String(t.zIndex);
  };

  function setupHover(map, cfg) {
    if (hoverCleanup) {
      hoverCleanup();
      hoverCleanup = null;
    }
    if (!animate || !canHover) return;

    const entries = [];
    els.forEach((el, i) => {
      const s = map.get(i);
      if (s !== undefined) entries.push({ el, slot: s });
    });
    entries.sort((a, b) => a.slot - b.slot);
    const centerSlot = entries.length >> 1;
    let leaveTimer = null;
    let activeSlot = null;

    const update = (hovered) => {
      const mul = respMul(window.innerWidth);
      const hm = hMul(window.innerWidth);
      entries.forEach(({ el, slot }) => {
        const base = cfg(slot);
        let tx = base.x * mul;
        let ty = base.y * hm;
        let tr = base.rot;
        let ts = base.scale;
        let delay;
        if (hovered !== null) {
          const dist = Math.abs(slot - hovered);
          delay = dist * 0.02;
          if (slot === hovered) {
            ty -= 2.5 * hm;
            ts *= 1.08;
          } else {
            const nrm = centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0;
            const push = 8 * (1 - Math.abs(nrm)) * (1 + 0.2 * Math.max(0, 3 - dist));
            if (slot < hovered) {
              tx -= push * mul;
              tr -= 3 / (dist + 1);
            } else {
              tx += push * mul;
              tr += 3 / (dist + 1);
            }
            if (slot === entries.length - 1 && hovered < centerSlot) ty -= 1 * hm;
            if (slot === 0 && hovered > centerSlot) ty -= 1 * hm;
          }
        } else {
          delay = Math.abs(slot - centerSlot) * 0.02;
        }
        gsap.to(el, { x: `${tx}rem`, y: `${ty}rem`, rotation: tr, scale: ts, duration: 0.5, delay, ease: 'elastic.out(1,.75)', overwrite: 'auto' });
        gsap.set(el, { zIndex: base.z });
      });
    };

    const enterHandlers = entries.map((entry) => {
      const handler = () => {
        if (isAnimating) return;
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        if (activeSlot !== entry.slot) {
          activeSlot = entry.slot;
          update(entry.slot);
        }
      };
      entry.el.addEventListener('mouseenter', handler);
      return { el: entry.el, handler };
    });

    const onLeave = () => {
      if (isAnimating) return;
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        activeSlot = null;
        update(null);
      }, 50);
    };
    container.addEventListener('mouseleave', onLeave);

    hoverCleanup = () => {
      enterHandlers.forEach((h) => h.el.removeEventListener('mouseenter', h.handler));
      container.removeEventListener('mouseleave', onLeave);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }

  function render(direction, firstMount) {
    const map = visMap(centerIndex);
    const prev = prevVisible;
    const mul = respMul(window.innerWidth);
    const hm = hMul(window.innerWidth);
    const count = needsPag ? MAX_VISIBLE : total;
    const cfg = (s) => slotCfg(count, s);
    if (firstMount) isAnimating = true;
    let done = 0;
    const vis = map.size;
    const onDone = () => {
      if (++done >= vis) {
        isAnimating = false;
        if (firstMount) hasEntered = true;
      }
    };

    els.forEach((card, i) => {
      const slot = map.get(i);
      const was = prev.has(i);
      if (slot !== undefined) {
        const c = cfg(slot);
        const target = { x: `${c.x * mul}rem`, y: `${c.y * hm}rem`, rotation: c.rot, scale: c.scale, opacity: 1, zIndex: c.z };
        if (!animate) {
          setStatic(card, target);
          onDone();
          return;
        }
        if (firstMount) {
          gsap.set(card, { x: 0, y: `${12 * hm}rem`, rotation: 0, scale: 0.5, opacity: 0 });
          gsap.to(card, { ...target, duration: 1.2, ease: 'elastic.out(1.05,.78)', delay: 0.2 + slot * 0.06, onComplete: onDone });
        } else if (!was) {
          const ex = direction === 'right' ? 40 : -40;
          gsap.set(card, { x: `${ex}rem`, y: `${c.y * hm}rem`, rotation: direction === 'right' ? 30 : -30, scale: 0.5, opacity: 0 });
          gsap.to(card, { ...target, duration: 0.6, ease: 'power2.out', onComplete: onDone });
        } else {
          gsap.to(card, { ...target, duration: 0.5, ease: 'power2.out', onComplete: onDone });
        }
      } else if (was) {
        const exo = direction === 'right' ? -40 : 40;
        if (animate) {
          gsap.to(card, { x: `${exo}rem`, opacity: 0, scale: 0.5, rotation: direction === 'right' ? -30 : 30, duration: 0.4, ease: 'power2.in', zIndex: 0 });
        } else {
          card.style.opacity = '0';
        }
      } else if (firstMount) {
        if (animate) gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 });
        else card.style.opacity = '0';
      }
    });

    prevVisible = new Set(map.keys());
    setupHover(map, cfg);
    setDots();
  }

  function cycle(direction) {
    if (isAnimating || !needsPag) return;
    isAnimating = true;
    centerIndex = direction === 'right' ? (centerIndex + 1) % total : (centerIndex - 1 + total) % total;
    render(direction, false);
  }

  prevBtn?.addEventListener('click', () => cycle('left'));
  nextBtn?.addEventListener('click', () => cycle('right'));

  container.addEventListener('mouseenter', () => {
    paused = true;
  });
  container.addEventListener('mouseleave', () => {
    paused = false;
  });

  let rt = null;
  window.addEventListener('resize', () => {
    if (rt) clearTimeout(rt);
    rt = setTimeout(() => {
      if (!isAnimating) render(null, false);
    }, 180);
  });

  const start = () => {
    if (!hasEntered) render(null, true);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            start();
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(container);
  } else {
    start();
  }

  if (needsPag && !reduce) {
    setInterval(() => {
      if (!isAnimating && !paused && hasEntered && document.visibilityState === 'visible') cycle('right');
    }, 3600);
  }
}
