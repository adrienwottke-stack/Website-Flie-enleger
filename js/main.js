/* Fliesenlegerfachbetrieb Thomas Gerber — main.js */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 48.0625rem = CSS-Mobile-Breakpoint (48rem) + 1px, in rem, damit JS und CSS
  // auch bei vergrößerter Root-Schriftgröße denselben Modus wählen.
  var mqDesktop = window.matchMedia("(min-width: 48.0625rem)");
  var mqTall = window.matchMedia("(min-height: 500px)");
  var mediaPaused = false;

  /* ---------- Header state ---------- */
  var head = document.querySelector("[data-head]");
  function updateHead() {
    if (head) head.classList.toggle("is-scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", updateHead, { passive: true });
  updateHead();

  /* ---------- Hero: scroll scrub (desktop) / autoplay loop (mobile) ----------
     Der Modus wird nicht nur einmal beim Laden bestimmt: Media-Query-Wechsel,
     Fenstergrößenänderung und der Fall "Viewport beim Laden noch 0×0" führen
     zu einer Neubewertung mit Quelltausch. */
  var hero = document.querySelector("[data-hero]");
  var heroVideo = hero ? hero.querySelector(".hero__video") : null;
  var heroContent = hero ? hero.querySelector("[data-hero-content]") : null;
  var heroHint = hero ? hero.querySelector(".hero__hint") : null;
  var scrubActive = false;

  if (heroVideo) {
    var heroModeSet = false;
    var duration = 0;
    var current = 0;
    var target = 0;
    var lastSet = -1;

    heroVideo.addEventListener("loadedmetadata", function () {
      duration = heroVideo.duration || 0;
      if (scrubActive) {
        heroVideo.pause();
        try { heroVideo.currentTime = 0.001; } catch (e) {}
      }
    });
    heroVideo.addEventListener("canplay", function () {
      heroVideo.classList.add("is-ready");
    });

    var heroProgress = function () {
      var rect = hero.getBoundingClientRect();
      var scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return 0;
      var p = -rect.top / scrollable;
      return Math.min(1, Math.max(0, p));
    };

    var wantScrub = function () {
      return window.innerWidth > 0 && mqDesktop.matches && mqTall.matches && !reduceMotion;
    };

    var applyHeroMode = function () {
      if (window.innerWidth === 0) return; // Layout noch nicht da — später erneut
      var scrub = wantScrub();
      if (heroModeSet && scrub === scrubActive) return;
      heroModeSet = true;
      scrubActive = scrub;
      duration = 0; current = 0; lastSet = -1;
      heroVideo.classList.remove("is-ready");
      if (scrub) {
        document.documentElement.classList.add("js-scrub");
        heroVideo.loop = false;
        heroVideo.pause();
        heroVideo.src = heroVideo.getAttribute("data-src-scrub");
        heroVideo.load();
      } else {
        document.documentElement.classList.remove("js-scrub");
        if (heroContent) {
          heroContent.style.opacity = "";
          heroContent.style.transform = "";
          heroContent.style.visibility = "";
          heroContent.style.pointerEvents = "";
        }
        heroVideo.loop = true;
        heroVideo.muted = true;
        heroVideo.setAttribute("muted", "");
        heroVideo.src = heroVideo.getAttribute("data-src-loop");
        heroVideo.load();
        if (!reduceMotion && !mediaPaused) {
          var pp = heroVideo.play();
          if (pp && pp.catch) pp.catch(function () {});
        }
      }
    };

    var scrubLoop = function () {
      if (scrubActive && duration > 0) {
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
          // Unsichtbare Links dürfen keine Tab-Stopps bleiben (WCAG 2.4.7)
          heroContent.style.visibility = fade < 0.05 ? "hidden" : "";
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
      } else if (!heroModeSet) {
        applyHeroMode(); // Erstinitialisierung, sobald der Viewport Maße hat
      }
      requestAnimationFrame(scrubLoop);
    };

    applyHeroMode();
    requestAnimationFrame(scrubLoop);

    var onModeChange = function () { applyHeroMode(); };
    if (mqDesktop.addEventListener) {
      mqDesktop.addEventListener("change", onModeChange);
      mqTall.addEventListener("change", onModeChange);
    } else if (mqDesktop.addListener) {
      mqDesktop.addListener(onModeChange);
      mqTall.addListener(onModeChange);
    }
    window.addEventListener("resize", onModeChange);
    window.addEventListener("load", onModeChange);
    document.addEventListener("visibilitychange", onModeChange);
    // rAF pausiert in Hintergrund-Tabs — Timer-Fallback, damit die
    // Erstinitialisierung nicht vom Rendering abhängt.
    var initTries = 0;
    var initTimer = window.setInterval(function () {
      if (heroModeSet || ++initTries > 40) { window.clearInterval(initTimer); return; }
      applyHeroMode();
    }, 250);
  }

  /* ---------- Background videos: lazy src + play/pause in view ---------- */
  var bgVideos = Array.prototype.slice.call(document.querySelectorAll("[data-bg-video]"));
  function tryPlay(v) {
    if (reduceMotion || mediaPaused) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  if (bgVideos.length && "IntersectionObserver" in window) {
    var bgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          if (!v.src) { v.src = v.getAttribute("data-src"); v.load(); }
          tryPlay(v);
        } else if (v.src) {
          v.pause();
        }
      });
    }, { rootMargin: "200px 0px" });
    bgVideos.forEach(function (v) { bgObserver.observe(v); });
  } else {
    bgVideos.forEach(function (v) {
      v.src = v.getAttribute("data-src");
      v.load();
      tryPlay(v);
    });
  }

  /* ---------- Pause/Play für Endlos-Videos (WCAG 2.2.2) ---------- */
  var mediaToggle = document.querySelector("[data-media-toggle]");
  if (mediaToggle && !reduceMotion && (bgVideos.length || heroVideo)) {
    mediaToggle.hidden = false;
    mediaToggle.addEventListener("click", function () {
      mediaPaused = !mediaPaused;
      mediaToggle.setAttribute("aria-pressed", String(mediaPaused));
      mediaToggle.textContent = mediaPaused ? "Videos abspielen" : "Videos anhalten";
      var vids = bgVideos.slice();
      if (heroVideo && !scrubActive) vids.push(heroVideo);
      vids.forEach(function (v) {
        if (mediaPaused) {
          v.pause();
        } else if (v.src) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        }
      });
    });
  }

  /* ---------- Slow parallax on section media ---------- */
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax] video"));
  if (parallaxEls.length && !reduceMotion) {
    var ticking = false;
    var applyParallax = function () {
      ticking = false;
      if (!mqDesktop.matches) return;
      parallaxEls.forEach(function (media) {
        var section = media.closest(".section--media");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        var center = rect.top + rect.height / 2 - window.innerHeight / 2;
        media.style.transform = "translateY(" + (center * -0.08) + "px)";
      });
    };
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

    var setPos = function (v) {
      baFrame.style.setProperty("--pos", v + "%");
    };
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
        baCaption.textContent = btn.getAttribute("data-caption");
        baRange.value = 50;
        setPos(50);
      });
    });
  }

  /* ---------- Form validation ---------- */
  var form = document.querySelector("[data-form]");
  if (form) {
    var success = document.querySelector("[data-form-success]");

    var fieldWrap = function (input) { return input.closest(".field"); };
    var setError = function (input, msg) {
      var wrap = fieldWrap(input);
      if (!wrap) return;
      var err = wrap.querySelector(".field__error");
      wrap.classList.toggle("has-error", !!msg);
      if (err) err.textContent = msg || "";
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    };

    var validateName = function () {
      var el = form.elements.name;
      if (!el.value.trim()) { setError(el, "Bitte geben Sie Ihren Namen an."); return false; }
      setError(el, ""); return true;
    };
    var validatePhone = function () {
      var el = form.elements.telefon;
      var v = el.value.trim();
      if (!v) { setError(el, "Bitte geben Sie eine Telefonnummer an."); return false; }
      var digits = v.replace(/\D/g, "");
      if (digits.length < 6 || !/^[+0-9 ()\/\-.]+$/.test(v)) {
        setError(el, "Diese Telefonnummer sieht unvollständig aus."); return false;
      }
      setError(el, ""); return true;
    };
    var validateQm = function () {
      var el = form.elements.qm;
      var v = el.value.trim();
      if (!v) { setError(el, ""); return true; }
      var n = parseFloat(v.replace(",", "."));
      if (isNaN(n) || n <= 0 || n > 1000) {
        setError(el, "Bitte geben Sie eine Fläche zwischen 1 und 1000 qm an."); return false;
      }
      setError(el, ""); return true;
    };

    form.elements.name.addEventListener("blur", validateName);
    form.elements.telefon.addEventListener("blur", validatePhone);
    form.elements.qm.addEventListener("blur", validateQm);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = [validateName(), validatePhone(), validateQm()].every(Boolean);
      if (!ok) {
        var firstError = form.querySelector(".field.has-error input");
        if (firstError) firstError.focus();
        return;
      }
      // Honeypot "fail open": Browser-Autofill kann das versteckte Feld füllen,
      // echte Nutzer dürfen dadurch nicht in einer stummen Sackgasse landen.
      // Beim Anbinden eines Backends: Versand nur unterdrücken, wenn isBot true ist.
      var isBot = !!(form.elements.prueffeld && form.elements.prueffeld.value);
      void isBot;
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
