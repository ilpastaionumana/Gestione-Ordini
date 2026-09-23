/* ════════════════════════════════════════════════════════════════════
   GESTIONE DISPONIBILITÀ PRODOTTI — Il Pastaio
   File: disp.js
   Da aggiungere nel repository e referenziato in index.html
   DOPO <script src="app.js"></script>
   ════════════════════════════════════════════════════════════════════ */

/* ── STATO LOCALE ── */
window._disponibilita = {};        // { productId: "disponibile"|"non_disponibile"|"da_confermare" }
window._richiesteUnsub = null;     // unsubscribe listener richieste admin
window._richiesteInAttesa = {};    // { richiestaId: {...} } — solo per l'admin
window._formPendingItems = [];     // prodotti non disponibili nell'ordine corrente
window._formSaveBlocked = false;   // blocca il tasto Salva
window._richiestaInviata = false;  // evita invii duplicati per lo stesso ordine

/* ══════════════════════════════════════════════════════════════════
   1. CARICAMENTO DISPONIBILITÀ DA FIREBASE
   ══════════════════════════════════════════════════════════════════ */
function dispInit() {
  var fb = window._fb;
  // Aspetta Firebase E il profilo utente (altrimenti _isAdmin() restituisce "admin" per default)
  if (!fb || !fb.ready || !window._userProfile) { setTimeout(dispInit, 400); return; }
  fb.onSnapshot(fb.collection(fb.db, "disponibilita"), function(snap) {
    var nuovo = {};
    snap.forEach(function(d) { nuovo[d.id] = d.data().stato || "disponibile"; });
    window._disponibilita = nuovo;
    if (typeof renderProducts === "function" &&
        document.getElementById("pg-prodotti") &&
        document.getElementById("pg-prodotti").classList.contains("show")) {
      renderProducts();
    }
  });
}
setTimeout(dispInit, 800);

/* ══════════════════════════════════════════════════════════════════
   2. HELPER: leggi/scrivi stato disponibilità
   ══════════════════════════════════════════════════════════════════ */
function dispGetStato(productId) {
  return window._disponibilita[productId] || "disponibile";
}

function dispSetStato(productId, stato) {
  window._disponibilita[productId] = stato;
  if (window.fbSaveDoc) {
    window.fbSaveDoc("disponibilita", productId, {
      productId: productId, stato: stato, updatedAt: Date.now()
    });
  }
  if (typeof renderProducts === "function") renderProducts();
}

/* ══════════════════════════════════════════════════════════════════
   3. BADGE VISIVO DISPONIBILITÀ (usato in renderProducts)
   ══════════════════════════════════════════════════════════════════ */
function dispBadgeHTML(productId) {
  var s = dispGetStato(productId);
  var cfg = {
    "disponibile":     { label: "Disponibile",     bg: "#e8f5e3", color: "#3a7a2a", icon: "✅" },
    "non_disponibile": { label: "Non disponibile", bg: "#fdecea", color: "#c0392b", icon: "🔴" },
    "da_confermare":   { label: "Da confermare",   bg: "#fff8e1", color: "#e65100", icon: "🕐" }
  };
  var c = cfg[s] || cfg["disponibile"];
  return "<span style='font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;" +
    "background:" + c.bg + ";color:" + c.color + ";white-space:nowrap'>" +
    c.icon + " " + c.label + "</span>";
}

/* ══════════════════════════════════════════════════════════════════
   4. PULSANTI CAMBIO STATO (visibili solo all'admin, in renderProducts)
   ══════════════════════════════════════════════════════════════════ */
function dispCambioHTML(productId) {
  var s = dispGetStato(productId);
  var opts = [
    { stato: "disponibile",     icon: "✅", label: "Disponibile" },
    { stato: "non_disponibile", icon: "🔴", label: "Non disp." },
    { stato: "da_confermare",   icon: "🕐", label: "Da confermare" }
  ];
  var html = "<div style='display:flex;gap:4px;margin-top:8px;flex-wrap:wrap'>";
  opts.forEach(function(o) {
    var active = s === o.stato;
    html += "<button onclick=\"event.stopPropagation();dispSetStato('" + productId + "','" + o.stato + "')\" " +
      "style='font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px;border:1.5px solid " +
      (active ? "#5c3317" : "#e0cdb8") + ";background:" +
      (active ? "var(--br)" : "#fff") + ";color:" +
      (active ? "#fff" : "var(--txl)") + ";cursor:pointer;font-family:Lato,sans-serif'>" +
      o.icon + " " + o.label + "</button>";
  });
  html += "</div>";
  return html;
}

