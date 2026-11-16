// Home page photo slider: moves on a timer, swipes on phones, has arrows and dots.
// Swiping uses the browser's own scroll-snap, so it feels native on every phone.
(function () {
  document.querySelectorAll(".slider").forEach(function (root) {
    var track = root.querySelector(".slider-track");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".slide"));
    var dotsBox = root.querySelector(".slider-dots");
    if (!track || slides.length < 2) return;

    var interval = Number(root.getAttribute("data-interval")) || 3000;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var current = 0, timer = null, paused = false, resumeAt = 0;

    slides.forEach(function (s, i) {
      s.setAttribute("aria-roledescription", "slide");
      s.setAttribute("aria-label", (i + 1) + " of " + slides.length);
    });

    // Only the first photo loads with the page; the rest wait until the page has finished loading,
    // so they never slow down the first view. Tapping or swiping early loads them straight away.
    var loaded = false;
    function loadRest() {
      if (loaded) return;
      loaded = true;
      root.querySelectorAll("img[data-src]").forEach(function (img) {
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.src = img.dataset.src;
        img.removeAttribute("data-src"); img.removeAttribute("data-srcset");
      });
    }
    if (document.readyState === "complete") setTimeout(loadRest, 300);
    else window.addEventListener("load", function () { setTimeout(loadRest, 300); });
    root.addEventListener("pointerdown", loadRest, { once: true });
    root.addEventListener("touchstart", loadRest, { once: true, passive: true });

    var dots = slides.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slider-dot";
      b.setAttribute("aria-label", "Photo " + (i + 1) + " of " + slides.length);
      b.addEventListener("click", function () { go(i); holdOff(); });
      dotsBox.appendChild(b);
      return b;
    });

    function mark(i) {
      current = i;
      dots.forEach(function (d, j) { d.setAttribute("aria-current", j === i ? "true" : "false"); });
    }
    function go(i) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
      mark(i);
    }
    // After someone swipes or taps, wait a little longer before moving on by itself.
    function holdOff() { resumeAt = Date.now() + interval * 2; }

    function tick() {
      if (paused || document.hidden || Date.now() < resumeAt) return;
      go(current + 1);
    }

    // Keep the dots right when someone swipes.
    var scrollEnd;
    track.addEventListener("scroll", function () {
      clearTimeout(scrollEnd);
      scrollEnd = setTimeout(function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== current) mark(Math.max(0, Math.min(slides.length - 1, i)));
      }, 80);
    }, { passive: true });
    track.addEventListener("touchstart", holdOff, { passive: true });
    track.addEventListener("pointerdown", holdOff);

    root.querySelector(".prev").addEventListener("click", function () { go(current - 1); holdOff(); });
    root.querySelector(".next").addEventListener("click", function () { go(current + 1); holdOff(); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); holdOff(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); holdOff(); }
    });

    // Pause while the mouse is over it or a control has keyboard focus.
    root.addEventListener("mouseenter", function () { paused = true; });
    root.addEventListener("mouseleave", function () { paused = false; });
    root.addEventListener("focusin", function () { paused = true; });
    root.addEventListener("focusout", function () { paused = false; });

    mark(0);
    if (!reduceMotion) timer = setInterval(tick, interval);
  });
})();
