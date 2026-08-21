/* ==========================================================================
   Nuvya motion system — ported and generalized from the live nuvya.vc
   teaser so every page shares the same signature: reveals, scroll-scrubbed
   wipes, the drifting mark echo, and a hero pin/recede track. Every value
   is a pure function of scroll position, computed fresh each frame, so
   scrolling back up reverses it exactly. Nothing here is a timed
   animation loop — everything is gated behind IntersectionObserver so
   scroll listeners only run while their scene is near the viewport.
   ========================================================================== */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  document.addEventListener("touchstart", function () {}, { passive: true });

  /* ---- Stable viewport height ---------------------------------------------
     iOS Safari changes window.innerHeight live as its toolbar collapses and
     expands *during* a scroll gesture — every pinned scene below divides by
     this value once per frame, so reading window.innerHeight fresh each
     frame turns that toolbar animation directly into scroll-progress jitter
     (the exact "transitions don't trigger correctly" symptom on iPhone).
     Cache it instead, refreshed only on resize/orientationchange (debounced
     so a toolbar-triggered resize mid-scroll doesn't retrigger this either) —
     never on a scroll or animation frame. visualViewport tracks the layout
     viewport more consistently than window.innerHeight where it's available. */
  let vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  let vhTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshVh = function () {
    vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  };
  const scheduleVhRefresh = function () {
    clearTimeout(vhTimer);
    vhTimer = setTimeout(refreshVh, 200);
  };
  window.addEventListener("resize", scheduleVhRefresh, { passive: true });
  window.addEventListener("orientationchange", scheduleVhRefresh, { passive: true });

  /* ---- Topbar + hero arrival sequence -------------------------------- */
  const topbar = document.querySelector<HTMLElement>(".nv-topbar");
  const hero = document.querySelector<HTMLElement>(".nv-hero");
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (topbar) topbar.classList.add("is-ready");
      if (hero) hero.classList.add("is-ready");
    });
  });

  /* Condense the topbar once scrolled past the fold. Stays visible at all
     times — a floating nav that vanishes on scroll-down defeats its own
     purpose as a persistent piece of UI. */
  if (topbar) {
    let ticking = false;
    const onScroll = function () {
      topbar.classList.toggle("is-condensed", window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(onScroll);
      },
      { passive: true }
    );
  }

  /* ---- Mobile menu ------------------------------------------------------ */
  const toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const menu = document.querySelector<HTMLElement>("[data-menu]");
  if (toggle && menu) {
    const closeMenu = function () {
      toggle.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
      document.body.style.overflow = "";
    };
    const openMenu = function () {
      toggle.setAttribute("aria-expanded", "true");
      menu.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };
    toggle.addEventListener("click", function () {
      if (menu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---- Scroll-reveal for standalone one-shot fades ----------------------- */
  const revealEls = document.querySelectorAll<HTMLElement>(".nv-reveal");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    } else {
      const revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
      );
      revealEls.forEach(function (el) {
        revealObserver.observe(el);
      });
    }
  }

  /* ---- Cursor parallax on any element flagged [data-nv-mark] -------------- */
  document.querySelectorAll<HTMLElement>("[data-nv-mark]").forEach(function (mark) {
    if (!canHover || reduceMotion) return;
    let targetX = 0,
      targetY = 0,
      curX = 0,
      curY = 0;

    const onMove = function (e: MouseEvent) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = ((e.clientX - cx) / cx) * 7;
      targetY = ((e.clientY - cy) / cy) * 5.5;
    };

    const tick = function () {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      mark.style.transform =
        "translate3d(" + curX.toFixed(2) + "px, " + curY.toFixed(2) + "px, 0) " +
        "rotate3d(" + (-curY / 8).toFixed(3) + ", " + (curX / 10).toFixed(3) + ", 0, 2.2deg)";
      requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    requestAnimationFrame(tick);

    document.addEventListener("mouseleave", function () {
      targetX = 0;
      targetY = 0;
    });
  });

  /* ---- Liquid Glass specular highlight -------------------------------------
     Every glass surface tracks the cursor via --pointer-x/--pointer-y, read
     by the radial-gradient highlight in nuvya.css. One shared listener per
     element, only on hover-capable pointers, so it costs nothing on touch. */
  const GLASS_SELECTOR =
    ".nv-topbar__row, .nv-product-row, " +
    ".nv-close__inner, .nv-belief, .nv-404__panel, .nv-product-section__inner, .nv-about-card";
  if (canHover && !reduceMotion) {
    document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach(function (surface) {
      surface.addEventListener(
        "mousemove",
        function (e) {
          const rect = surface.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          surface.style.setProperty("--pointer-x", x.toFixed(1) + "%");
          surface.style.setProperty("--pointer-y", y.toFixed(1) + "%");
        },
        { passive: true }
      );
    });
  }

  /* Product cards additionally tilt toward the cursor — a small physical
     response (max ~5deg) that makes each card read as an object with
     depth rather than a flat panel. Reuses the same mousemove, writing
     --tilt-x/--tilt-y (plain degree values, unlike the percentage-based
     pointer vars) consumed by the perspective transform in site.css. */
  if (canHover && !reduceMotion) {
    document.querySelectorAll<HTMLElement>(".nv-product-row").forEach(function (card) {
      card.addEventListener(
        "mousemove",
        function (e) {
          const rect = card.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          card.style.setProperty("--tilt-x", (px * 5).toFixed(2) + "deg");
          card.style.setProperty("--tilt-y", (-py * 4).toFixed(2) + "deg");
        },
        { passive: true }
      );
      card.addEventListener("mouseleave", function () {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    });
  }

  /* ==========================================================================
     Scroll-driven scenes — each gated behind an IntersectionObserver so the
     scroll listener only runs while its scene is near the viewport, and each
     write batched to one requestAnimationFrame per scroll event.
     ========================================================================== */

  function makeScrollScene(gateEl: Element | null, onScroll: () => void) {
    if (!gateEl || reduceMotion) return;
    let ticking = false;
    let active = false;

    const request = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        onScroll();
        ticking = false;
      });
    };

    if (!window.IntersectionObserver) {
      window.addEventListener("scroll", request, { passive: true });
      window.addEventListener("resize", request, { passive: true });
      request();
      return;
    }

    const gate = new IntersectionObserver(
      function (entries) {
        const isNear = entries[0].isIntersecting;
        if (isNear && !active) {
          active = true;
          window.addEventListener("scroll", request, { passive: true });
          window.addEventListener("resize", request, { passive: true });
          request();
        } else if (!isNear && active) {
          active = false;
          window.removeEventListener("scroll", request);
          window.removeEventListener("resize", request);
        }
      },
      { rootMargin: "40% 0px 40% 0px" }
    );
    gate.observe(gateEl);
  }

  function clamp01(v: number) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /* Hero — the flagship scene. .nv-hero-scene is a tall track (190svh);
     .nv-hero is pinned via CSS position:sticky while it scrolls underneath.
     Progress (0-1) is how far the visitor has scrolled through that extra
     height. */
  (function heroScene() {
    const scene = document.querySelector<HTMLElement>("[data-hero-scene]");
    const stage = document.querySelector<HTMLElement>("[data-hero-stage]");
    const guides = document.querySelector<HTMLElement>("[data-hero-guides]");
    const sweep = document.querySelector<HTMLElement>("[data-hero-sweep]");
    if (!scene || !stage) return;

    const render = function () {
      const rect = scene.getBoundingClientRect();
      const total = rect.height - vh;
      const progress = total > 0 ? clamp01(-rect.top / total) : 0;

      stage.style.opacity = String(1 - clamp01(progress / 0.88));
      stage.style.transform =
        "scale(" + (1 - progress * 0.07).toFixed(4) + ") translateY(" + (progress * -26).toFixed(2) + "px)";

      if (guides) {
        const guideOpacity = Math.max(0, 1 - Math.abs(progress - 0.16) / 0.16) * 0.55;
        guides.style.opacity = guideOpacity.toFixed(3);
      }
      if (sweep) {
        const sweepW = sweep.getBoundingClientRect().width || 100;
        const bandW = sweepW * 0.46;
        const t = clamp01(progress / 0.7);
        const sweepX = -bandW + t * (sweepW + bandW * 2);
        sweep.style.backgroundPosition = sweepX.toFixed(1) + "px 0";
      }
    };

    makeScrollScene(scene, render);
  })();

  /* Philosophy — the second pinned scene, immediately following the hero's.
     .nv-philosophy-scene is a 220svh track; the statement scales in from an
     oversized blur (0-0.4), holds legible (0.4-0.6), then scales down and
     dissolves upward as the visitor keeps scrolling (0.6-1) — an emergence
     and a dissolve, not a fade-up, so the hero-to-philosophy transition
     reads as one continuous camera move rather than two stacked sections. */
  (function philosophyScene() {
    const scene = document.querySelector<HTMLElement>("[data-philosophy-scene]");
    const text = document.querySelector<HTMLElement>("[data-philosophy-text]");
    if (!scene || !text) return;

    const render = function () {
      const rect = scene.getBoundingClientRect();
      const total = rect.height - vh;
      const progress = total > 0 ? clamp01(-rect.top / total) : 0;

      let scale: number, blur: number, opacity: number, translate: number;
      if (progress < 0.4) {
        const t = progress / 0.4;
        scale = 1.35 - t * 0.35;
        blur = 16 * (1 - t);
        opacity = t;
        translate = 0;
      } else if (progress < 0.6) {
        scale = 1;
        blur = 0;
        opacity = 1;
        translate = 0;
      } else {
        const t = (progress - 0.6) / 0.4;
        scale = 1 - t * 0.12;
        blur = t * 10;
        opacity = 1 - t;
        translate = -t * 40;
      }
      text.style.opacity = opacity.toFixed(3);
      text.style.filter = "blur(" + blur.toFixed(2) + "px)";
      text.style.transform = "scale(" + scale.toFixed(4) + ") translateY(" + translate.toFixed(2) + "px)";
    };

    makeScrollScene(scene, render);
  })();

  /* Wipe statements — a left-to-right mask reveal on any [data-wipe]
     element, tied to how far its own bounding box has crossed a band in
     the upper viewport. Generalized so every page can use this, not just
     Philosophy: each element gates its own listener. */
  document.querySelectorAll<HTMLElement>("[data-wipe]").forEach(function (statement) {
    const render = function () {
      const rect = statement.getBoundingClientRect();
      const progress = clamp01((vh * 0.82 - rect.top) / (vh * 0.55));
      statement.style.setProperty("--wipe", (progress * 114).toFixed(1) + "%");
    };
    makeScrollScene(statement, render);
  });

  /* Scroll-emerge — a continuous, scroll-scrubbed entrance for anything
     flagged [data-scroll-emerge]: opacity, scale and blur are all a direct
     function of how far the element has crossed a band near the bottom of
     the viewport, computed fresh every frame. Unlike .nv-reveal (a one-shot
     fade that plays once and is done), this reverses exactly if the visitor
     scrolls back up — the element is always wherever its own scroll math
     says it should be. Used for products and the About principles, where
     the brief calls for "scroll controls the composition" rather than a
     fade transported in from a generic component library. */
  document.querySelectorAll<HTMLElement>("[data-scroll-emerge]").forEach(function (el) {
    if (reduceMotion) return;
    const render = function () {
      const rect = el.getBoundingClientRect();
      const progress = clamp01((vh * 0.92 - rect.top) / (vh * 0.52));
      el.style.opacity = progress.toFixed(3);
      el.style.filter = "blur(" + ((1 - progress) * 8).toFixed(2) + "px)";
      el.style.transform =
        "scale(" + (0.94 + progress * 0.06).toFixed(4) + ") translateY(" + ((1 - progress) * 24).toFixed(2) + "px)";
    };
    makeScrollScene(el, render);
  });

  /* Forming echo — the oversized mark drifts through a slow rotate and
     scale as its section crosses the viewport. Generalized to every
     [data-forming-scene] on the page, currently just the footer. */
  document.querySelectorAll<HTMLElement>("[data-forming-scene]").forEach(function (section) {
    const echo = section.querySelector<HTMLElement>("[data-forming-echo]");
    if (!echo) return;
    const render = function () {
      const rect = section.getBoundingClientRect();
      const progress = clamp01((vh * 0.85 - rect.top) / (vh * 0.75));
      const rotate = (progress - 0.5) * 6;
      const scale = 0.95 + progress * 0.07;
      echo.style.transform =
        "translate(-50%, -46%) rotate(" + rotate.toFixed(2) + "deg) scale(" + scale.toFixed(3) + ")";
    };
    makeScrollScene(section, render);
  });

  /* Studio manifesto — the pinned scroll sequence. .nv-manifesto is a tall
     track (stages × 100vh); .nv-manifesto__stage pins via position:sticky
     while scroll progress across the whole track is mapped onto n-1 evenly
     spaced "in-focus" points, one per stage. Each stage's opacity/blur/
     scale/position is a direct function of its own distance from that
     point — so at any moment either exactly one stage is in sharp focus or
     two are mid-crossfade, and scrolling up runs the sequence in reverse.
     The dot rail mirrors the same "which stage is active" state. */
  (function manifestoScene() {
    const scene = document.querySelector<HTMLElement>("[data-manifesto-scene]");
    const stack = document.querySelector<HTMLElement>("[data-manifesto-stack]");
    const dotsWrap = document.querySelector<HTMLElement>("[data-manifesto-dots]");
    if (!scene || !stack) return;

    const items = Array.from(stack.children) as HTMLElement[];
    const dots = dotsWrap ? (Array.from(dotsWrap.children) as HTMLElement[]) : [];
    const n = items.length;
    if (!n) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.style.opacity = "1"; });
      return;
    }

    const span = Math.max(n - 1, 1);

    const render = function () {
      const rect = scene.getBoundingClientRect();
      const total = rect.height - vh;
      const progress = total > 0 ? clamp01(-rect.top / total) : 0;
      const pos = progress * span;

      let activeIdx = 0;
      let activeVis = -1;

      items.forEach(function (item, i) {
        const distance = pos - i;
        const vis = clamp01(1 - Math.abs(distance) / 0.62);
        const blur = (1 - vis) * 10;
        const scale = 0.92 + vis * 0.08;
        const translate = distance * 55;

        item.style.opacity = vis.toFixed(3);
        item.style.filter = "blur(" + blur.toFixed(2) + "px)";
        item.style.transform = "translateY(" + translate.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";

        if (vis > activeVis) {
          activeVis = vis;
          activeIdx = i;
        }
      });

      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === activeIdx);
      });
    };

    makeScrollScene(scene, render);
  })();

  /* Product / process rows — a subtle staggered rise as a list scrolls
     into view, distinct from .nv-reveal only in that siblings in view at
     once step in with a slight cascade rather than firing identically. */
  document.querySelectorAll<HTMLElement>("[data-stagger-list]").forEach(function (list) {
    const items = Array.from(list.children) as HTMLElement[];
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const idx = items.indexOf(entry.target as HTMLElement);
            (entry.target as HTMLElement).style.transitionDelay = Math.min(idx, 4) * 90 + "ms";
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    items.forEach(function (el) {
      el.classList.add("nv-reveal");
      observer.observe(el);
    });
  });
})();