/* ══════════════════════════════════════════════════════════════════
   5. OVERRIDE DI renderProducts PER AGGIUNGERE I CONTROLLI
   ══════════════════════════════════════════════════════════════════ */
(function() {
  function _patchRenderProducts() {
    if (typeof renderProducts !== "function") { setTimeout(_patchRenderProducts, 200); return; }
    var _orig = renderProducts;
    window.renderProducts = function() {
      _orig();
      var cards = document.querySelectorAll("#pr-list .card");
      cards.forEach(function(card) {
        var pid = card.dataset.dragId;
        if (!pid) return;
        var nameDiv = card.querySelector("div[style*='font-size:14px']");
        if (nameDiv) {
          var oldBadge = card.querySelector(".disp-badge");
          if (oldBadge) oldBadge.remove();
          var badge = document.createElement("div");
          badge.className = "disp-badge";
          badge.style.marginTop = "4px";
          badge.innerHTML = dispBadgeHTML(pid);
          nameDiv.parentNode.insertBefore(badge, nameDiv.nextSibling);
        }
        if (typeof _isAdmin === "function" && _isAdmin()) {
          var oldBtns = card.querySelector(".disp-btns");
          if (oldBtns) oldBtns.remove();
          var btnsDiv = document.createElement("div");
          btnsDiv.className = "disp-btns";
          btnsDiv.innerHTML = dispCambioHTML(pid);
          var row = card.querySelector("div[style*='display:flex;align-items:center;gap:10px']");
          if (row) row.parentNode.appendChild(btnsDiv);
        }
      });
    };
  }
  _patchRenderProducts();
})();

/* ══════════════════════════════════════════════════════════════════
   6. INTERCETTA AGGIUNTA PRODOTTI TRAMITE DOM EVENT LISTENER
   ══════════════════════════════════════════════════════════════════ */
(function() {
  function _startDOMListener() {
    document.addEventListener("change", function(e) {
      if (!e.target.classList.contains("pgrow-qty")) return;
      setTimeout(_dispCheckFormItems, 50);
    }, true);

    document.addEventListener("input", function(e) {
      if (!e.target.classList.contains("pgrow-qty")) return;
      setTimeout(_dispCheckFormItems, 50);
    }, true);

    document.addEventListener("click", function(e) {
      var btn = e.target;
      if (btn.classList.contains("pgrow-plus") || btn.classList.contains("o15-pcode") ||
          btn.classList.contains("o15-vp-btn")) {
        setTimeout(_dispCheckFormItems, 100);
      }
    }, true);
  }
  _startDOMListener();
})();

/* Legge i prodotti non disponibili dal DOM del form e aggiorna lo stato */
function _dispCheckFormItems() {
  // Ricostruisci sempre la lista da zero leggendo tutto il DOM
  // (evita accumuli di prodotti rimossi o stati obsoleti)
  var nuoviPending = [];
  var qtyInputs = document.querySelectorAll(".pgrow-qty[data-pid]");

  qtyInputs.forEach(function(inp) {
    var pid = inp.dataset.pid;
    if (!pid) return;
    var qty = parseFloat(inp.value) || 0;
    if (qty <= 0) return;

    var stato = dispGetStato(pid);
    if (stato === "disponibile") return;

    // Leggi il nome dal DOM: span.pgrow-name nella stessa riga
    var row = inp.closest(".pgrow-conf-row");
    var nomeEl = row ? row.querySelector(".pgrow-name") : null;
    var nomeDOM = nomeEl ? nomeEl.textContent.trim() : "";
    // Il formato è "🍝 Nome prodotto" — rimuovi emoji e spazio non-breaking
    var nbspIdx = nomeDOM.indexOf(" ");
    if (nbspIdx >= 0) nomeDOM = nomeDOM.substring(nbspIdx + 1).trim();
    var nome = nomeDOM || pid;

    // Aggiungi solo se non già presente (deduplicazione per pid)
    if (!nuoviPending.find(function(x) { return x.productId === pid; })) {
      nuoviPending.push({ productId: pid, productName: nome, stato: stato });
    }
  });

  window._formPendingItems = nuoviPending;

  if (nuoviPending.length > 0) {
    window._formSaveBlocked = true;
    dispUpdateSaveButton();
    // Aggiorna o mostra il popup con la lista aggiornata
    dispShowPendingPopup();
    // Invia la richiesta al laboratorio solo se non è già stata inviata
    if (!window._richiestaInviata) {
      window._richiestaInviata = true;
      dispInviaRichiestaAdmin();
    }
  } else {
    window._formSaveBlocked = false;
    window._richiestaInviata = false;
    dispClearPendingUI();
    dispUpdateSaveButton();
  }
}

