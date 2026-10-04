(() => {
  "use strict";

  /* DOM */
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

  /* STATE */
  let currentIndex = 0;
  let isTransitioning = false;
  let wheelLocked = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let previousFocusedElement = null;
  let transitionTimer = null;
  let wheelTimer = null;
  let cursorEnabled = false;

  /* CONSTANTS */
  const TRANSITION_TIME = 760;
  const WHEEL_LOCK_TIME = 900;
  const SWIPE_THRESHOLD = 45;
  const SWIPE_MAX_TIME = 850;

  /* UTILS */
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

  function toPersianNumber(value) {
    return String(value).replace(/\d/g, d => persianDigits[d]);
  }

  function formatNumber(value, digits = 2) {
    return toPersianNumber(String(value).padStart(digits, "0"));
  }

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

  /* ACCESSIBILITY */
  function updateSlideAccessibility() {
    slides.forEach((slide, index) => {
      const active = index === currentIndex;
      slide.setAttribute("aria-hidden", String(!active));
      if (active) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
  }

  function updateMenuAccessibility() {
    const isOpen = drawer?.classList.contains("open") ?? false;
    menuButton?.setAttribute("aria-expanded", String(isOpen));
    drawer?.setAttribute("aria-hidden", String(!isOpen));
    drawerBackdrop?.setAttribute("aria-hidden", String(!isOpen));
  }

  /* COUNTER */
  function updateCounter() {
    if (!counter) return;
    const current = formatNumber(currentIndex + 1);
    const total = formatNumber(slides.length);
    if (currentCounter && totalCounter) {
      currentCounter.textContent = current;
      totalCounter.textContent = total;
      return;
    }
    counter.textContent = `${current} / ${total}`;
  }

  /* DOTS */
  function createDots() {
    if (!dots) return;
    dots.innerHTML = "";
    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot";
      if (index === currentIndex) dot.classList.add("active");
      const title = slide.dataset.title || `صفحه ${index + 1}`;
      dot.setAttribute("aria-label", `رفتن به ${title}`);
      dot.setAttribute("aria-current", index === currentIndex ? "true" : "false");
      dot.addEventListener("click", () => goTo(index, { focus: false }));
      dots.appendChild(dot);
    });
  }

  function updateDots() {
    if (!dots) return;
    const dotElements = [...dots.querySelectorAll(".dot")];
    dotElements.forEach((dot, index) => {
      const active = index === currentIndex;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  /* DRAWER */
  function createDrawerItems() {
    if (!drawerItems) return;
    drawerItems.innerHTML = "";
    slides.forEach((slide, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "drawer-item";
      if (index === currentIndex) item.classList.add("active");
      const number = formatNumber(index + 1);
      const title = slide.dataset.title || `صفحه ${index + 1}`;
      item.innerHTML = `
        <span class="drawer-item-number">${number}</span>
        <span class="drawer-item-title">${title}</span>
        <span class="drawer-item-arrow">←</span>
      `;
      item.setAttribute("aria-label", `رفتن به ${title}`);
      item.addEventListener("click", () => {
        goTo(index, { focus: false });
        closeDrawer();
      });
      drawerItems.appendChild(item);
    });
  }

  function updateDrawerItems() {
    if (!drawerItems) return;
    const items = [...drawerItems.querySelectorAll(".drawer-item")];
    items.forEach((item, index) => {
      item.classList.toggle("active", index === currentIndex);
    });
  }

  function openDrawer() {
    if (!drawer) return;
    if (drawer.classList.contains("open")) return;
    previousFocusedElement = document.activeElement;
    drawer.classList.add("open");
    drawerBackdrop?.classList.add("open");
    document.body.classList.add("drawer-open");
    updateMenuAccessibility();
    requestAnimationFrame(() => closeDrawerButton?.focus());
  }

  function closeDrawer(restoreFocus = true) {
    if (!drawer) return;
    if (!drawer.classList.contains("open")) return;
    drawer.classList.remove("open");
    drawerBackdrop?.classList.remove("open");
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

  /* NAVIGATION */
  function normalizeIndex(index) {
    return Math.max(0, Math.min(slides.length - 1, index));
  }

  function goTo(index, options = {}) {
    if (!slides.length) return;
    const { force = false, focus = false } = options;
    const targetIndex = normalizeIndex(index);
    if (!force && (isTransitioning || targetIndex === currentIndex)) return;

    const previousIndex = currentIndex;
    currentIndex = targetIndex;
    isTransitioning = true;
    window.clearTimeout(transitionTimer);

    const direction = targetIndex > previousIndex ? "forward" : "backward";
    stage?.setAttribute("data-direction", direction);

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentIndex);
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
      window.setTimeout(() => {
        activeSlide?.classList.remove("just-entered");
      }, TRANSITION_TIME);
    }

    if (focus) {
      try { stage?.focus({ preventScroll: true }); }
      catch { stage?.focus(); }
    }

    transitionTimer = window.setTimeout(() => {
      isTransitioning = false;
    }, TRANSITION_TIME);
  }

  function nextSlide() {
    if (isTransitioning || currentIndex >= slides.length - 1) return;
    goTo(currentIndex + 1);
  }

  function previousSlide() {
    if (isTransitioning || currentIndex <= 0) return;
    goTo(currentIndex - 1);
  }

  function firstSlide() { goTo(0, { force: true }); }
  function lastSlide() { goTo(slides.length - 1); }

  /* BUTTONS */
  document.querySelectorAll("[data-next]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      nextSlide();
    });
  });

  restartButton?.addEventListener("click", event => {
    event.preventDefault();
    firstSlide();
  });

  /* KEYBOARD */
  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (isTypingTarget(event.target)) return;

    if (key === "escape" && drawer?.classList.contains("open")) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    const interactive = isInteractiveTarget(event.target);
    const drawerOpen = drawer?.classList.contains("open");

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
      if (drawer?.classList.contains("open")) closeDrawer();
      else openDrawer();
    }
  });

  /* WHEEL */
  function handleWheel(event) {
    if (drawer?.classList.contains("open")) return;
    if (wheelLocked || isTransitioning) return;
    const delta = event.deltaY;
    if (Math.abs(delta) < 18) return;
    wheelLocked = true;
    if (delta > 0) nextSlide();
    else previousSlide();
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { wheelLocked = false; }, WHEEL_LOCK_TIME);
  }
  window.addEventListener("wheel", handleWheel, { passive: true });

  /* TOUCH */
  window.addEventListener("touchstart", event => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  window.addEventListener("touchend", event => {
    if (!event.changedTouches.length) return;
    if (drawer?.classList.contains("open")) return;
    if (isTransitioning) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    if (elapsed > SWIPE_MAX_TIME) return;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) nextSlide();
      else previousSlide();
      return;
    }
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > SWIPE_THRESHOLD) {
      if (deltaY < 0) nextSlide();
      else previousSlide();
    }
  }, { passive: true });

  /* DRAWER EVENTS */
  menuButton?.addEventListener("click", () => {
    if (drawer?.classList.contains("open")) closeDrawer();
    else openDrawer();
  });

  closeDrawerButton?.addEventListener("click", () => closeDrawer());
  drawerBackdrop?.addEventListener("click", () => closeDrawer());

  document.addEventListener("click", event => {
    if (!drawer?.classList.contains("open")) return;
    if (drawer.contains(event.target) || menuButton?.contains(event.target) || drawerBackdrop?.contains(event.target)) return;
    closeDrawer();
  });

  /* FULLSCREEN */
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      console.warn("Fullscreen unavailable:", error);
    }
  }

  /* CURSOR */
  function initCursor() {
    if (!cursor) return;
    const finePointer = window.matchMedia("(pointer: fine)");
    if (!finePointer.matches) {
      cursor.style.display = "none";
      return;
    }
    cursorEnabled = true;
    document.body.classList.add("custom-cursor");

    window.addEventListener("mousemove", event => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.classList.add("visible");
    }, { passive: true });

    window.addEventListener("mouseleave", () => cursor.classList.remove("visible"));
    window.addEventListener("mouseenter", () => cursor.classList.add("visible"));

    document.addEventListener("mouseover", event => {
      if (event.target.closest("button, a, .drawer-item, .art, .start")) cursor.classList.add("hover");
    });
    document.addEventListener("mouseout", event => {
      if (event.target.closest("button, a, .drawer-item, .art, .start")) cursor.classList.remove("hover");
    });
  }

  /* PARALLAX */
  function initParallax() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let raf = null;
    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener("mousemove", event => {
      mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const activeSlide = slides[currentIndex];
        if (activeSlide) {
          const art = activeSlide.querySelector(".hero-art, .art, .end-orbit");
          if (art) {
            const amount = activeSlide.classList.contains("hero") ? 7 : 4;
            art.style.transform = `translate3d(${mouseX * amount}px, ${mouseY * amount}px, 0)`;
          }
        }
        raf = null;
      });
    }, { passive: true });
  }

  /* VISIBILITY */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      isTransitioning = false;
      wheelLocked = false;
      window.clearTimeout(transitionTimer);
      window.clearTimeout(wheelTimer);
    }
  });

  /* RESIZE */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (cursorEnabled && !window.matchMedia("(pointer: fine)").matches) cursor.style.display = "none";
      else if (cursorEnabled) cursor.style.display = "";
    }, 150);
  }, { passive: true });

  /* REDUCED MOTION */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function handleReducedMotion() {
    if (reducedMotion.matches) document.body.classList.add("reduce-motion");
    else document.body.classList.remove("reduce-motion");
  }
  reducedMotion.addEventListener?.("change", handleReducedMotion);

  /* INIT */
  function init() {
    if (!slides.length) {
      console.warn("Pirayeh Kherad: no slides found.");
      return;
    }
    if (stage) stage.setAttribute("tabindex", "-1");
    slides.forEach((slide, index) => slide.classList.toggle("active", index === 0));
    currentIndex = 0;
    createDots();
    createDrawerItems();
    updateCounter();
    updateSlideAccessibility();
    updateMenuAccessibility();
    initCursor();
    initParallax();
    handleReducedMotion();
    document.body.classList.add("app-ready");
    requestAnimationFrame(() => slides[0]?.classList.add("just-entered"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();