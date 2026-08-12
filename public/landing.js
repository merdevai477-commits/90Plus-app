(function () {
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var hasGSAP = typeof window.gsap !== "undefined";
        var animate = hasGSAP && !reduce;

        var SCREENS = [
          { imgUrl: "/screens/screen-1.svg", alt: "نتائج مباشرة" },
          { imgUrl: "/screens/screen-2.svg", alt: "كويزات يومية" },
          { imgUrl: "/screens/screen-3.svg", alt: "تنبؤات" },
          { imgUrl: "/screens/screen-4.svg", alt: "ريلز" },
          { imgUrl: "/screens/screen-5.svg", alt: "المساعد الذكي" },
          { imgUrl: "/screens/screen-6.svg", alt: "الترتيب" },
          { imgUrl: "/screens/screen-7.svg", alt: "الأخبار" },
          { imgUrl: "/screens/screen-8.svg", alt: "الملف الشخصي" }
        ];

        /* ---------- Store buttons: reliable App Store open on iOS ---------- */
        (function () {
          var APPLE_WEB = "https://apps.apple.com/app/id6758296989";
          var APPLE_NATIVE = "itms-apps://apps.apple.com/app/id6758296989";
          var ua = navigator.userAgent || "";
          var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

          function appleLinks() {
            return document.querySelectorAll(
              'a[data-store="apple"], .hero-copy a.store-badge.primary, a.store-badge.primary[href*="apps.apple.com"], a.glass-btn.primary[href*="apps.apple.com"]'
            );
          }

          function openAppleStore() {
            if (isIOS) {
              var started = Date.now();
              window.location.href = APPLE_NATIVE;
              setTimeout(function () {
                if (document.visibilityState === "visible" && Date.now() - started < 1800) {
                  window.location.href = APPLE_WEB;
                }
              }, 700);
            } else {
              window.location.assign(APPLE_WEB);
            }
          }

          appleLinks().forEach(function (a) {
            a.setAttribute("href", APPLE_WEB);
            a.setAttribute("data-store", "apple");

            // Avoid double-binding if script runs twice
            if (a.getAttribute("data-apple-bound") === "1") return;
            a.setAttribute("data-apple-bound", "1");

            var lastOpen = 0;
            function onActivate(e) {
              if (e) {
                e.preventDefault();
                e.stopPropagation();
              }
              var now = Date.now();
              if (now - lastOpen < 900) return;
              lastOpen = now;
              openAppleStore();
            }

            if (isIOS) {
              a.addEventListener("touchend", onActivate, { passive: false });
              // Still catch trackpad/mouse on iPadOS
              a.addEventListener("click", onActivate, { passive: false });
            } else {
              a.addEventListener("click", onActivate, { passive: false });
            }
          });
        })();

        /* ---------- Scroll reveal ---------- */
        if (hasGSAP && window.ScrollTrigger && !reduce) {
          gsap.registerPlugin(ScrollTrigger);
          gsap.utils.toArray(".reveal").forEach(function (el) {
            gsap.fromTo(
              el,
              { y: 42, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } }
            );
          });
        } else {
          document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
        }

        /* ---------- 3D tilt on cards ---------- */
        if (!reduce && window.matchMedia("(hover: hover)").matches) {
          document.querySelectorAll(".tilt").forEach(function (el) {
            el.addEventListener("mousemove", function (e) {
              var r = el.getBoundingClientRect();
              var px = (e.clientX - r.left) / r.width - 0.5;
              var py = (e.clientY - r.top) / r.height - 0.5;
              el.style.transform = "perspective(700px) rotateY(" + px * 9 + "deg) rotateX(" + -py * 9 + "deg) translateY(-4px)";
            });
            el.addEventListener("mouseleave", function () { el.style.transform = ""; });
          });
        }

        /* ---------- Hero iPhone: float + parallax + crossfade ---------- */
        (function () {
          var stage = document.querySelector(".hero-visual");
          var phone = document.querySelector(".iphone");
          var tilt = document.querySelector(".iphone-tilt");
          if (stage && phone && tilt && animate) {
            gsap.to(phone, { y: -14, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
            if (window.matchMedia("(hover: hover)").matches) {
              stage.addEventListener("mousemove", function (e) {
                var r = stage.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                gsap.to(tilt, { rotationY: px * 20, rotationX: -py * 20, duration: 0.6, ease: "power2.out" });
              });
              stage.addEventListener("mouseleave", function () {
                gsap.to(tilt, { rotationY: 0, rotationX: 0, duration: 0.9, ease: "power3.out" });
              });
            }
          }
          var shots = document.querySelectorAll(".phone-shot");
          if (shots.length > 1 && !reduce) {
            var si = 0;
            setInterval(function () {
              var n = (si + 1) % shots.length;
              shots[si].style.opacity = "0";
              shots[n].style.opacity = "1";
              si = n;
            }, 3800);
          }
        })();

        /* ---------- Fan carousel (ported from card-fan-carousel) ---------- */
        (function () {
          var container = document.getElementById("fanLayout");
          if (!container) return;
          var dotsWrap = document.getElementById("fanDots");
          var prevBtn = document.getElementById("fanPrev");
          var nextBtn = document.getElementById("fanNext");

          var MAX_VISIBLE = 7, HALF = 3;
          var FAN = [
            { rot: -21, scale: 0.7756, x: -30, y: 7.3, z: 1 },
            { rot: -14, scale: 0.8498, x: -22, y: 4.0, z: 2 },
            { rot: -7, scale: 0.9346, x: -11, y: 1.3, z: 3 },
            { rot: 0, scale: 1.0, x: 0, y: 0.0, z: 10 },
            { rot: 7, scale: 0.9346, x: 11, y: 1.3, z: 3 },
            { rot: 14, scale: 0.8498, x: 22, y: 4.0, z: 2 },
            { rot: 21, scale: 0.7756, x: 30, y: 7.3, z: 1 }
          ];

          var cards = SCREENS;
          var total = cards.length;
          var needsPag = total > MAX_VISIBLE;

          var els = cards.map(function (c, idx) {
            var el = document.createElement(c.linkUrl ? "a" : "div");
            el.className = "fan-card";
            if (c.linkUrl) {
              el.href = c.linkUrl;
              el.target = c.linkUrl.indexOf("http") === 0 ? "_blank" : "_self";
              el.rel = "noopener noreferrer";
            }
            var img = document.createElement("img");
            img.src = c.imgUrl;
            img.alt = c.alt || ("ظ„ظ‚ط·ط© " + (idx + 1));
            img.loading = "lazy";
            el.appendChild(img);
            container.appendChild(el);
            return el;
          });

          var dots = [];
          if (needsPag && dotsWrap) {
            cards.forEach(function () {
              var s = document.createElement("span");
              s.className = "fan-dot";
              dotsWrap.appendChild(s);
              dots.push(s);
            });
          }

          function respMul(w) {
            if (w < 480) return 0.28;
            if (w < 640) return 0.38;
            if (w < 768) return 0.5;
            if (w < 1024) return 0.75;
            return 1;
          }
          function hMul(w) {
            var ideal;
            if (w < 480) ideal = 22 * 16;
            else if (w < 640) ideal = 26 * 16;
            else if (w < 768) ideal = 28 * 16;
            else if (w < 1024) ideal = 34 * 16;
            else ideal = 38 * 16;
            var avail = window.innerHeight * 0.7;
            return avail >= ideal ? 1 : avail / ideal;
          }
          function slotCfg(count, slot) {
            if (count >= MAX_VISIBLE) return FAN[slot];
            var center = count >> 1;
            var dist = count > 1 ? (slot - center) / center : 0;
            var ad = Math.abs(dist);
            return { rot: dist * 21, scale: 1 - 0.2244 * ad * ad, x: dist * 30, y: ad * ad * 7.3, z: 10 - Math.abs(slot - center) };
          }
          function visMap(center) {
            var m = new Map();
            if (!needsPag) { cards.forEach(function (_, i) { m.set(i, i); }); return m; }
            for (var s = 0; s < MAX_VISIBLE; s++) {
              m.set((((center + s - HALF) % total) + total) % total, s);
            }
            return m;
          }

          var centerIndex = needsPag ? HALF : total >> 1;
          var isAnimating = false, hasEntered = false, paused = false;
          var prevVisible = new Set();
          var hoverCleanup = null;

          function setDots() {
            dots.forEach(function (d, i) { d.classList.toggle("active", i === centerIndex); });
          }

          function setStatic(card, t) {
            card.style.transform = "translate(" + t.x + ", " + t.y + ") rotate(" + t.rotation + "deg) scale(" + t.scale + ")";
            card.style.opacity = t.opacity;
            card.style.zIndex = t.zIndex;
          }

          function render(direction, firstMount) {
            var map = visMap(centerIndex);
            var prev = prevVisible;
            var mul = respMul(window.innerWidth), hm = hMul(window.innerWidth);
            var count = needsPag ? MAX_VISIBLE : total;
            var cfg = function (s) { return slotCfg(count, s); };
            if (firstMount) isAnimating = true;
            var done = 0, vis = map.size;
            var onDone = function () { if (++done >= vis) { isAnimating = false; if (firstMount) hasEntered = true; } };

            els.forEach(function (card, i) {
              var slot = map.get(i);
              var was = prev.has(i);
              if (slot !== undefined) {
                var c = cfg(slot);
                var target = { x: c.x * mul + "rem", y: c.y * hm + "rem", rotation: c.rot, scale: c.scale, opacity: 1, zIndex: c.z };
                if (!animate) { setStatic(card, target); onDone(); return; }
                if (firstMount) {
                  gsap.set(card, { x: 0, y: 12 * hm + "rem", rotation: 0, scale: 0.5, opacity: 0 });
                  gsap.to(card, Object.assign({}, target, { duration: 1.2, ease: "elastic.out(1.05,.78)", delay: 0.2 + slot * 0.06, onComplete: onDone }));
                } else if (!was) {
                  var ex = direction === "right" ? 40 : -40;
                  gsap.set(card, { x: ex + "rem", y: c.y * hm + "rem", rotation: direction === "right" ? 30 : -30, scale: 0.5, opacity: 0 });
                  gsap.to(card, Object.assign({}, target, { duration: 0.6, ease: "power2.out", onComplete: onDone }));
                } else {
                  gsap.to(card, Object.assign({}, target, { duration: 0.5, ease: "power2.out", onComplete: onDone }));
                }
              } else if (was) {
                var exo = direction === "right" ? -40 : 40;
                if (animate) gsap.to(card, { x: exo + "rem", opacity: 0, scale: 0.5, rotation: direction === "right" ? -30 : 30, duration: 0.4, ease: "power2.in", zIndex: 0 });
                else card.style.opacity = "0";
              } else if (firstMount) {
                if (animate) gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 });
                else card.style.opacity = "0";
              }
            });

            prevVisible = new Set(map.keys());
            setupHover(map, cfg);
            setDots();
          }

          function setupHover(map, cfg) {
            if (hoverCleanup) { hoverCleanup(); hoverCleanup = null; }
            if (!animate || !window.matchMedia("(hover: hover)").matches) return;
            var entries = [];
            els.forEach(function (el, i) { var s = map.get(i); if (s !== undefined) entries.push({ el: el, slot: s }); });
            entries.sort(function (a, b) { return a.slot - b.slot; });
            var centerSlot = entries.length >> 1;
            var leaveTimer = null, activeSlot = null;

            function update(hovered) {
              var mul = respMul(window.innerWidth), hm = hMul(window.innerWidth);
              entries.forEach(function (entry) {
                var el = entry.el, slot = entry.slot;
                var base = cfg(slot);
                var tx = base.x * mul, ty = base.y * hm, tr = base.rot, ts = base.scale, delay = 0;
                if (hovered !== null) {
                  var dist = Math.abs(slot - hovered);
                  delay = dist * 0.02;
                  if (slot === hovered) { ty -= 2.5 * hm; ts *= 1.08; }
                  else {
                    var nrm = centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0;
                    var push = 8 * (1 - Math.abs(nrm)) * (1 + 0.2 * Math.max(0, 3 - dist));
                    if (slot < hovered) { tx -= push * mul; tr -= 3 / (dist + 1); }
                    else { tx += push * mul; tr += 3 / (dist + 1); }
                    if (slot === entries.length - 1 && hovered < centerSlot) ty -= 1 * hm;
                    if (slot === 0 && hovered > centerSlot) ty -= 1 * hm;
                  }
                } else { delay = Math.abs(slot - centerSlot) * 0.02; }
                gsap.to(el, { x: tx + "rem", y: ty + "rem", rotation: tr, scale: ts, duration: 0.5, delay: delay, ease: "elastic.out(1,.75)", overwrite: "auto" });
                gsap.set(el, { zIndex: base.z });
              });
            }

            var enterHandlers = entries.map(function (entry) {
              var handler = function () {
                if (isAnimating) return;
                if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
                if (activeSlot !== entry.slot) { activeSlot = entry.slot; update(entry.slot); }
              };
              entry.el.addEventListener("mouseenter", handler);
              return { el: entry.el, handler: handler };
            });

            var onLeave = function () {
              if (isAnimating) return;
              if (leaveTimer) clearTimeout(leaveTimer);
              leaveTimer = setTimeout(function () { activeSlot = null; update(null); }, 50);
            };
            container.addEventListener("mouseleave", onLeave);

            hoverCleanup = function () {
              enterHandlers.forEach(function (h) { h.el.removeEventListener("mouseenter", h.handler); });
              container.removeEventListener("mouseleave", onLeave);
              if (leaveTimer) clearTimeout(leaveTimer);
            };
          }

          function cycle(direction) {
            if (isAnimating || !needsPag) return;
            isAnimating = true;
            centerIndex = direction === "right" ? (centerIndex + 1) % total : (centerIndex - 1 + total) % total;
            render(direction, false);
          }

          if (prevBtn) prevBtn.addEventListener("click", function () { cycle("left"); });
          if (nextBtn) nextBtn.addEventListener("click", function () { cycle("right"); });

          container.addEventListener("mouseenter", function () { paused = true; });
          container.addEventListener("mouseleave", function () { paused = false; });

          var rt = null;
          window.addEventListener("resize", function () {
            if (rt) clearTimeout(rt);
            rt = setTimeout(function () { if (!isAnimating) render(null, false); }, 180);
          });

          function start() { if (hasEntered) return; render(null, true); }
          if ("IntersectionObserver" in window) {
            var io = new IntersectionObserver(function (entries) {
              entries.forEach(function (e) { if (e.isIntersecting) { start(); io.disconnect(); } });
            }, { threshold: 0.2 });
            io.observe(container);
          } else {
            start();
          }

          if (needsPag && !reduce) {
            setInterval(function () {
              if (!isAnimating && !paused && hasEntered && document.visibilityState === "visible") cycle("right");
            }, 3600);
          }
        })();
      })();