/* ══════════════════════════════════════════════════════════════════
   7. POP-UP LATO COMMESSA (prodotti in attesa)
   ══════════════════════════════════════════════════════════════════ */
function dispShowPendingPopup() {
  var pending = window._formPendingItems;
  if (!pending || !pending.length) return;

  // Rimuovi pop-up precedente se esiste e ricrealo aggiornato
  var old = document.getElementById("disp-pending-popup");
  if (old) old.remove();

  // Raggruppa per stato
  var nd = pending.filter(function(x) { return x.stato === "non_disponibile"; });
  var dc = pending.filter(function(x) { return x.stato === "da_confermare"; });

  var bodyHTML = "";
  if (nd.length) {
    bodyHTML += "<div style='font-size:13px;font-weight:700;color:#c0392b;margin-bottom:6px'>" +
      "🔴 Prodotti non disponibili — attendi la conferma del laboratorio:</div>" +
      "<ul style='margin:0 0 10px 16px;padding:0'>";
    nd.forEach(function(x) { bodyHTML += "<li style='font-size:13px;margin-bottom:3px'>" + x.productName + "</li>"; });
    bodyHTML += "</ul>";
  }
  if (dc.length) {
    bodyHTML += "<div style='font-size:13px;font-weight:700;color:#e65100;margin-bottom:6px'>" +
      "🕐 Prodotti da confermare — attendi la risposta del laboratorio:</div>" +
      "<ul style='margin:0 0 10px 16px;padding:0'>";
    dc.forEach(function(x) { bodyHTML += "<li style='font-size:13px;margin-bottom:3px'>" + x.productName + "</li>"; });
    bodyHTML += "</ul>";
  }

  var popup = document.createElement("div");
  popup.id = "disp-pending-popup";
  popup.style.cssText = "position:fixed;inset:0;z-index:8000;display:flex;align-items:flex-end;" +
    "justify-content:center;background:rgba(0,0,0,0.3);";

  popup.innerHTML =
    "<div id='disp-pending-sheet' style='background:#fff;border-radius:20px 20px 0 0;width:100%;" +
    "max-width:480px;padding:20px 18px 30px;box-shadow:0 -4px 24px rgba(0,0,0,.2);" +
    "max-height:60vh;overflow-y:auto'>" +
    "<div style='width:36px;height:4px;background:#ccc;border-radius:2px;margin:0 auto 14px'></div>" +
    "<div style='font-family:Playfair Display,serif;font-size:17px;color:#C4622D;margin-bottom:12px'>⚠️ Prodotti da confermare</div>" +
    bodyHTML +
    "<div style='font-size:12px;color:#7a5c45;margin-top:8px;margin-bottom:16px'>Il laboratorio è stato avvisato. Puoi continuare a compilare l'ordine ma non salvarlo finché non arriva la risposta.</div>" +
    "<button id='disp-pending-close-btn' style='width:100%;padding:11px;background:#f5ede6;color:#C4622D;" +
    "border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;" +
    "font-family:Lato,sans-serif'>Chiudi e continua</button>" +
    "</div>";

  document.body.appendChild(popup);

  // Pulsante chiudi — nasconde il popup senza ri-triggerare nulla
  document.getElementById("disp-pending-close-btn").addEventListener("click", function(e) {
    e.stopPropagation();
    popup.style.display = "none";
  });
  dispUpdateSaveButton();
  dispShowPendingBanner();
}

