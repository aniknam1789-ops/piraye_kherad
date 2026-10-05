(() => {
  "use strict";

  /* ═══════════ DOM ═══════════ */
  const stage = document.getElementById("stage");
  const slides = [...document.querySelectorAll(".slide")];
  const dots = document.getElementById("dots");
  const counter = document.getElementById("counter");
  const currentCounter = counter?.querySelector(".current");
  const totalCounter = counter?.querySelector(".total");
  const drawer = document.getElementById("drawer");
  const drawerItems = document.getElementById("drawerItems");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const menuButton = document.getElementById("menu");
  const closeDrawerButton = document.getElementById("closeDrawer");
  const restartButton = document.getElementById("restart");
  const cursor = document.getElementById("cursor");
  const loader = document.getElementById("loader");
  const loaderBar = document.getElementById("loaderBar");
  const loaderPercent = document.getElementById("loaderPercent");

  /* ═══════════ STATE ═══════════ */
  let currentIndex = 0;
  let isTransitioning = false;
  let wheelLocked = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchMoved = false;
  let touchStartTarget = null;
  let previousFocusedElement = null;
  let transitionTimer = null;
  let wheelTimer = null;
  let cursorEnabled = false;

  const TRANSITION_TIME = 900;
  const WHEEL_LOCK_TIME = 950;
  const SWIPE_THRESHOLD = 70;
  const SWIPE_MAX_TIME = 900;

  /* ═══════════ UTILS ═══════════ */
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const toPersianNumber = (v) => String(v).replace(/\d/g, d => persianDigits[d]);
  const formatNumber = (v, d = 2) => toPersianNumber(String(v).padStart(d, "0"));

  function isTypingTarget(target) {
    if (!target) return false;
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    );
  }

  function isInteractiveTarget(target) {
    if (!target) return false;
    return Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true']"));
  }

  /* ═══════════ LOADER ═══════════ */
  function runLoader() {
    return new Promise((resolve) => {
      if (!loader) { resolve(); return; }

      let current = 0;
      let finished = false;
      const startTime = Date.now();
      const MIN_DURATION = 1800;
      const MAX_DURATION = 5500;

      function update(p) {
        const v = Math.max(0, Math.min(100, Math.round(p)));
        current = v;
        if (loaderBar) loaderBar.style.width = v + "%";
        if (loaderPercent) loaderPercent.textContent = toPersianNumber(v) + "٪";
      }

      function finish() {
        if (finished) return;
        finished = true;
        update(100);

        setTimeout(() => {
          loader.classList.add("is-exit");

          setTimeout(() => {
            loader.classList.add("is-hidden");

            setTimeout(() => {
              loader.style.display = "none";
              resolve();
            }, 1250);
          }, 550);
        }, 350);
      }

      // نوار پیشرفت نرم با easing
      function tick() {
        if (finished) return;
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / 2400, 1);
        const target = 92 * (1 - Math.pow(1 - t, 3));
        if (target > current) update(target);

        if (elapsed < MAX_DURATION - 500) {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);

      // وقتی صفحه کامل لود شد، پایان بده
      function pageReady() {
        const elapsed = Date.now() - startTime;
        const wait = Math.max(0, MIN_DURATION - elapsed);
        setTimeout(finish, wait);
      }

      if (document.readyState === "complete") {
        pageReady();
      } else {
        window.addEventListener("load", pageReady, { once: true });
      }

      // همیشه پایان - حتی اگر load event نیومد
      setTimeout(finish, MAX_DURATION);
    });
  }

  /* ═══════════ A11Y ═══════════ */
  function updateSlideAccessibility() {
    slides.forEach((slide, i) => {
      const active = i === currentIndex;
      slide.setAttribute("aria-hidden", String(!active));
      if (active) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
  }

  function updateMenuAccessibility() {
    const isOpen = drawer?.classList.contains("is-open") ?? false;
    menuButton?.setAttribute("aria-expanded", String(isOpen));
    drawer?.setAttribute("aria-hidden", String(!isOpen));
    drawerBackdrop?.setAttribute("aria-hidden", String(!isOpen));
  }

  /* ═══════════ COUNTER ═══════════ */
  function updateCounter() {
    if (!counter) return;
    const c = formatNumber(currentIndex + 1);
    const t = formatNumber(slides.length);
    const cur = counter.querySelector(".counter-current") || counter.querySelector(".current");
    const tot = counter.querySelector(".counter-total") || counter.querySelector(".total");
    if (cur && tot) {
      cur.textContent = c;
      tot.textContent = t;
    } else {
      counter.textContent = `${c} / ${t}`;
    }
  }

  /* ═══════════ DOTS ═══════════ */
  function createDots() {
    if (!dots) return;
    dots.innerHTML = "";
    slides.forEach((slide, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot";
      if (i === currentIndex) dot.classList.add("is-active");
      const title = slide.dataset.title || `صفحه ${i + 1}`;
      dot.setAttribute("aria-label", `رفتن به ${title}`);
      dot.setAttribute("aria-current", i === currentIndex ? "true" : "false");
      dot.addEventListener("click", () => goTo(i, { focus: false }));
      dots.appendChild(dot);
    });
  }

  function updateDots() {
    if (!dots) return;
    [...dots.querySelectorAll(".dot")].forEach((dot, i) => {
      const active = i === currentIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  /* ═══════════ DRAWER ═══════════ */
  function createDrawerItems() {
    if (!drawerItems) return;
    drawerItems.innerHTML = "";
    slides.forEach((slide, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "drawer-item";
      if (i === currentIndex) item.classList.add("is-active");
      const number = formatNumber(i + 1);
      const title = slide.dataset.title || `صفحه ${i + 1}`;
      item.innerHTML = `
        <span class="drawer-item-number">${number}</span>
        <span class="drawer-item-title">${title}</span>
        <span class="drawer-item-arrow">←</span>
      `;
      item.setAttribute("aria-label", `رفتن به ${title}`);
      item.addEventListener("click", () => {
        goTo(i, { focus: false });
        closeDrawer();
      });
      drawerItems.appendChild(item);
    });
  }

  function updateDrawerItems() {
    if (!drawerItems) return;
    [...drawerItems.querySelectorAll(".drawer-item")].forEach((item, i) => {
      item.classList.toggle("is-active", i === currentIndex);
    });
  }

  function openDrawer() {
    if (!drawer || drawer.classList.contains("is-open")) return;
    previousFocusedElement = document.activeElement;
    drawer.classList.add("is-open");
    drawerBackdrop?.classList.add("is-open");
    document.body.classList.add("drawer-open");
    updateMenuAccessibility();
    requestAnimationFrame(() => closeDrawerButton?.focus());
  }

  function closeDrawer(restoreFocus = true) {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawerBackdrop?.classList.remove("is-open");
    document.body.classList.remove("drawer-open");
    updateMenuAccessibility();
    if (restoreFocus) {
      requestAnimationFrame(() => {
        if (previousFocusedElement && typeof previousFocusedElement.focus === "function") {
          try { previousFocusedElement.focus({ preventScroll: true }); }
          catch { previousFocusedElement.focus(); }
        } else {
          menuButton?.focus();
        }
      });
    }
  }

  /* ═══════════ NAVIGATION ═══════════ */
  function normalizeIndex(i) {
    return Math.max(0, Math.min(slides.length - 1, i));
  }

  function goTo(index, options = {}) {
    if (!slides.length) return;
    const { force = false, focus = false } = options;
    const target = normalizeIndex(index);
    if (!force && (isTransitioning || target === currentIndex)) return;

    const previous = currentIndex;
    currentIndex = target;
    isTransitioning = true;
    window.clearTimeout(transitionTimer);

    const dir = target > previous ? "forward" : "backward";
    stage?.setAttribute("data-direction", dir);

    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === currentIndex);
    });

    updateCounter();
    updateDots();
    updateDrawerItems();
    updateSlideAccessibility();

    const activeSlide = slides[currentIndex];
    if (activeSlide) {
      activeSlide.classList.remove("just-entered");
      void activeSlide.offsetWidth;
      activeSlide.classList.add("just-entered");
      setTimeout(() => activeSlide?.classList.remove("just-entered"), TRANSITION_TIME);
    }

    if (focus) {
      try { stage?.focus({ preventScroll: true }); }
      catch { stage?.focus(); }
    }

    transitionTimer = setTimeout(() => {
      isTransitioning = false;
    }, TRANSITION_TIME);
  }

  const nextSlide = () => {
    if (isTransitioning || currentIndex >= slides.length - 1) return;
    goTo(currentIndex + 1);
  };

  const previousSlide = () => {
    if (isTransitioning || currentIndex <= 0) return;
    goTo(currentIndex - 1);
  };

  const firstSlide = () => goTo(0, { force: true });
  const lastSlide = () => goTo(slides.length - 1);

  /* ═══════════ BUTTONS ═══════════ */
  document.querySelectorAll("[data-next]").forEach(btn => {
    btn.addEventListener("click", e => { e.preventDefault(); nextSlide(); });
  });

  restartButton?.addEventListener("click", e => { e.preventDefault(); firstSlide(); });

  /* ═══════════ KEYBOARD ═══════════ */
  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (isTypingTarget(event.target)) return;

    const drawerOpen = drawer?.classList.contains("is-open");

    if (key === "escape" && drawerOpen) {
      event.preventDefault(); closeDrawer(); return;
    }

    const interactive = isInteractiveTarget(event.target);

    if ((event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") && !drawerOpen) {
      event.preventDefault(); nextSlide(); return;
    }
    if (event.key === " " && !interactive && !drawerOpen) {
      event.preventDefault(); nextSlide(); return;
    }
    if (event.key === "Enter" && !interactive && !drawerOpen) {
      event.preventDefault(); nextSlide(); return;
    }
    if ((event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") && !drawerOpen) {
      event.preventDefault(); previousSlide(); return;
    }
    if (key === "home") { event.preventDefault(); firstSlide(); return; }
    if (key === "end") { event.preventDefault(); lastSlide(); return; }
    if (key === "f" && !interactive) { event.preventDefault(); toggleFullscreen(); return; }
    if (key === "m" && !interactive) {
      event.preventDefault();
      if (drawerOpen) closeDrawer();
      else openDrawer();
    }
  });

  /* ═══════════ WHEEL ═══════════ */
  function handleWheel(event) {
    if (drawer?.classList.contains("is-open")) return;
    if (wheelLocked || isTransitioning) return;
    const delta = event.deltaY;
    if (Math.abs(delta) < 20) return;
    wheelLocked = true;
    if (delta > 0) nextSlide();
    else previousSlide();
    window.clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelLocked = false; }, WHEEL_LOCK_TIME);
  }
  window.addEventListener("wheel", handleWheel, { passive: true });

  /* ═══════════ TOUCH ═══════════ */
  window.addEventListener("touchstart", event => {
    if (!event.touches.length) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    touchMoved = false;
    touchStartTarget = event.target;
  }, { passive: true });

  window.addEventListener("touchmove", event => {
    if (!event.touches.length) return;
    const t = event.touches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    if (dx > 10 || dy > 10) touchMoved = true;
  }, { passive: true });

  window.addEventListener("touchend", event => {
    if (!event.changedTouches.length) return;
    if (drawer?.classList.contains("is-open")) return;
    if (isTransitioning) return;
    if (!touchMoved) return;

    if (touchStartTarget && touchStartTarget.closest(
      "button, a, input, textarea, select, [contenteditable='true'], .drawer, .drawer-item, .cta, .menu-btn, .dot"
    )) return;

    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    if (elapsed > SWIPE_MAX_TIME) return;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) nextSlide();
      else previousSlide();
      return;
    }
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
      if (dy < 0) nextSlide();
      else previousSlide();
    }
  }, { passive: true });

  /* ═══════════ DRAWER EVENTS ═══════════ */
  menuButton?.addEventListener("click", () => {
    if (drawer?.classList.contains("is-open")) closeDrawer();
    else openDrawer();
  });

  closeDrawerButton?.addEventListener("click", () => closeDrawer());
  drawerBackdrop?.addEventListener("click", () => closeDrawer());

  document.addEventListener("click", event => {
    if (!drawer?.classList.contains("is-open")) return;
    if (drawer.contains(event.target) ||
        menuButton?.contains(event.target) ||
        drawerBackdrop?.contains(event.target)) return;
    closeDrawer();
  });

  /* ═══════════ FULLSCREEN ═══════════ */
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (e) {
      console.warn("Fullscreen unavailable:", e);
    }
  }

  /* ═══════════ CURSOR ═══════════ */
  function initCursor() {
    if (!cursor) return;
    const fine = window.matchMedia("(pointer: fine)");
    if (!fine.matches) { cursor.style.display = "none"; return; }
    cursorEnabled = true;
    document.body.classList.add("custom-cursor");

    window.addEventListener("mousemove", e => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
      cursor.classList.add("is-visible");
    }, { passive: true });

    window.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
    window.addEventListener("mouseenter", () => cursor.classList.add("is-visible"));

    document.addEventListener("mouseover", e => {
      if (e.target.closest("button, a, .drawer-item, .media, .cta, .tile")) {
        cursor.classList.add("is-hover");
      }
    });
    document.addEventListener("mouseout", e => {
      if (e.target.closest("button, a, .drawer-item, .media, .cta, .tile")) {
        cursor.classList.remove("is-hover");
      }
    });
  }

  /* ═══════════ VISIBILITY ═══════════ */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      isTransitioning = false;
      wheelLocked = false;
      window.clearTimeout(transitionTimer);
      window.clearTimeout(wheelTimer);
    }
  });

  /* ═══════════ RESIZE ═══════════ */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (cursorEnabled && !window.matchMedia("(pointer: fine)").matches) {
        cursor.style.display = "none";
      } else if (cursorEnabled) {
        cursor.style.display = "";
      }
    }, 150);
  }, { passive: true });

  /* ═══════════ REDUCED MOTION ═══════════ */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function handleReducedMotion() {
    document.body.classList.toggle("reduce-motion", reducedMotion.matches);
  }
  reducedMotion.addEventListener?.("change", handleReducedMotion);

  /* ═══════════ INIT ═══════════ */
  async function init() {
    if (!slides.length) {
      console.warn("Pirayeh Kherad: no slides found.");
      return;
    }

    if (stage) stage.setAttribute("tabindex", "-1");
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === 0));
    currentIndex = 0;

    createDots();
    createDrawerItems();
    updateCounter();
    updateSlideAccessibility();
    updateMenuAccessibility();

    initCursor();
    handleReducedMotion();

    await runLoader();

    document.body.classList.add("app-ready");

    requestAnimationFrame(() => {
      slides[0]?.classList.add("just-entered");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();