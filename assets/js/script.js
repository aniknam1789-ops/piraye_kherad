(() => {
  "use strict";

  /* ═══════════ DOM ═══════════ */
  const stage = document.getElementById("stage");
  const slides = [...document.querySelectorAll(".slide")];
  const drawer = document.getElementById("drawer");
  const drawerItems = document.getElementById("drawerItems");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const menuButton = document.getElementById("menu");
  const closeDrawerButton = document.getElementById("closeDrawer");
  const cursor = document.getElementById("cursor");
  const loader = document.getElementById("loader");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const restartBtn = document.getElementById("restartBtn");
  const navCurrent = document.getElementById("navCurrent");
  const navFill = document.getElementById("navFill");

  /* ═══════════ STATE ═══════════ */
  let currentIndex = 0;
  let isTransitioning = false;
  let previousFocusedElement = null;
  let transitionTimer = null;
  let cursorEnabled = false;

  const TRANSITION_TIME = 950;

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

  /* ═══════════ LOADER ═══════════ */
  function runLoader() {
    return new Promise((resolve) => {
      if (!loader) { resolve(); return; }

      const startTime = Date.now();
      const MIN_DURATION = 5200;
      const MAX_DURATION = 6500;
      let finished = false;
      let fallbackTimer = null;

      function finish() {
        if (finished) return;
        finished = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);

        loader.classList.add("is-exit");

        setTimeout(() => {
          loader.classList.add("is-hidden");
          setTimeout(() => {
            loader.style.display = "none";
            resolve();
          }, 1000);
        }, 1400);
      }

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

      fallbackTimer = setTimeout(finish, MAX_DURATION);
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

  /* ═══════════ NAV UI ═══════════ */
  function updateNavUI() {
    const current = formatNumber(currentIndex + 1);
    if (navCurrent) navCurrent.textContent = current;

    if (navFill) {
      const progress = ((currentIndex + 1) / slides.length) * 100;
      navFill.style.width = `${progress}%`;
    }

    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === slides.length - 1;
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

    updateNavUI();
    updateDrawerItems();
    updateSlideAccessibility();

    const activeSlide = slides[currentIndex];
    if (activeSlide) {
      activeSlide.scrollTop = 0;
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

  /* ═══════════ BUTTON BINDINGS ═══════════ */
  prevBtn?.addEventListener("click", previousSlide);
  nextBtn?.addEventListener("click", nextSlide);
  restartBtn?.addEventListener("click", firstSlide);

  document.querySelectorAll("[data-next]").forEach(btn => {
    btn.addEventListener("click", e => { e.preventDefault(); nextSlide(); });
  });

  /* ═══════════ KEYBOARD ═══════════ */
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (isTypingTarget(event.target)) return;

    const drawerOpen = drawer?.classList.contains("is-open");

    if (key === "escape" && drawerOpen) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (drawerOpen) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      nextSlide();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      previousSlide();
      return;
    }
    if (key === "home") { event.preventDefault(); firstSlide(); return; }
    if (key === "end") { event.preventDefault(); goTo(slides.length - 1); return; }
    if (key === "m") {
      event.preventDefault();
      if (drawerOpen) closeDrawer();
      else openDrawer();
    }
  });

  /* ═══════════════════════════════════════════════════════
     TOUCH — فقط سوایپ افقی، عمودی کاملاً حذف شد
     ═══════════════════════════════════════════════════════ */
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchMoved = false;
  let touchStartTarget = null;

  window.addEventListener("touchstart", (event) => {
    if (!event.touches.length) return;
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    touchMoved = false;
    touchStartTarget = event.target;
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    if (!event.touches.length) return;
    const t = event.touches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    if (dx > 15 || dy > 15) touchMoved = true;
  }, { passive: true });

  window.addEventListener("touchend", (event) => {
    if (!event.changedTouches.length) return;
    if (drawer?.classList.contains("is-open")) return;
    if (isTransitioning) return;
    if (!touchMoved) return;

    if (touchStartTarget && touchStartTarget.closest(
      "button, a, input, textarea, select, [contenteditable='true'], .drawer, .drawer-item, .nav-controls, .nav-btn, .menu-btn, .cta, .nav"
    )) return;

    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    if (elapsed > 800) return;

    /* ─────────────────────────────────────────────
       فقط سوایپ افقی
       شرط: حرکت افقی باید حداقل ۱.۵ برابر عمودی باشد
       و از ۹۰ پیکسل بیشتر باشد
       ───────────────────────────────────────────── */
    const isHorizontal =
      Math.abs(dx) > Math.abs(dy) * 1.5 &&
      Math.abs(dx) > 90;

    if (isHorizontal) {
      if (dx < 0) nextSlide();
      else previousSlide();
    }

    /* سوایپ عمودی کاملاً غیرفعال است */
  }, { passive: true });

  /* ═══════════ DRAWER EVENTS ═══════════ */
  menuButton?.addEventListener("click", () => {
    if (drawer?.classList.contains("is-open")) closeDrawer();
    else openDrawer();
  });

  closeDrawerButton?.addEventListener("click", () => closeDrawer());
  drawerBackdrop?.addEventListener("click", () => closeDrawer());

  /* ═══════════ CURSOR ═══════════ */
  function initCursor() {
    if (!cursor) return;
    const fine = window.matchMedia("(pointer: fine)");
    if (!fine.matches) { cursor.style.display = "none"; return; }
    cursorEnabled = true;
    document.body.classList.add("custom-cursor");

    window.addEventListener("mousemove", (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
      cursor.classList.add("is-visible");
    }, { passive: true });

    window.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
    window.addEventListener("mouseenter", () => cursor.classList.add("is-visible"));

    document.addEventListener("mouseover", (e) => {
      if (e.target.closest("button, a, .drawer-item, .media, .tile, .nav-btn")) {
        cursor.classList.add("is-hover");
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest("button, a, .drawer-item, .media, .tile, .nav-btn")) {
        cursor.classList.remove("is-hover");
      }
    });
  }

  /* ═══════════ VISIBILITY ═══════════ */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      isTransitioning = false;
      window.clearTimeout(transitionTimer);
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

  /* ═══════════ INIT ═══════════ */
  async function init() {
    if (!slides.length) {
      console.warn("Pirayeh Kherad: no slides found.");
      return;
    }

    if (stage) stage.setAttribute("tabindex", "-1");
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === 0));
    currentIndex = 0;

    createDrawerItems();
    updateNavUI();
    updateSlideAccessibility();
    updateMenuAccessibility();

    initCursor();

    await runLoader();

    document.body.classList.add("app-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