function dispShowPendingBanner() {
  var old = document.getElementById("disp-pending-banner");
  if (old) return; // già presente
  var banner = document.createElement("div");
  banner.id = "disp-pending-banner";
  banner.style.cssText = "position:fixed;bottom:70px;left:50%;transform:translateX(-50%);" +
    "background:#e65100;color:#fff;font-size:12px;font-weight:700;padding:7px 16px;" +
    "border-radius:20px;z-index:7999;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);" +
    "white-space:nowrap;";
  banner.textContent = "⚠️ Prodotti in attesa — tocca per vedere";
  banner.onclick = function() {
    var p = document.getElementById("disp-pending-popup");
    if (p) { p.style.display = "flex"; }
    else { dispShowPendingPopup(); }
  };
  document.body.appendChild(banner);
}

function dispClearPendingUI() {
  var p = document.getElementById("disp-pending-popup");
  if (p) p.remove();
  var b = document.getElementById("disp-pending-banner");
  if (b) b.remove();
}

/* ══════════════════════════════════════════════════════════════════
   8. BLOCCO TASTO SALVA
   ══════════════════════════════════════════════════════════════════ */
function dispUpdateSaveButton() {
  var saveBtn = document.getElementById("f-save-btn");
  if (!saveBtn) {
    var btns = document.querySelectorAll("#modal-sheet .btn-p, #modal-sheet button");
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.trim().startsWith("Salva")) { saveBtn = btns[i]; break; }
    }
  }
  if (!saveBtn) return;
  var blocked = window._formSaveBlocked && window._formPendingItems && window._formPendingItems.length > 0;
  saveBtn.disabled = blocked;
  saveBtn.style.opacity = blocked ? "0.4" : "1";
  saveBtn.style.cursor = blocked ? "not-allowed" : "pointer";
  saveBtn.title = blocked ? "Attendi la conferma del laboratorio" : "";
}

/* ══════════════════════════════════════════════════════════════════
   9. INVIO RICHIESTA AL LABORATORIO (una sola volta per ordine)
   ══════════════════════════════════════════════════════════════════ */
function dispInviaRichiestaAdmin() {
  if (typeof _isAdmin === "function" && _isAdmin()) return;
  var pv = (typeof _userPV === "function") ? _userPV() : "?";
  var pending = window._formPendingItems;
  if (!pending || !pending.length) return;

  var dataOrdine = "";
  var orarioOrdine = "";
  var fDate = document.getElementById("f-date");
  if (fDate) {
    var d = new Date(fDate.value);
    if (!isNaN(d)) {
      dataOrdine = String(d.getDate()).padStart(2,"0") + "/" +
        String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
    }
  }
  var fOrario = document.getElementById("f-time");
  if (fOrario && fOrario.value) orarioOrdine = fOrario.value;
  else if (window._orSlot) orarioOrdine = window._orSlot;

  var richiestaId = "rich_" + pv.replace(/\s/g,"_") + "_" + Date.now();
  var richiesta = {
    id: richiestaId,
    pv: pv,
    prodotti: pending.map(function(x) {
      var qtyInp = document.querySelector(".pgrow-qty[data-pid='" + x.productId + "']");
      var qty = qtyInp ? (parseFloat(qtyInp.value) || "") : "";
      var unitBtn = qtyInp ? qtyInp.closest(".pgrow-conf-row") : null;
      unitBtn = unitBtn ? unitBtn.querySelector(".pgrow-unit-mista") : null;
      var unit = unitBtn ? (unitBtn.dataset.unit || unitBtn.textContent.trim()) : "";
      return { productName: x.productName, productId: x.productId, qty: qty, unit: unit, stato: x.stato };
    }),
    data: dataOrdine,
    orario: orarioOrdine,
    timestamp: Date.now(),
    stato: "in_attesa"
  };

  if (window.fbSaveDoc) {
    window.fbSaveDoc("richieste_conferma", richiestaId, richiesta);
  }
  window._currentRichiestaId = richiestaId;
}

/* ══════════════════════════════════════════════════════════════════
   10. LISTENER RICHIESTE — LATO ADMIN (LABORATORIO)
   ══════════════════════════════════════════════════════════════════ */
