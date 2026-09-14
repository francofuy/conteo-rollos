(function () {
  "use strict";

  var STORAGE_KEY = "conteoRollosState.v1";

  var TYPES = [
    { id: "b44_blanca", label: "60x44 Blanca" },
    { id: "b44_ti", label: "60x44 TI" },
    { id: "b44_verde", label: "60x44 Verde" },
    { id: "b44_wm", label: "60x44 WM" },
    { id: "b30_blanca", label: "60x30 Blanca" },
    { id: "b30_ti", label: "60x30 TI" },
    { id: "linerless", label: "Linerless" },
    { id: "film350", label: "Film 350" },
    { id: "film500", label: "Film 500" }
  ];

  var ORIGINS = [
    { id: "citek", label: "Citek" },
    { id: "citek_fondo", label: "Citek Fondo" },
    { id: "camioneta", label: "Camioneta" },
    { id: "las_marias", label: "Las Marías" }
  ];

  var MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  function monthKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function monthLabel(key) {
    var parts = key.split("-");
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    return MONTH_NAMES[m] + " " + y;
  }

  function nextMonthKey(key) {
    var parts = key.split("-");
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = new Date(y, m + 1, 1);
    return monthKey(d);
  }

  function emptyCounts() {
    var c = {};
    ORIGINS.forEach(function (o) {
      c[o.id] = {};
      TYPES.forEach(function (t) { c[o.id][t.id] = 0; });
    });
    return c;
  }

  function emptyKore() {
    var k = {};
    TYPES.forEach(function (t) { k[t.id] = 0; });
    return k;
  }

  function defaultState() {
    return {
      currentMonth: monthKey(),
      counts: emptyCounts(),
      kore: emptyKore(),
      koreUpdatedAt: null,
      history: []
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      // shallow-merge so a schema change never crashes an existing install
      parsed.counts = parsed.counts || base.counts;
      parsed.kore = parsed.kore || base.kore;
      parsed.history = parsed.history || [];
      ORIGINS.forEach(function (o) {
        parsed.counts[o.id] = parsed.counts[o.id] || {};
        TYPES.forEach(function (t) {
          if (typeof parsed.counts[o.id][t.id] !== "number") parsed.counts[o.id][t.id] = 0;
        });
      });
      TYPES.forEach(function (t) {
        if (typeof parsed.kore[t.id] !== "number") parsed.kore[t.id] = 0;
      });
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();
  var selectedOrigin = ORIGINS[0].id;
  var koreEditing = false;

  // ---------- shared helpers ----------

  function totalForType(typeId) {
    var sum = 0;
    ORIGINS.forEach(function (o) { sum += state.counts[o.id][typeId] || 0; });
    return sum;
  }

  function totalContado() {
    var sum = 0;
    TYPES.forEach(function (t) { sum += totalForType(t.id); });
    return sum;
  }

  function totalKore() {
    var sum = 0;
    TYPES.forEach(function (t) { sum += state.kore[t.id] || 0; });
    return sum;
  }

  function diffBadge(diff) {
    if (diff === 0) {
      return '<div class="badge ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></div>';
    }
    if (diff < 0) {
      return '<div class="badge short">' + diff + "</div>";
    }
    return '<div class="badge over">+' + diff + "</div>";
  }

  // ---------- render: conteo ----------

  function renderConteoTabs() {
    var el = document.getElementById("origin-tabs");
    el.innerHTML = ORIGINS.map(function (o) {
      return '<button class="seg-btn' + (o.id === selectedOrigin ? " active" : "") + '" data-origin="' + o.id + '">' + o.label + "</button>";
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".seg-btn"), function (btn) {
      btn.addEventListener("click", function () {
        selectedOrigin = btn.getAttribute("data-origin");
        renderConteo();
      });
    });
  }

  function renderConteoGrid() {
    var el = document.getElementById("conteo-grid");
    el.className = "grid span-last";
    el.innerHTML = TYPES.map(function (t) {
      var val = state.counts[selectedOrigin][t.id] || 0;
      return (
        '<div class="cell">' +
        '<label>' + t.label + "</label>" +
        '<input type="number" inputmode="numeric" min="0" step="1" aria-label="' + t.label + '" data-type="' + t.id + '" value="' + val + '">' +
        "</div>"
      );
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("input"), function (input) {
      input.addEventListener("input", function () {
        var typeId = input.getAttribute("data-type");
        var n = parseInt(input.value, 10);
        state.counts[selectedOrigin][typeId] = isNaN(n) || n < 0 ? 0 : n;
        saveState();
      });
      input.addEventListener("focus", function () { input.select(); });
    });
  }

  function renderConteo() {
    var originLabel = ORIGINS.filter(function (o) { return o.id === selectedOrigin; })[0].label;
    document.getElementById("conteo-title").textContent = originLabel;
    renderConteoTabs();
    renderConteoGrid();
  }

  // ---------- render: resumen ----------

  function renderResumen() {
    document.getElementById("resumen-title").textContent = monthLabel(state.currentMonth);

    var contado = totalContado();
    var kore = totalKore();
    var diff = contado - kore;
    var diffColor = diff === 0 ? "var(--success)" : diff < 0 ? "var(--danger)" : "var(--accent)";

    document.getElementById("resumen-hero").innerHTML =
      '<div class="hero-col"><span class="label">Contado</span><span class="value">' + contado + "</span></div>" +
      '<div class="hero-col"><span class="label">Kore</span><span class="value">' + kore + "</span></div>" +
      '<div class="hero-col"><span class="label">Diferencia</span><span class="value" style="color:' + diffColor + '">' + (diff > 0 ? "+" : "") + diff + "</span></div>";

    document.getElementById("resumen-list").innerHTML = TYPES.map(function (t) {
      var c = totalForType(t.id);
      var k = state.kore[t.id] || 0;
      var diffT = c - k;
      return (
        '<div class="row">' +
        '<div class="title-block"><span class="name">' + t.label + '</span><span class="sub">Contado ' + c + " · Kore " + k + "</span></div>" +
        diffBadge(diffT) +
        "</div>"
      );
    }).join("");
  }

  function cerrarMes() {
    var ok = window.confirm("¿Archivar " + monthLabel(state.currentMonth) + " en el historial y reiniciar el conteo para el próximo mes?");
    if (!ok) return;

    state.history.unshift({
      month: state.currentMonth,
      counts: JSON.parse(JSON.stringify(state.counts)),
      kore: JSON.parse(JSON.stringify(state.kore)),
      closedAt: new Date().toISOString()
    });

    state.currentMonth = nextMonthKey(state.currentMonth);
    state.counts = emptyCounts();
    // el valor de Kore normalmente se mantiene parecido mes a mes: lo dejamos
    // cargado como punto de partida y el usuario lo actualiza en la pestaña Kore.
    saveState();
    renderAll();
  }

  // ---------- render: historial ----------

  function renderHistorial() {
    var el = document.getElementById("historial-list");
    if (state.history.length === 0) {
      el.outerHTML = '<div class="card list" id="historial-list"><div class="empty-state">Todavía no cerraste ningún mes.<br>Usá "Cerrar mes" en Comparación cuando termines de contar.</div></div>';
      return;
    }
    el.innerHTML = state.history.map(function (h) {
      var contado = 0, kore = 0;
      TYPES.forEach(function (t) {
        var perOrigin = 0;
        ORIGINS.forEach(function (o) { perOrigin += (h.counts[o.id] && h.counts[o.id][t.id]) || 0; });
        contado += perOrigin;
        kore += h.kore[t.id] || 0;
      });
      var diff = contado - kore;
      var badge = diff === 0
        ? '<div class="badge ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg><span>Cuadra</span></div>'
        : diffBadge(diff);
      return (
        '<div class="row">' +
        '<span class="name">' + monthLabel(h.month) + "</span>" +
        '<div style="display:flex;align-items:center;gap:8px;">' + badge +
        '<svg class="chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></div>' +
        "</div>"
      );
    }).join("");
  }

  // ---------- render: kore ----------

  function renderKore() {
    document.getElementById("kore-title").textContent = monthLabel(state.currentMonth);
    document.getElementById("kore-eyebrow").textContent = koreEditing ? "Editando" : "Kore";
    document.getElementById("kore-eyebrow").style.color = koreEditing ? "var(--accent)" : "var(--text-secondary)";
    document.getElementById("btn-kore-toggle").textContent = koreEditing ? "Listo" : "Editar";

    var el = document.getElementById("kore-list");
    el.innerHTML = TYPES.map(function (t) {
      var val = state.kore[t.id] || 0;
      var right = koreEditing
        ? '<input class="kore-input" type="number" inputmode="numeric" min="0" step="1" aria-label="' + t.label + '" data-type="' + t.id + '" value="' + val + '">'
        : '<span class="kore-value">' + val + "</span>";
      return '<div class="row"><span class="name" style="font-weight:500;color:var(--text-secondary)">' + t.label + "</span>" + right + "</div>";
    }).join("");

    if (koreEditing) {
      Array.prototype.forEach.call(el.querySelectorAll("input"), function (input) {
        input.addEventListener("input", function () {
          var typeId = input.getAttribute("data-type");
          var n = parseInt(input.value, 10);
          state.kore[typeId] = isNaN(n) || n < 0 ? 0 : n;
          state.koreUpdatedAt = new Date().toISOString();
          saveState();
        });
        input.addEventListener("focus", function () { input.select(); });
      });
    }

    var hint = document.getElementById("kore-hint");
    hint.textContent = state.koreUpdatedAt
      ? "Actualizado el " + new Date(state.koreUpdatedAt).toLocaleDateString("es-AR")
      : "Todavía no cargaste el valor de Kore de este mes.";
  }

  // ---------- nav / init ----------

  function showScreen(name) {
    Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) {
      s.classList.toggle("active", s.id === "screen-" + name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.getAttribute("data-screen") === name);
    });
    if (name === "conteo") renderConteo();
    else if (name === "resumen") renderResumen();
    else if (name === "historial") renderHistorial();
    else if (name === "kore") renderKore();
  }

  function renderAll() {
    var active = document.querySelector(".tab.active");
    showScreen(active ? active.getAttribute("data-screen") : "conteo");
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
      tab.addEventListener("click", function () { showScreen(tab.getAttribute("data-screen")); });
    });
    document.getElementById("btn-cerrar-mes").addEventListener("click", cerrarMes);
    document.getElementById("btn-kore-toggle").addEventListener("click", function () {
      koreEditing = !koreEditing;
      renderKore();
    });

    showScreen("conteo");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  });
})();
