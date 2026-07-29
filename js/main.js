/* Fliesenleger Thomas Gerber — main.js */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isDesktop = window.matchMedia("(min-width: 769px)").matches;
  var scrubMode = isDesktop && !reduceMotion;

  /* ---------- Header state ---------- */
  var head = document.querySelector("[data-head]");
  function updateHead() {
    if (head) head.classList.toggle("is-scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", updateHead, { passive: true });
  updateHead();

  /* ---------- Hero: scroll scrub (desktop) / autoplay loop (mobile) ---------- */
  var hero = document.querySelector("[data-hero]");
  var heroVideo = hero ? hero.querySelector(".hero__video") : null;
  var heroContent = hero ? hero.querySelector("[data-hero-content]") : null;
  var heroHint = hero ? hero.querySelector(".hero__hint") : null;

  if (heroVideo) {
    if (scrubMode) {
      document.documentElement.classList.add("js-scrub");
      heroVideo.src = heroVideo.getAttribute("data-src-scrub");
      heroVideo.load();

      var duration = 0;
      var current = 0;
      var target = 0;
      var lastSet = -1;

      heroVideo.addEventListener("loadedmetadata", function () {
        duration = heroVideo.duration || 0;
        heroVideo.pause();
        try { heroVideo.currentTime = 0.001; } catch (e) {}
      });
      heroVideo.addEventListener("canplay", function () {
        heroVideo.classList.add("is-ready");
      });

      function heroProgress() {
        var rect = hero.getBoundingClientRect();
        var scrollable = rect.height - window.innerHeight;
        if (scrollable <= 0) return 0;
        var p = -rect.top / scrollable;
        return Math.min(1, Math.max(0, p));
      }

      function scrubLoop() {
        if (duration > 0) {
          target = heroProgress() * (duration - 0.05);
          current += (target - current) * 0.14;
          if (Math.abs(current - lastSet) > 0.016) {
            try {
              heroVideo.currentTime = current;
              lastSet = current;
            } catch (e) {}
          }
          if (heroContent) {
            var p = heroProgress();
            var fade = Math.min(1, Math.max(0, 1 - p * 2.2));
            heroContent.style.opacity = fade;
            heroContent.style.transform = "translateY(" + (p * -46) + "px)";
            heroContent.style.pointerEvents = fade < 0.1 ? "none" : "";
            if (heroHint) {
              // CSS-Entrance-Animation (fill: forwards) überschreibt Inline-Opacity,
              // daher bei Scrollbeginn deaktivieren.
              if (p > 0.02 && !heroHint.dataset.freed) {
                heroHint.style.animation = "none";
                heroHint.dataset.freed = "1";
              }
              if (heroHint.dataset.freed) {
                heroHint.style.opacity = Math.min(1, Math.max(0, 1 - p * 4));
              }
            }
          }
        }
        requestAnimationFrame(scrubLoop);
      }
      requestAnimationFrame(scrubLoop);
    } else {
      // Mobile / reduced motion: poster + muted loop
      heroVideo.src = heroVideo.getAttribute("data-src-loop");
      heroVideo.loop = true;
      heroVideo.muted = true;
      heroVideo.setAttribute("muted", "");
      heroVideo.load();
      if (!reduceMotion) {
        var playPromise = heroVideo.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});
        heroVideo.addEventListener("playing", function () {
          heroVideo.classList.add("is-ready");
        });
      }
    }
  }

  /* ---------- Background videos: lazy src + play/pause in view ---------- */
  var bgVideos = Array.prototype.slice.call(document.querySelectorAll("[data-bg-video]"));
  if (bgVideos.length) {
    var bgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          if (!v.src) { v.src = v.getAttribute("data-src"); v.load(); }
          if (!reduceMotion) {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          }
        } else if (v.src) {
          v.pause();
        }
      });
    }, { rootMargin: "200px 0px" });
    bgVideos.forEach(function (v) { bgObserver.observe(v); });
  }

  /* ---------- Slow parallax on section media ---------- */
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax] video"));
  if (parallaxEls.length && !reduceMotion && isDesktop) {
    var ticking = false;
    function applyParallax() {
      parallaxEls.forEach(function (media) {
        var section = media.closest(".section--media");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        var center = rect.top + rect.height / 2 - window.innerHeight / 2;
        media.style.transform = "translateY(" + (center * -0.08) + "px)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyParallax);
      }
    }, { passive: true });
    applyParallax();
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  /* ---------- Quiet count-up ---------- */
  var countEls = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  if (countEls.length && !reduceMotion && "IntersectionObserver" in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        countObserver.unobserve(el);
        var end = parseInt(el.getAttribute("data-count"), 10) || 0;
        var t0 = null;
        var dur = 1400;
        function tick(ts) {
          if (!t0) t0 = ts;
          var t = Math.min(1, (ts - t0) / dur);
          var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic, no bounce
          el.textContent = Math.round(end * eased);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    countEls.forEach(function (el) { countObserver.observe(el); });
  }

  /* ---------- Before/After slider ---------- */
  var ba = document.querySelector("[data-ba]");
  if (ba) {
    var baFrame = ba.querySelector(".ba__frame");
    var baRange = ba.querySelector("[data-ba-range]");
    var baBefore = ba.querySelector("[data-ba-before]");
    var baAfter = ba.querySelector("[data-ba-after]");
    var baCaption = ba.querySelector("[data-ba-caption]");
    var baProjects = Array.prototype.slice.call(ba.querySelectorAll("[data-ba-project]"));

    function setPos(v) {
      baFrame.style.setProperty("--pos", v + "%");
    }
    baRange.addEventListener("input", function () {
      setPos(baRange.value);
    });
    // Feiner step für flüssiges Ziehen; Pfeiltasten bekommen eine brauchbare Schrittweite.
    baRange.addEventListener("keydown", function (e) {
      var delta = 0;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -4;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = 4;
      if (delta) {
        e.preventDefault();
        baRange.value = Math.min(100, Math.max(0, parseFloat(baRange.value) + delta));
        setPos(baRange.value);
      }
    });
    setPos(baRange.value);

    baProjects.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.classList.contains("is-active")) return;
        baProjects.forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        baBefore.src = btn.getAttribute("data-before");
        baAfter.src = btn.getAttribute("data-after");
        baCaption.innerHTML = btn.getAttribute("data-caption");
        baRange.value = 50;
        setPos(50);
      });
    });
  }

  /* ---------- Form validation ---------- */
  var form = document.querySelector("[data-form]");
  if (form) {
    var success = document.querySelector("[data-form-success]");

    function fieldWrap(input) { return input.closest(".field"); }
    function setError(input, msg) {
      var wrap = fieldWrap(input);
      if (!wrap) return;
      var err = wrap.querySelector(".field__error");
      wrap.classList.toggle("has-error", !!msg);
      if (err) err.textContent = msg || "";
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }

    function validateName() {
      var el = form.elements.name;
      if (!el.value.trim()) { setError(el, "Bitte geben Sie Ihren Namen an."); return false; }
      setError(el, ""); return true;
    }
    function validatePhone() {
      var el = form.elements.telefon;
      var v = el.value.trim();
      if (!v) { setError(el, "Bitte geben Sie eine Telefonnummer an."); return false; }
      var digits = v.replace(/\D/g, "");
      if (digits.length < 6 || !/^[+0-9 ()\/\-.]+$/.test(v)) {
        setError(el, "Diese Telefonnummer sieht unvollständig aus."); return false;
      }
      setError(el, ""); return true;
    }
    function validateQm() {
      var el = form.elements.qm;
      var v = el.value.trim();
      if (!v) { setError(el, ""); return true; }
      var n = parseFloat(v.replace(",", "."));
      if (isNaN(n) || n <= 0 || n > 1000) {
        setError(el, "Bitte geben Sie eine Fläche zwischen 1 und 1000 qm an."); return false;
      }
      setError(el, ""); return true;
    }

    form.elements.name.addEventListener("blur", validateName);
    form.elements.telefon.addEventListener("blur", validatePhone);
    form.elements.qm.addEventListener("blur", validateQm);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.elements.firma && form.elements.firma.value) return; // honeypot
      var ok = [validateName(), validatePhone(), validateQm()].every(Boolean);
      if (!ok) {
        var firstError = form.querySelector(".field.has-error input");
        if (firstError) firstError.focus();
        return;
      }
      // Kein Backend angebunden — Anfrage wird lokal bestätigt.
      // TODO: hier POST an Formular-Endpunkt (z. B. eigenes Skript / Formspree) ergänzen.
      form.hidden = true;
      var intro = document.querySelector(".anfrage-intro");
      if (intro) intro.hidden = true;
      if (success) {
        success.hidden = false;
        success.focus();
      }
    });
  }

  /* ---------- Click-to-load map (DSGVO) ---------- */
  var map = document.querySelector("[data-map]");
  if (map) {
    var loadBtn = map.querySelector("[data-map-load]");
    loadBtn.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=14.4880%2C51.2155%2C14.5040%2C51.2215&layer=mapnik&marker=51.21843%2C14.49599";
      iframe.title = "Karte: Am Weinberg 5, 02694 Malschwitz-Doberschütz";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer";
      map.appendChild(iframe);
      map.classList.add("is-loaded");
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