function dispStartAdminListener() {
  if (!window._userProfile) { setTimeout(dispStartAdminListener, 400); return; }
  if (typeof _isAdmin !== "function" || !_isAdmin()) return;
  if (typeof _profile === "function" && _profile().role !== "admin") return;

  var fb = window._fb;
  if (!fb || !fb.ready) { setTimeout(dispStartAdminListener, 400); return; }

  if (window._richiesteUnsub) { window._richiesteUnsub(); }
  var q = fb.query(
    fb.collection(fb.db, "richieste_conferma"),
    fb.where("stato", "==", "in_attesa")
  );
  window._richiesteUnsub = fb.onSnapshot(q, function(snap) {
    var nuove = {};
    snap.forEach(function(d) { nuove[d.id] = d.data(); });

    var esistenti = window._richiesteInAttesa || {};
    var aggiunte = [];
    Object.keys(nuove).forEach(function(id) {
      if (!esistenti[id]) aggiunte.push(nuove[id]);
    });

    window._richiesteInAttesa = nuove;

    if (aggiunte.length > 0) {
      // Raggruppa per PV e mostra un popup per PV
      var perPV = {};
      aggiunte.forEach(function(r) {
        if (!perPV[r.pv]) perPV[r.pv] = [];
        perPV[r.pv].push(r);
      });
      Object.keys(perPV).forEach(function(pv) {
        dispMostraPopupAdmin(pv, perPV[pv]);
      });
    }
    dispAggiornaTuttiPopupAdmin();
  });
}

(function() {
  function _tryStart() {
    if (window._userProfile && typeof _isAdmin === "function" && window._fb && window._fb.ready) {
      dispStartAdminListener();
    } else {
      setTimeout(_tryStart, 400);
    }
  }
  _tryStart();
})();

/* ══════════════════════════════════════════════════════════════════
   11. POP-UP LATO ADMIN (LABORATORIO)
   ══════════════════════════════════════════════════════════════════ */
function dispMostraPopupAdmin(pv, richieste) {
  var popId = "disp-admin-popup-" + pv.replace(/\s/g, "_");
  if (document.getElementById(popId)) {
    dispRenderPopupAdmin(pv);
    return;
  }
  if (typeof window.playNewOrderSound === "function") window.playNewOrderSound();

  var popup = document.createElement("div");
  popup.id = popId;
  popup.dataset.pv = pv;
  popup.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:9100;" +
    "display:flex;align-items:center;justify-content:center;padding:20px;" +
    "background:rgba(0,0,0,0.5);";
  document.body.appendChild(popup);
  dispRenderPopupAdmin(pv);
}

