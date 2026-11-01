/* ===================================================
   Invitación de boda · Santiago & Dahiana
   Countdown + animaciones de scroll + RSVP
   =================================================== */

(function () {
  "use strict";

  /* ---------- Fecha del evento ---------- */
  // 19 de diciembre de 2026, 20:00 (hora local)
  const WEDDING_DATE = new Date(2026, 11, 19, 20, 0, 0);

  /* =========================================
     1) CUENTA REGRESIVA
     ========================================= */
  const countdownEl = document.getElementById("countdown");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function updateCountdown() {
    if (!countdownEl) return;

    const now = new Date();
    let diff = Math.floor((WEDDING_DATE - now) / 1000); // segundos

    if (diff <= 0) {
      setUnit("days", 0);
      setUnit("hours", 0);
      setUnit("minutes", 0);
      setUnit("seconds", 0);
      const caption = document.querySelector(".countdown__caption");
      if (caption) caption.textContent = "¡Hoy es el gran día!";
      clearInterval(timer);
      return;
    }

    const days = Math.floor(diff / 86400);
    diff -= days * 86400;
    const hours = Math.floor(diff / 3600);
    diff -= hours * 3600;
    const minutes = Math.floor(diff / 60);
    const seconds = diff - minutes * 60;

    setUnit("days", days);
    setUnit("hours", pad(hours));
    setUnit("minutes", pad(minutes));
    setUnit("seconds", pad(seconds));
  }

  function setUnit(unit, value) {
    const el = countdownEl.querySelector(`[data-unit="${unit}"]`);
    if (el) el.textContent = value;
  }

  updateCountdown();
  const timer = setInterval(updateCountdown, 1000);

  /* =========================================
     2) ANIMACIONES AL HACER SCROLL
     ========================================= */
  const revealEls = document.querySelectorAll(".reveal");
  let revealStarted = false;

  // Se inicia cuando el sobre ya se está abriendo (o de inmediato si no hay sobre)
  function initReveal() {
    if (revealStarted) return;
    revealStarted = true;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      revealEls.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      // Fallback: mostrar todo si no hay soporte
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }

  /* =========================================
     2b) SOBRE DE INTRODUCCIÓN
     ========================================= */
  const intro = document.getElementById("intro");
  const envelope = document.getElementById("envelope");
  let locked = !!intro; // bloquea el scroll mientras el sobre está cerrado

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  function unlockSite() {
    locked = false;
    document.body.classList.remove("is-locked");
    if (intro) intro.remove();
    window.scrollTo(0, 0);
    updateDots();
  }

  if (intro && envelope) {
    envelope.addEventListener("click", function () {
      if (intro.classList.contains("is-open")) return;
      intro.classList.add("is-open");

      // 1) solapa se abre y la carta sube  2) el sobre se desvanece  3) se libera el sitio
      setTimeout(function () {
        intro.classList.add("is-leaving");
        initReveal();
      }, 2400);
      setTimeout(unlockSite, 3400);
    });
  } else {
    initReveal();
  }

  /* =========================================
     2c) DESPLAZAMIENTO POR PÁGINAS (lento y suave)
     ========================================= */
  const pages = Array.prototype.slice.call(
    document.querySelectorAll("body > header, body > section, body > footer")
  );
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DURATION = reduceMotion ? 1 : 1200; // ms de la transición entre páginas
  const EDGE = 4; // tolerancia en px

  let animating = false;
  let cooldownUntil = 0;

  function vh() { return window.innerHeight; }
  function pageTop(p) { return p.getBoundingClientRect().top + window.scrollY; }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Página en la que está el borde superior de la pantalla
  function currentIndex() {
    const y = window.scrollY + EDGE;
    let idx = 0;
    pages.forEach(function (p, i) { if (pageTop(p) <= y) idx = i; });
    return idx;
  }

  // Página que ocupa el centro de la pantalla (para los puntos)
  function centerIndex() {
    const y = window.scrollY + vh() / 2;
    let idx = 0;
    pages.forEach(function (p, i) { if (pageTop(p) <= y) idx = i; });
    return idx;
  }

  // Píxeles que aún se pueden desplazar dentro de la página actual (páginas altas)
  function remainingInPage(dir) {
    const p = pages[currentIndex()];
    const top = pageTop(p);
    if (dir > 0) return top + p.offsetHeight - (window.scrollY + vh());
    return window.scrollY - top;
  }
  function canScrollInside(dir) {
    return remainingInPage(dir) > EDGE;
  }

  function animateTo(target) {
    const max = document.documentElement.scrollHeight - vh();
    target = Math.max(0, Math.min(target, max));
    const start = window.scrollY;
    const dist = target - start;
    if (Math.abs(dist) < 1) return;

    animating = true;
    const t0 = performance.now();
    function step(now) {
      const t = Math.min(1, (now - t0) / DURATION);
      window.scrollTo(0, start + dist * easeInOutCubic(t));
      updateDots();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animating = false;
        cooldownUntil = performance.now() + 400; // ignora la inercia del trackpad
      }
    }
    requestAnimationFrame(step);
  }

  function go(dir) {
    const n = currentIndex() + dir;
    if (n < 0 || n >= pages.length) return;
    const p = pages[n];
    let target;
    if (dir > 0) {
      target = pageTop(p);
    } else {
      // al subir a una página alta, se llega a su parte final
      target = Math.max(pageTop(p), pageTop(p) + p.offsetHeight - vh());
    }
    animateTo(target);
  }

  // --- Rueda del mouse / trackpad ---
  window.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey) return; // zoom
      if (locked || animating) { e.preventDefault(); return; }
      const dir = Math.sign(e.deltaY);
      if (!dir) return;

      if (canScrollInside(dir)) {
        // Página alta: se desplaza normal, pero sin pasarse al borde
        const rest = remainingInPage(dir);
        if (rest < Math.abs(e.deltaY)) {
          e.preventDefault();
          window.scrollTo(0, window.scrollY + dir * rest);
        }
        return;
      }

      e.preventDefault();
      if (performance.now() < cooldownUntil) return;
      go(dir);
    },
    { passive: false }
  );

  // --- Táctil (celulares / tablets) ---
  let touchStartY = 0;
  let touchScrolledInside = false;

  window.addEventListener("touchstart", function (e) {
    touchStartY = e.touches[0].clientY;
    touchScrolledInside = false;
  }, { passive: true });

  window.addEventListener("touchmove", function (e) {
    if (locked || animating) { if (e.cancelable) e.preventDefault(); return; }
    const dy = touchStartY - e.touches[0].clientY;
    if (Math.abs(dy) < 3) return;
    const dir = dy > 0 ? 1 : -1;
    if (canScrollInside(dir)) {
      touchScrolledInside = true; // deja que la página alta se desplace sola
    } else if (e.cancelable) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("touchend", function (e) {
    if (locked || animating || touchScrolledInside) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 45) return;
    const dir = dy > 0 ? 1 : -1;
    if (!canScrollInside(dir)) go(dir);
  }, { passive: true });

  // --- Teclado ---
  window.addEventListener("keydown", function (e) {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (locked || animating) {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].indexOf(e.key) !== -1 && tag !== "BUTTON") {
        e.preventDefault();
      }
      return;
    }

    let dir = 0;
    if (e.key === "ArrowDown" || e.key === "PageDown") dir = 1;
    else if (e.key === "ArrowUp" || e.key === "PageUp") dir = -1;
    else if (e.key === " " && tag !== "BUTTON") dir = e.shiftKey ? -1 : 1;
    else if (e.key === "Home") { e.preventDefault(); animateTo(0); return; }
    else if (e.key === "End") { e.preventDefault(); animateTo(document.documentElement.scrollHeight); return; }
    if (!dir) return;

    if (canScrollInside(dir)) return; // scroll nativo dentro de página alta
    e.preventDefault();
    go(dir);
  });

  // --- Flecha "Desliza" de la portada ---
  const heroScroll = document.querySelector(".hero__scroll");
  if (heroScroll) {
    heroScroll.addEventListener("click", function (e) {
      e.preventDefault();
      if (!locked && !animating) go(1);
    });
  }

  // --- Puntos laterales ---
  const dotsNav = document.createElement("nav");
  dotsNav.className = "page-dots";
  dotsNav.setAttribute("aria-label", "Páginas de la invitación");
  const dots = pages.map(function (p, i) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Ir a la página " + (i + 1));
    b.addEventListener("click", function () {
      if (locked || animating) return;
      animateTo(pageTop(p));
    });
    dotsNav.appendChild(b);
    return b;
  });
  document.body.appendChild(dotsNav);

  function updateDots() {
    const c = centerIndex();
    dots.forEach(function (d, i) { d.classList.toggle("is-active", i === c); });
  }
  window.addEventListener("scroll", updateDots, { passive: true });
  window.addEventListener("resize", updateDots);
  updateDots();

  /* =========================================
     3) FORMULARIO RSVP
     ========================================= */
  const form = document.getElementById("rsvpForm");
  const feedback = document.getElementById("rsvpFeedback");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const nombre = form.nombre.value.trim();
      const apellido = form.apellido.value.trim();
      const asistencia = form.asistencia.value;

      if (!nombre) {
        showFeedback("Por favor, escribí tu nombre.", true);
        form.nombre.focus();
        return;
      }
      if (!apellido) {
        showFeedback("Por favor, escribí tu apellido.", true);
        form.apellido.focus();
        return;
      }
      if (!asistencia) {
        showFeedback("Indicá si vas a asistir.", true);
        form.asistencia.focus();
        return;
      }

      enviarConfirmacion({ nombre, apellido, asistencia });
    });
  }

  function enviarConfirmacion(datos) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    showFeedback("Enviando…", false);

    fetch("/api/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          throw new Error(
            (result.data && result.data.error) ||
              "No se pudo registrar la confirmación."
          );
        }
        if (datos.asistencia === "si") {
          showFeedback(
            "¡Gracias, " + datos.nombre + "! Te esperamos.",
            false
          );
        } else {
          showFeedback(
            "Gracias por avisar, " + datos.nombre + ". ¡Te vamos a extrañar!",
            false
          );
        }
        form.reset();
      })
      .catch(function (err) {
        showFeedback(
          err.message || "Ocurrió un error. Intentá de nuevo.",
          true
        );
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function showFeedback(msg, isError) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.style.color = isError ? "#b0453e" : "";
  }
})();
