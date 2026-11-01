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
      const personas = form.personas.value;

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

      enviarConfirmacion({ nombre, apellido, asistencia, personas });
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
            "¡Gracias, " + datos.nombre + "! Te esperamos (" + datos.personas +
              (datos.personas === "1" ? " persona)." : " personas)."),
            false
          );
        } else {
          showFeedback(
            "Gracias por avisar, " + datos.nombre + ". ¡Te vamos a extrañar!",
            false
          );
        }
        form.reset();
        form.personas.value = "2";
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