function dispRenderPopupAdmin(pv) {
  var popId = "disp-admin-popup-" + pv.replace(/\s/g, "_");
  var popup = document.getElementById(popId);
  if (!popup) return;

  // Raccogli tutte le richieste in attesa per questo PV
  var tutte = Object.values(window._richiesteInAttesa || {}).filter(function(r) { return r.pv === pv; });
  if (!tutte.length) { popup.remove(); return; }

  var ultima = tutte.sort(function(a,b){ return b.timestamp - a.timestamp; })[0];
  var dataOra = ultima.data + (ultima.orario ? " alle " + ultima.orario : "");

  // Raccogli prodotti unici (deduplicazione per productName + richiestaId)
  var visti = {};
  var prodotti = [];
  tutte.forEach(function(r) {
    r.prodotti.forEach(function(p) {
      var chiave = r.id + "|" + p.productName;
      if (!visti[chiave]) {
        visti[chiave] = true;
        prodotti.push(Object.assign({}, p, { _richiestaId: r.id }));
      }
    });
  });

  var isSingolo = prodotti.length === 1;
  var titolo = pv + " chiede disponibilità";
  var sottotitolo = dataOra ? "— " + dataOra : "";

  var innerHTML;
  if (isSingolo) {
    var p0 = prodotti[0];
    var qtyLabel = p0.qty ? " " + p0.qty + " " + p0.unit : "";
    innerHTML =
      "<div style='font-size:14px;font-weight:700;color:#2c1a0e;margin-bottom:16px'>" +
      titolo + ": <strong>" + p0.productName + "</strong>" + qtyLabel + " " + sottotitolo + "</div>" +
      "<div style='display:flex;gap:10px'>" +
      "<button onclick=\"dispRispondiSingolo('" + p0._richiestaId + "','" + p0.productName.replace(/'/g,"\\'") + "','confermato','" + pv + "')\" " +
      "style='flex:1;padding:12px;background:#3a7a2a;color:#fff;border:none;border-radius:10px;" +
      "font-size:14px;font-weight:700;cursor:pointer'>✅ Confermo</button>" +
      "<button onclick=\"dispRispondiSingolo('" + p0._richiestaId + "','" + p0.productName.replace(/'/g,"\\'") + "','non_disponibile','" + pv + "')\" " +
      "style='flex:1;padding:12px;background:#c0392b;color:#fff;border:none;border-radius:10px;" +
      "font-size:14px;font-weight:700;cursor:pointer'>❌ Non disponibile</button>" +
      "</div>";
  } else {
    innerHTML =
      "<div style='font-size:14px;font-weight:700;color:#2c1a0e;margin-bottom:4px'>" + titolo + " " + sottotitolo + ":</div>" +
      "<div style='font-size:12px;color:#7a5c45;margin-bottom:12px;font-style:italic'>Spunta i prodotti disponibili:</div>";
    prodotti.forEach(function(p, i) {
      var qtyLabel = p.qty ? " (" + p.qty + " " + p.unit + ")" : "";
      innerHTML +=
        "<label style='display:flex;align-items:center;gap:10px;padding:8px 0;" +
        "border-bottom:1px solid #f0e4d4;cursor:pointer'>" +
        "<input type='checkbox' id='disp-chk-" + i + "' " +
        "data-richiestaid='" + p._richiestaId + "' " +
        "data-productname='" + p.productName.replace(/'/g,"&#39;") + "' " +
        "style='width:18px;height:18px;accent-color:#3a7a2a;cursor:pointer'>" +
        "<span style='font-size:13px;font-weight:700;flex:1'>" + p.productName + "</span>" +
        "<span style='font-size:12px;color:#7a5c45'>" + qtyLabel + "</span>" +
        "</label>";
    });
    innerHTML +=
      "<button onclick=\"dispInviaRispostaMultipla('" + pv + "')\" " +
      "style='width:100%;margin-top:14px;padding:12px;background:var(--t);color:#fff;" +
      "border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;" +
      "font-family:Lato,sans-serif'>✅ Invia risposta</button>";
  }

  popup.innerHTML =
    "<div style='background:#fff;border-radius:16px;padding:22px 20px;width:100%;max-width:420px;" +
    "box-shadow:0 8px 40px rgba(0,0,0,.35);max-height:80vh;overflow-y:auto'>" +
    "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:16px'>" +
    "<div style='font-family:Playfair Display,serif;font-size:16px;color:var(--br)'>📦 Richiesta conferma</div>" +
    "<span style='background:var(--cd);color:var(--br);font-size:11px;font-weight:700;" +
    "padding:3px 10px;border-radius:20px'>" + pv + "</span>" +
    "</div>" +
    innerHTML +
    "</div>";
}

function dispAggiornaTuttiPopupAdmin() {
  var pvAttivi = [];
  Object.values(window._richiesteInAttesa || {}).forEach(function(r) {
    if (pvAttivi.indexOf(r.pv) === -1) pvAttivi.push(r.pv);
  });
  // Chiudi popup per PV senza richieste attive
  document.querySelectorAll("[id^='disp-admin-popup-']").forEach(function(el) {
    var pvEl = el.dataset.pv;
    if (pvAttivi.indexOf(pvEl) === -1) el.remove();
  });
  // Aggiorna quelli ancora attivi
  pvAttivi.forEach(function(pv) { dispRenderPopupAdmin(pv); });
}

/* ══════════════════════════════════════════════════════════════════
   12. RISPOSTE ADMIN
   ══════════════════════════════════════════════════════════════════ */
function dispRispondiSingolo(richiestaId, productName, esito, pv) {
  var richiesta = (window._richiesteInAttesa || {})[richiestaId];
  if (!richiesta) return;

  var aggiornata = Object.assign({}, richiesta, { stato: "risposta_inviata" });
  aggiornata.prodotti = richiesta.prodotti.map(function(p) {
    if (p.productName === productName) return Object.assign({}, p, { esito: esito });
    return Object.assign({}, p, { esito: "confermato" }); // gli altri si intendono confermati
  });

  if (window.fbSaveDoc) {
    window.fbSaveDoc("richieste_conferma", richiestaId, aggiornata);
  }
  delete window._richiesteInAttesa[richiestaId];

  // Chiudi il popup di questo PV immediatamente
  var popId = "disp-admin-popup-" + pv.replace(/\s/g, "_");
  var pop = document.getElementById(popId);
  if (pop) pop.remove();

  showToast(esito === "confermato" ? "✅ Conferma inviata a " + pv : "❌ Non disponibile inviato a " + pv);
}

function dispInviaRispostaMultipla(pv) {
  var popId = "disp-admin-popup-" + pv.replace(/\s/g, "_");
  var popup = document.getElementById(popId);
  if (!popup) return;

  var checkboxes = popup.querySelectorAll("input[type='checkbox']");
  var risposte = {};

  checkboxes.forEach(function(chk) {
    var rid = chk.dataset.richiestaid;
    var pname = chk.dataset.productname;
    if (!risposte[rid]) risposte[rid] = { confermati: [], non_disponibili: [] };
    if (chk.checked) risposte[rid].confermati.push(pname);
    else risposte[rid].non_disponibili.push(pname);
  });

  Object.keys(risposte).forEach(function(rid) {
    var richiesta = (window._richiesteInAttesa || {})[rid];
    if (!richiesta) return;
    var aggiornata = Object.assign({}, richiesta, { stato: "risposta_inviata" });
    aggiornata.prodotti = richiesta.prodotti.map(function(p) {
      var esito = risposte[rid].confermati.indexOf(p.productName) >= 0 ? "confermato" : "non_disponibile";
      return Object.assign({}, p, { esito: esito });
    });
    if (window.fbSaveDoc) {
      window.fbSaveDoc("richieste_conferma", rid, aggiornata);
    }
    delete window._richiesteInAttesa[rid];
  });

  popup.remove();
  showToast("✅ Risposta inviata a " + pv);
}

/* ══════════════════════════════════════════════════════════════════
   13. LISTENER LATO COMMESSA — riceve la risposta dal laboratorio
   ══════════════════════════════════════════════════════════════════ */
(function() {
  var _rispostaUnsub = null;

  function _startCommessaListener() {
    if (!window._userProfile) { setTimeout(_startCommessaListener, 400); return; }
    if (typeof _isAdmin === "function" && _isAdmin()) return; // admin non ascolta
    var fb = window._fb;
    if (!fb || !fb.ready) { setTimeout(_startCommessaListener, 400); return; }
    var pv = (typeof _userPV === "function") ? _userPV() : null;
    if (!pv) { setTimeout(_startCommessaListener, 400); return; }

    if (_rispostaUnsub) { _rispostaUnsub(); }
    var q = fb.query(
      fb.collection(fb.db, "richieste_conferma"),
      fb.where("pv", "==", pv),
      fb.where("stato", "==", "risposta_inviata")
    );
    _rispostaUnsub = fb.onSnapshot(q, function(snap) {
      snap.forEach(function(d) {
        var richiesta = d.data();
        // Processa solo la richiesta corrente di questo form
        if (richiesta.id !== window._currentRichiestaId) return;
        dispRiceviRisposta(richiesta);
        window._currentRichiestaId = null;
        // Segna come processata per non riprocessarla
        if (window.fbSaveDoc) {
          window.fbSaveDoc("richieste_conferma", richiesta.id,
            Object.assign({}, richiesta, { stato: "processata" }));
        }
      });
    });
  }
  _startCommessaListener();
})();

function dispRiceviRisposta(richiesta) {
  richiesta.prodotti.forEach(function(p) {
    // Rimuovi dai pending
    window._formPendingItems = (window._formPendingItems || []).filter(function(x) {
      return x.productId !== p.productId;
    });
  });

  // Sblocca salvataggio se non ci sono più prodotti in attesa
  if (!window._formPendingItems || !window._formPendingItems.length) {
    window._formSaveBlocked = false;
    window._richiestaInviata = false;
    dispClearPendingUI();
    dispUpdateSaveButton();
  } else {
    // Aggiorna il popup con i prodotti rimasti
    dispShowPendingPopup();
    dispUpdateSaveButton();
  }

  try {
    if (typeof pgRenderCart === "function") pgRenderCart();
    else if (typeof renderFormItems === "function") renderFormItems();
  } catch(e) { /* ignora errori di re-render */ }

  dispMostraRispostaCommessa(richiesta.prodotti);
}

function dispMostraRispostaCommessa(prodotti) {
  var confermati = prodotti.filter(function(p) { return p.esito === "confermato"; });
  var nonDisp = prodotti.filter(function(p) { return p.esito === "non_disponibile"; });

  var bodyHTML = "";
  if (confermati.length) {
    bodyHTML += "<div style='margin-bottom:10px'>" +
      "<div style='font-size:13px;font-weight:700;color:#3a7a2a;margin-bottom:6px'>✅ Disponibile — puoi procedere con l'ordine:</div>";
    confermati.forEach(function(p) { bodyHTML += "<div style='font-size:13px;padding:3px 0'>• " + p.productName + "</div>"; });
    bodyHTML += "</div>";
  }
  if (nonDisp.length) {
    bodyHTML += "<div style='margin-bottom:10px'>" +
      "<div style='font-size:13px;font-weight:700;color:#c0392b;margin-bottom:6px'>❌ Non disponibile — rimuovi dall'ordine:</div>";
    nonDisp.forEach(function(p) { bodyHTML += "<div style='font-size:13px;padding:3px 0'>• " + p.productName + "</div>"; });
    bodyHTML += "</div>";
  }

  var ov = document.createElement("div");
  ov.id = "disp-risposta-commessa";
  ov.style.cssText = "position:fixed;inset:0;z-index:9200;display:flex;align-items:center;" +
    "justify-content:center;padding:20px;background:rgba(0,0,0,0.5)";
  ov.innerHTML =
    "<div style='background:#fff;border-radius:16px;padding:24px 20px;width:100%;max-width:360px;" +
    "box-shadow:0 8px 40px rgba(0,0,0,.3)'>" +
    "<div style='font-family:Playfair Display,serif;font-size:17px;color:var(--br);margin-bottom:14px'>📋 Risposta dal laboratorio</div>" +
    bodyHTML +
    "<button id='disp-risposta-ok-btn' " +
    "style='width:100%;padding:12px;background:var(--t);color:#fff;border:none;border-radius:10px;" +
    "font-size:14px;font-weight:700;cursor:pointer;font-family:Lato,sans-serif;margin-top:6px'>Ho capito</button>" +
    "</div>";
  document.body.appendChild(ov);
  // Assegna il click dopo aver aggiunto al DOM — evita problemi con onclick inline
  document.getElementById("disp-risposta-ok-btn").addEventListener("click", function() {
    var el = document.getElementById("disp-risposta-commessa");
    if (el) el.remove();
  });
}

/* ══════════════════════════════════════════════════════════════════
   14. RESET QUANDO SI CHIUDE IL FORM ORDINE
   ══════════════════════════════════════════════════════════════════ */
(function() {
  function _patchCloseModal() {
    if (typeof closeModal !== "function") { setTimeout(_patchCloseModal, 300); return; }
    var _orig = closeModal;
    window.closeModal = function() {
      dispResetForm();
      _orig();
    };
  }
  _patchCloseModal();
})();

function dispResetForm() {
  window._formPendingItems = [];
  window._formSaveBlocked = false;
  window._richiestaInviata = false;
  window._currentRichiestaId = null;
  dispClearPendingUI();
}

/* ══════════════════════════════════════════════════════════════════
   15. HOOK SUL TASTO SALVA
   ══════════════════════════════════════════════════════════════════ */
(function() {
  function _patchFSave() {
    if (typeof window._fSave !== "function") { setTimeout(_patchFSave, 300); return; }
    var _orig = window._fSave;
    window._fSave = function(eid, emode) {
      if (window._formSaveBlocked && window._formPendingItems && window._formPendingItems.length) {
        showToast("⚠️ Attendi la conferma del laboratorio prima di salvare");
        dispShowPendingPopup();
        return;
      }
      _orig(eid, emode);
      dispResetForm();
    };
  }
  _patchFSave();
})();
