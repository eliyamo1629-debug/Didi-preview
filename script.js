(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  if (reduce) root.classList.add("reduce-motion");

  function ready() {
    document.body.classList.add("is-ready");
  }

  if (reduce) {
    ready();
  } else if (document.fonts && document.fonts.ready) {
    Promise.race([
      document.fonts.ready,
      new Promise(function (r) { setTimeout(r, 450); })
    ]).then(ready);
  } else {
    setTimeout(ready, 40);
  }

  /* Kinetic titles: split into characters, keep accessible text */
  document.querySelectorAll("[data-split]").forEach(function (el) {
    if (reduce) return;
    var text = el.textContent || "";
    el.setAttribute("aria-label", text);
    el.textContent = "";
    var i = 0;
    Array.from(text).forEach(function (ch) {
      if (ch === " ") {
        var gap = document.createElement("span");
        gap.className = "gap";
        gap.setAttribute("aria-hidden", "true");
        gap.innerHTML = "&nbsp;";
        el.appendChild(gap);
        return;
      }
      var wrap = document.createElement("span");
      wrap.className = "char";
      wrap.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span");
      inner.textContent = ch;
      inner.style.setProperty("--i", String(i));
      wrap.appendChild(inner);
      el.appendChild(wrap);
      i += 1;
    });
  });

  /* Header solidifies after leaving the intro */
  var header = document.querySelector(".site-header");
  var intro = document.querySelector(".intro");
  function headerState() {
    if (!header) return;
    var y = window.scrollY || 0;
    var threshold = intro ? intro.offsetHeight * 0.6 : 80;
    header.classList.toggle("is-on", y > threshold);
  }

  /* Piped cream line follows scroll progress */
  var pipe = document.getElementById("pipe-path");
  function pipeProgress() {
    if (!pipe || reduce) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var p = max > 0 ? (window.scrollY || doc.scrollTop) / max : 0;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    /* 1 = hidden, 0 = fully drawn. Ease a little at the start. */
    root.style.setProperty("--pipe", String(1 - p));
  }

  /* Scroll-driven work: rAF once per frame */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      headerState();
      pipeProgress();
      parallax();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  headerState();
  pipeProgress();

  /* Rise-onto-shelf reveals */
  var revealItems = document.querySelectorAll("[data-reveal]");
  if (reduce) {
    revealItems.forEach(function (el) { el.classList.add("is-in"); });
  } else if ("IntersectionObserver" in window) {
    revealItems.forEach(function (el, n) {
      el.style.setProperty("--reveal-delay", (n % 3) * 80 + "ms");
    });
    function revealIfSeen(el) {
      var r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 0) * 0.92 && r.bottom > 0) {
        el.classList.add("is-in");
        return true;
      }
      return false;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealItems.forEach(function (el) {
      if (!revealIfSeen(el)) io.observe(el);
    });
    window.addEventListener("scroll", function () {
      revealItems.forEach(function (el) {
        if (!el.classList.contains("is-in")) revealIfSeen(el);
      });
    }, { passive: true });
  } else {
    revealItems.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* Gentle parallax on larger screens only */
  var parallaxEls = document.querySelectorAll("[data-parallax]");
  var allowParallax = !reduce && window.matchMedia("(min-width: 800px)").matches;

  function parallax() {
    if (!allowParallax) return;
    var vh = window.innerHeight || 1;
    parallaxEls.forEach(function (el) {
      if (!el.classList.contains("is-in")) return;
      var speed = parseFloat(el.getAttribute("data-parallax") || "0");
      var rect = el.getBoundingClientRect();
      var mid = rect.top + rect.height / 2 - vh / 2;
      var y = mid * speed * -0.35;
      el.style.translate = "0 " + y.toFixed(1) + "px";
    });
  }

  /* Soft 3D tilt — hover devices only, so iPhone scroll stays clean */
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover && !reduce) {
    document.querySelectorAll(".tilt").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          "rotateY(" + (x * 7).toFixed(2) + "deg) rotateX(" + (-y * 7).toFixed(2) + "deg) translateZ(10px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* Horizontal vitrine: native touch scroll + mouse drag with momentum */
  var scroller = document.getElementById("vitrine-scroller");
  if (scroller) {
    var dragging = false;
    var startX = 0;
    var startLeft = 0;
    var lastX = 0;
    var lastT = 0;
    var velocity = 0;
    var coasting = 0;

    function stopCoast() {
      if (coasting) {
        cancelAnimationFrame(coasting);
        coasting = 0;
      }
    }

    scroller.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      dragging = true;
      stopCoast();
      startX = lastX = e.clientX;
      startLeft = scroller.scrollLeft;
      lastT = performance.now();
      velocity = 0;
      try { scroller.setPointerCapture(e.pointerId); } catch (err) {}
    });

    scroller.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var now = performance.now();
      var dx = e.clientX - startX;
      scroller.scrollLeft = startLeft - dx;
      var dt = now - lastT;
      if (dt > 0) velocity = (e.clientX - lastX) / dt;
      lastX = e.clientX;
      lastT = now;
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (reduce) return;
      var v = -velocity * 16;
      var prev = performance.now();
      function coast(now) {
        var dt = now - prev;
        prev = now;
        v *= Math.pow(0.95, dt / 16.6);
        scroller.scrollLeft += v * (dt / 16.6);
        if (Math.abs(v) > 0.35) {
          coasting = requestAnimationFrame(coast);
        } else {
          coasting = 0;
        }
      }
      if (Math.abs(v) > 0.5) coasting = requestAnimationFrame(coast);
    }

    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);

    /* Keyboard */
    scroller.addEventListener("keydown", function (e) {
      var step = Math.round(scroller.clientWidth * 0.7);
      if (e.key === "ArrowLeft") {
        scroller.scrollBy({ left: step, behavior: reduce ? "auto" : "smooth" });
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        scroller.scrollBy({ left: -step, behavior: reduce ? "auto" : "smooth" });
        e.preventDefault();
      }
    });
  }
})();
