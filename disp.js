/* ════════════════════════════════════════════════════════════════════
   GESTIONE DISPONIBILITÀ PRODOTTI — Il Pastaio
   File: disp.js  —  caricare DOPO app.js in index.html
   ════════════════════════════════════════════════════════════════════ */

/* ── STATO GLOBALE ── */
window._disponibilita    = {};     // { pid: "disponibile"|"non_disponibile"|"da_confermare" }
window._richiesteUnsub   = null;
window._richiesteInAttesa= {};
window._formPendingItems = [];
window._formSaveBlocked  = false;
window._richiestaInviata = false;
window._popupChiusoTs    = 0;     // timestamp ultima chiusura "Chiudi e continua"
// Memoria dell'ordine aperto in questo momento (si azzera a ogni nuovo ordine)
window._dispConfermati   = {};    // { pid: true } — il laboratorio ha confermato: si può salvare
window._dispRifiutati    = {};    // { pid: true } — il laboratorio ha detto NO: va tolto dall'ordine
window._dispRichiesti    = {};    // { pid: true } — richiesta già inviata al laboratorio
window._dispMieRichieste = {};    // { richiestaId: true } — richieste inviate da questo ordine

/* ══════════════════════════════════════════════════════════════════
   1. DISPONIBILITÀ DA FIREBASE
   ══════════════════════════════════════════════════════════════════ */
function dispInit() {
  var fb = window._fb;
  if (!fb || !fb.ready) { setTimeout(dispInit, 400); return; }
  fb.onSnapshot(fb.collection(fb.db, "disponibilita"), function(snap) {
    var n = {};
    snap.forEach(function(d) { n[d.id] = d.data().stato || "disponibile"; });
    window._disponibilita = n;
    if (typeof renderProducts === "function" &&
        document.getElementById("pg-prodotti") &&
        document.getElementById("pg-prodotti").classList.contains("show")) {
      renderProducts();
    }
  });
}
setTimeout(dispInit, 800);

function dispGetStato(pid) { return window._disponibilita[pid] || "disponibile"; }

function dispSetStato(pid, stato) {
  window._disponibilita[pid] = stato;
  if (window.fbSaveDoc) window.fbSaveDoc("disponibilita", pid, { productId: pid, stato: stato, updatedAt: Date.now() });
  if (typeof renderProducts === "function") renderProducts();
}

/* ══════════════════════════════════════════════════════════════════
   2. BADGE E PULSANTI ADMIN IN renderProducts
   ══════════════════════════════════════════════════════════════════ */
function dispBadgeHTML(pid) {
  var s = dispGetStato(pid);
  var cfg = {
    disponibile:     { label:"Disponibile",     bg:"#e8f5e3", color:"#3a7a2a", icon:"✅" },
    non_disponibile: { label:"Non disponibile", bg:"#fdecea", color:"#c0392b", icon:"🔴" },
    da_confermare:   { label:"Da confermare",   bg:"#fff8e1", color:"#e65100", icon:"🕐" }
  };
  var c = cfg[s] || cfg.disponibile;
  return "<span style='font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;" +
    "background:" + c.bg + ";color:" + c.color + "'>" + c.icon + " " + c.label + "</span>";
}

function dispCambioHTML(pid) {
  var s = dispGetStato(pid);
  var opts = [
    { stato:"disponibile",     icon:"✅", label:"Disponibile" },
    { stato:"non_disponibile", icon:"🔴", label:"Non disp." },
    { stato:"da_confermare",   icon:"🕐", label:"Da confermare" }
  ];
  var html = "<div style='display:flex;gap:4px;margin-top:8px;flex-wrap:wrap'>";
  opts.forEach(function(o) {
    var a = s === o.stato;
    html += "<button onclick=\"event.stopPropagation();dispSetStato('" + pid + "','" + o.stato + "')\" " +
      "style='font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px;" +
      "border:1.5px solid " + (a?"#5c3317":"#e0cdb8") + ";" +
      "background:" + (a?"var(--br)":"#fff") + ";color:" + (a?"#fff":"var(--txl)") + ";cursor:pointer'>" +
      o.icon + " " + o.label + "</button>";
  });
  return html + "</div>";
}

(function() {
  function _patch() {
    if (typeof renderProducts !== "function") { setTimeout(_patch, 200); return; }
    var _orig = renderProducts;
    window.renderProducts = function() {
      _orig();
      document.querySelectorAll("#pr-list .card").forEach(function(card) {
        var pid = card.dataset.dragId;
        if (!pid || card.dataset.dragType !== "prod") return;

        // La card ha un solo figlio diretto: il div flex row
        // Dentro c'è: span(handle) + span(emoji) + div(flex:1) + div(pulsanti)
        // Il div(flex:1) contiene: div(nome) + div(shortName?) + div(codice)
        var flexDiv = card.querySelector("div[style*='flex:1']");

        // Badge disponibilità — lo mettiamo dopo l'ultimo figlio del div flex:1
        if (flexDiv) {
          var old = card.querySelector(".disp-badge"); if (old) old.remove();
          var b = document.createElement("div");
          b.className = "disp-badge"; b.style.marginTop = "4px";
          b.innerHTML = dispBadgeHTML(pid);
          flexDiv.appendChild(b);
        }

        // Pulsanti cambio stato (solo admin) — li mettiamo come secondo div sotto il flex row principale
        if (typeof _isAdmin === "function" && _isAdmin()) {
          var ob = card.querySelector(".disp-btns"); if (ob) ob.remove();
          var bd = document.createElement("div");
          bd.className = "disp-btns";
          bd.style.cssText = "padding:4px 10px 8px 50px"; // allineato col nome (dopo handle+emoji)
          bd.innerHTML = dispCambioHTML(pid);
          card.appendChild(bd);
        }
      });
    };
  }
  _patch();
})();

/* ══════════════════════════════════════════════════════════════════
   3. INTERCETTA MODIFICHE AL FORM (DOM listener capture)
   ══════════════════════════════════════════════════════════════════ */
(function() {
  // change/input sui campi quantità
  ["change","input"].forEach(function(evt) {
    document.addEventListener(evt, function(e) {
      if (e.target.classList.contains("pgrow-qty")) {
        setTimeout(_dispCheckFormItems, 80);
      }
    }, true);
  });
  // click su pulsanti che aggiungono prodotti
  document.addEventListener("click", function(e) {
    var t = e.target;
    // ignora click dentro i nostri popup
    if (t.closest && t.closest("#disp-pending-popup")) return;
    if (t.closest && t.closest("#disp-risposta-commessa")) return;
    if (t.classList.contains("pgrow-plus") ||
        t.classList.contains("o15-pcode") ||
        t.classList.contains("o15-vp-btn")) {
      setTimeout(_dispCheckFormItems, 150);
    }
  }, true);

  // Ogni volta che app.js aggiorna il carrello dell'ordine (fUpdateCart), ricontrolliamo.
  // Copre anche i prodotti aggiunti senza toccare lo schermo (es. ordine incollato, modifica ordine).
  var _cartTimer = null;
  function _patchCart() {
    if (typeof fUpdateCart !== "function") { setTimeout(_patchCart, 300); return; }
    var _origCart = fUpdateCart;
    window.fUpdateCart = function() {
      var r = _origCart.apply(this, arguments);
      clearTimeout(_cartTimer);
      _cartTimer = setTimeout(_dispCheckFormItems, 60);
      return r;
    };
  }
  _patchCart();
})();

/* ══════════════════════════════════════════════════════════════════
   4. CONTROLLO FORM — cuore della logica
   ══════════════════════════════════════════════════════════════════ */
// Legge i prodotti dell'ordine da DUE fonti e le unisce:
//  1) formItems = il "carrello" vero di app.js (quello che viene salvato)
//  2) i campi quantità visibili sullo schermo (valori appena digitati)
// Restituisce { pid: { productId, productName, qty, unit } }
function _dispLeggiProdottiOrdine() {
  var mappa = {};

  // 1) Carrello vero (formItems è una variabile di app.js visibile anche qui)
  try {
    if (typeof formItems !== "undefined" && Array.isArray(formItems)) {
      formItems.forEach(function(it) {
        if (!it || !it.productId) return;
        var pid = it._realPid || String(it.productId).replace(/__pz_tmp$/, "");
        var q = parseFloat(it.qty) || 0;
        if (it.confezioni && it.confezioni.length) {
          var tot = it.confezioni.reduce(function(s, c) { return s + (parseFloat(c && c.qty) || 0); }, 0);
          if (tot > q) q = tot;
        }
        if (q <= 0) return;
        mappa[pid] = { productId: pid, productName: it.productName || pid, qty: it.qty, unit: it.unit || "" };
      });
    }
  } catch (e) {}

  // 2) Schermo: i campi quantità visibili (il primo campo di ogni prodotto decide)
  var visti = {};
  document.querySelectorAll(".pgrow-qty[data-pid]").forEach(function(inp) {
    var pid = inp.dataset.pid;
    if (!pid) return;
    var row = inp.closest(".pgrow-conf-row");
    var box = row ? row.parentNode : null;
    // somma tutte le confezioni dello stesso prodotto
    if (visti[pid]) return;
    visti[pid] = true;
    var tot = 0;
    document.querySelectorAll(".pgrow-qty[data-pid='" + pid + "']").forEach(function(x) {
      tot += parseFloat(x.value) || 0;
    });
    if (tot <= 0) {
      // Sullo schermo il prodotto è a zero: se la commessa l'ha appena azzerato,
      // lo togliamo anche se il carrello non si è ancora aggiornato
      delete mappa[pid];
      return;
    }
    if (mappa[pid]) return; // già letto dal carrello
    // Leggi nome dal DOM — formato: "🍝 Nome prodotto"
    var nomeEl = row ? row.querySelector(".pgrow-name") : null;
    var testo = nomeEl ? nomeEl.textContent.trim() : "";
    var idx = testo.indexOf(" ");
    var nome = idx >= 0 ? testo.substring(idx + 1).trim() : testo;
    var uBtn = row ? row.querySelector(".pgrow-unit-mista") : null;
    var unit = uBtn ? (uBtn.dataset.unit || uBtn.textContent.trim()) : "";
    mappa[pid] = { productId: pid, productName: nome || pid, qty: String(tot), unit: unit };
  });

  return mappa;
}

function _dispCheckFormItems() {
  // Il laboratorio (admin) non viene mai bloccato
  if (typeof _isAdmin === "function" && _isAdmin()) {
    if (window._formSaveBlocked || (window._formPendingItems || []).length) _dispResetForm();
    return;
  }

  var prodotti = _dispLeggiProdottiOrdine();
  var nuoviPending = [];
  var daRichiedere = [];

  Object.keys(prodotti).forEach(function(pid) {
    var stato = dispGetStato(pid);
    if (stato === "disponibile") return;
    if (window._dispConfermati[pid]) return;          // confermato dal laboratorio: ok
    var p = prodotti[pid];
    var rifiutato = !!window._dispRifiutati[pid];      // il laboratorio ha detto NO
    nuoviPending.push({ productId: pid, productName: p.productName, stato: stato,
                        rifiutato: rifiutato, qty: p.qty, unit: p.unit });
    if (!rifiutato && !window._dispRichiesti[pid]) daRichiedere.push(nuoviPending[nuoviPending.length - 1]);
  });

  window._formPendingItems = nuoviPending;

  if (nuoviPending.length > 0) {
    window._formSaveBlocked = true;
    _dispAggiornaBloccoSalva();

    var nuoviPid = nuoviPending.map(function(x){ return x.productId + (x.rifiutato ? "!" : ""); }).sort().join(",");
    var vecchiPid = (window._lastPendingPids || "");
    var listaModificata = nuoviPid !== vecchiPid;
    window._lastPendingPids = nuoviPid;

    var popup = document.getElementById("disp-pending-popup");
    if (!popup) {
      _dispCreaPopup();
    } else {
      _dispAggiornaBodyPopup();
      // Riapri solo se è cambiato qualcosa (rispetta "Chiudi e continua")
      if (listaModificata) popup.style.display = "flex";
    }

    // Invia al laboratorio solo i prodotti non ancora richiesti
    if (daRichiedere.length) {
      daRichiedere.forEach(function(x){ window._dispRichiesti[x.productId] = true; });
      window._richiestaInviata = true;
      dispInviaRichiestaAdmin(daRichiedere);
    }

    _dispMostraBanner();
  } else {
    window._formSaveBlocked  = false;
    window._lastPendingPids  = "";
    _dispRimuoviUI();
    _dispAggiornaBloccoSalva();
  }
}

/* ══════════════════════════════════════════════════════════════════
   5. POPUP COMMESSA
   ══════════════════════════════════════════════════════════════════ */
function _dispBodyHTML() {
  var pend = window._formPendingItems || [];
  var rf = pend.filter(function(x){ return x.rifiutato; });
  var nd = pend.filter(function(x){ return !x.rifiutato && x.stato === "non_disponibile"; });
  var dc = pend.filter(function(x){ return !x.rifiutato && x.stato === "da_confermare"; });
  var h = "";
  if (rf.length) {
    h += "<p style='font-size:13px;font-weight:700;color:#c0392b;margin:0 0 6px'>❌ Il laboratorio ha risposto NON disponibile — toglilo dall'ordine:</p><ul style='margin:0 0 12px 18px;padding:0'>";
    rf.forEach(function(x){ h += "<li style='font-size:13px;margin-bottom:3px'>" + x.productName + "</li>"; });
    h += "</ul>";
  }
  if (nd.length) {
    h += "<p style='font-size:13px;font-weight:700;color:#c0392b;margin:0 0 6px'>🔴 Non disponibili:</p><ul style='margin:0 0 12px 18px;padding:0'>";
    nd.forEach(function(x){ h += "<li style='font-size:13px;margin-bottom:3px'>" + x.productName + "</li>"; });
    h += "</ul>";
  }
  if (dc.length) {
    h += "<p style='font-size:13px;font-weight:700;color:#e65100;margin:0 0 6px'>🕐 Da confermare:</p><ul style='margin:0 0 12px 18px;padding:0'>";
    dc.forEach(function(x){ h += "<li style='font-size:13px;margin-bottom:3px'>" + x.productName + "</li>"; });
    h += "</ul>";
  }
  return h;
}

function _dispAggiornaBodyPopup() {
  var bodyDiv = document.querySelector("#disp-pending-sheet .disp-body");
  if (bodyDiv) bodyDiv.innerHTML = _dispBodyHTML();
}

function _dispCreaPopup() {
  var popup = document.createElement("div");
  popup.id = "disp-pending-popup";
  popup.style.cssText = "position:fixed;inset:0;z-index:8000;display:flex;align-items:flex-end;" +
    "justify-content:center;background:rgba(0,0,0,0.35);";

  popup.innerHTML =
    "<div id='disp-pending-sheet' style='background:#fff;border-radius:20px 20px 0 0;" +
    "width:100%;max-width:480px;padding:20px 18px 32px;box-shadow:0 -4px 24px rgba(0,0,0,.2);" +
    "max-height:65vh;overflow-y:auto;box-sizing:border-box'>" +
    "<div style='width:36px;height:4px;background:#ccc;border-radius:2px;margin:0 auto 14px'></div>" +
    "<div style='font-family:Playfair Display,serif;font-size:17px;color:#C4622D;margin-bottom:12px'>⚠️ Prodotti da confermare</div>" +
    "<div class='disp-body'>" + _dispBodyHTML() + "</div>" +
    "<p style='font-size:12px;color:#7a5c45;margin:8px 0 16px'>Il laboratorio è stato avvisato. " +
    "Non puoi salvare l'ordine finché non arriva la risposta (o finché non togli i prodotti non disponibili).</p>" +
    "<button id='disp-close-btn' style='width:100%;padding:14px;background:#f5ede6;color:#C4622D;" +
    "border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:Lato,sans-serif;" +
    "-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer'>" +
    "Chiudi e continua</button>" +
    "</div>";

  document.body.appendChild(popup);

  var btn = document.getElementById("disp-close-btn");
  function chiudi(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    window._popupChiusoTs = Date.now();
    popup.style.display = "none";
  }
  btn.addEventListener("touchend", chiudi, { capture: true, passive: false });
  btn.addEventListener("click",    chiudi, { capture: true });
}

function _dispMostraBanner() {
  if (document.getElementById("disp-pending-banner")) return;
  var b = document.createElement("div");
  b.id = "disp-pending-banner";
  b.style.cssText = "position:fixed;bottom:70px;left:50%;transform:translateX(-50%);" +
    "background:#e65100;color:#fff;font-size:12px;font-weight:700;padding:7px 16px;" +
    "border-radius:20px;z-index:7999;box-shadow:0 4px 12px rgba(0,0,0,.3);" +
    "white-space:nowrap;touch-action:manipulation;cursor:pointer;";
  b.textContent = "⚠️ Prodotti in attesa — tocca per vedere";
  b.addEventListener("click", function() {
    var p = document.getElementById("disp-pending-popup");
    if (p) p.style.display = "flex";
    else _dispCreaPopup();
  });
  document.body.appendChild(b);
}

function _dispRimuoviUI() {
  var p = document.getElementById("disp-pending-popup"); if (p) p.remove();
  var b = document.getElementById("disp-pending-banner"); if (b) b.remove();
}

/* ══════════════════════════════════════════════════════════════════
   6. BLOCCO TASTO SALVA
   ══════════════════════════════════════════════════════════════════ */
function _dispAggiornaBloccoSalva() {
  // Cerca tutti i possibili bottoni Salva nel form ordine
  var blocked = !!(window._formSaveBlocked &&
    window._formPendingItems && window._formPendingItems.length > 0);

  // Bottone mobile (contiene emoji + testo) — SOLO il Salva dell'ordine (quello che chiama _fSave),
  // così i Salva di prodotti/categorie/clienti non vengono mai bloccati
  document.querySelectorAll("#modal-sheet button[onclick*='_fSave']").forEach(function(btn) {
    var txt = btn.textContent || "";
    if (txt.indexOf("Salva") === -1) return;
    btn.disabled = blocked;
    btn.style.opacity = blocked ? "0.4" : "1";
    btn.style.cursor  = blocked ? "not-allowed" : "";
    btn.title         = blocked ? "Attendi la conferma del laboratorio" : "";
  });

  // Bottone schermo grande (classe o15-kbtn o15-save)
  document.querySelectorAll(".o15-kbtn.o15-save, .o15-save").forEach(function(btn) {
    btn.style.opacity        = blocked ? "0.4" : "1";
    btn.style.pointerEvents  = blocked ? "none" : "";
    btn.title                = blocked ? "Attendi la conferma del laboratorio" : "";
  });
}

/* Blocco aggiuntivo su click (capture phase) — funziona anche se disabled non viene applicato */
(function() {
  document.addEventListener("click", function(e) {
    if (!window._formSaveBlocked) return;
    if (!window._formPendingItems || !window._formPendingItems.length) return;
    var t = e.target;
    if (!t || !t.closest) return;
    // Blocca solo il Salva dell'ordine: pulsante desktop .o15-save oppure pulsante che chiama _fSave
    var isSave = !!(t.closest(".o15-save") || t.closest("[onclick*='_fSave']"));
    if (!isSave) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (typeof showToast === "function") showToast("⚠️ Attendi la conferma del laboratorio prima di salvare");
    var p = document.getElementById("disp-pending-popup");
    if (p) p.style.display = "flex"; else _dispCreaPopup();
  }, true);
})();

/* ══════════════════════════════════════════════════════════════════
   7. HOOK window._fSave (terzo strato di sicurezza)
   ══════════════════════════════════════════════════════════════════ */
(function() {
  function _patchFSave() {
    if (typeof window._fSave !== "function") { setTimeout(_patchFSave, 200); return; }
    var _orig = window._fSave;
    window._fSave = function(eid, emode) {
      // Controllo finale sul carrello vero, subito prima di salvare
      try { if (typeof pgSaveAllQty === "function") pgSaveAllQty(); } catch (e) {}
      _dispCheckFormItems();
      if (window._formSaveBlocked && window._formPendingItems && window._formPendingItems.length) {
        if (typeof showToast === "function") showToast("⚠️ Attendi la conferma del laboratorio prima di salvare");
        var p = document.getElementById("disp-pending-popup");
        if (p) p.style.display = "flex"; else _dispCreaPopup();
        return;
      }
      _orig(eid, emode);
      // Il reset avviene all'apertura del prossimo ordine / alla chiusura del modulo:
      // così, se il salvataggio si ferma (es. manca il nome cliente), le conferme non si perdono.
    };
  }
  _patchFSave();
})();

/* ══════════════════════════════════════════════════════════════════
   8. INVIO RICHIESTA AL LABORATORIO
   ══════════════════════════════════════════════════════════════════ */
function dispInviaRichiestaAdmin(lista) {
  if (typeof _isAdmin === "function" && _isAdmin()) return;
  var pv = (typeof _userPV === "function") ? _userPV() : "?";
  if (!pv) pv = "?";
  var pending = lista || window._formPendingItems;
  if (!pending || !pending.length) return;

  var dataOrdine = "", orarioOrdine = "";
  var fDate = document.getElementById("f-date");
  if (fDate) {
    var d = new Date(fDate.value);
    if (!isNaN(d)) dataOrdine = String(d.getDate()).padStart(2,"0") + "/" +
      String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
  }
  var fOrario = document.getElementById("f-time");
  if (fOrario && fOrario.value) orarioOrdine = fOrario.value;
  else if (window._orSlot) orarioOrdine = window._orSlot;

  var rid = "rich_" + pv.replace(/\s/g,"_") + "_" + Date.now();
  var richiesta = {
    id: rid, pv: pv, data: dataOrdine, orario: orarioOrdine,
    timestamp: Date.now(), stato: "in_attesa",
    prodotti: pending.map(function(x) {
      var qty  = parseFloat(x.qty) || null;
      var unit = x.unit || null;
      return { productId: x.productId, productName: x.productName, qty: qty, unit: unit, stato: x.stato };
    })
  };
  window._dispMieRichieste[rid] = true;
  window._currentRichiestaId = rid;
  if (window.fbSaveDoc) window.fbSaveDoc("richieste_conferma", rid, richiesta);
}

/* ══════════════════════════════════════════════════════════════════
   9. LISTENER ADMIN
   ══════════════════════════════════════════════════════════════════ */
function dispStartAdminListener() {
  if (!window._userProfile) { setTimeout(dispStartAdminListener, 400); return; }
  if (typeof _isAdmin !== "function" || !_isAdmin()) return;
  if (typeof _profile === "function" && _profile().role !== "admin") return;
  var fb = window._fb;
  if (!fb || !fb.ready) { setTimeout(dispStartAdminListener, 400); return; }

  if (window._richiesteUnsub) window._richiesteUnsub();
  var q = fb.query(fb.collection(fb.db,"richieste_conferma"), fb.where("stato","==","in_attesa"));
  window._richiesteUnsub = fb.onSnapshot(q, function(snap) {
    var nuove = {};
    snap.forEach(function(d){ nuove[d.id] = d.data(); });
    var esistenti = window._richiesteInAttesa || {};
    var aggiunte  = [];
    Object.keys(nuove).forEach(function(id){ if (!esistenti[id]) aggiunte.push(nuove[id]); });
    window._richiesteInAttesa = nuove;
    if (aggiunte.length) {
      var perPV = {};
      aggiunte.forEach(function(r){ if (!perPV[r.pv]) perPV[r.pv]=[]; perPV[r.pv].push(r); });
      Object.keys(perPV).forEach(function(pv){ _dispMostraPopupAdmin(pv, perPV[pv]); });
    }
    _dispAggiornaTuttiAdmin();
  });
}
(function(){ function _t(){ if(window._userProfile&&typeof _isAdmin==="function"&&window._fb&&window._fb.ready) dispStartAdminListener(); else setTimeout(_t,400); } _t(); })();

/* ══════════════════════════════════════════════════════════════════
   10. POPUP ADMIN
   ══════════════════════════════════════════════════════════════════ */
function _dispMostraPopupAdmin(pv, richieste) {
  var id = "disp-adm-" + pv.replace(/\s/g,"_");
  if (!document.getElementById(id)) {
    if (typeof window.playNewOrderSound === "function") window.playNewOrderSound();
    var el = document.createElement("div");
    el.id = id; el.dataset.pv = pv;
    el.style.cssText = "position:fixed;inset:0;z-index:9100;display:flex;align-items:center;" +
      "justify-content:center;padding:20px;background:rgba(0,0,0,0.5);";
    document.body.appendChild(el);
  }
  _dispRenderAdmin(pv);
}

function _dispRenderAdmin(pv) {
  var id = "disp-adm-" + pv.replace(/\s/g,"_");
  var popup = document.getElementById(id); if (!popup) return;
  var tutte = Object.values(window._richiesteInAttesa||{}).filter(function(r){ return r.pv===pv; });
  if (!tutte.length) { popup.remove(); return; }

  var ultima = tutte.sort(function(a,b){ return b.timestamp-a.timestamp; })[0];
  var dataOra = ultima.data + (ultima.orario ? " alle "+ultima.orario : "");

  // Deduplicazione prodotti
  var visti={}, prodotti=[];
  tutte.forEach(function(r){ r.prodotti.forEach(function(p){
    var k=r.id+"|"+p.productName;
    if (!visti[k]) { visti[k]=true; prodotti.push(Object.assign({},p,{_rid:r.id})); }
  }); });

  var titolo = pv + " chiede disponibilità";
  var sub    = dataOra ? "— " + dataOra : "";
  var body;

  if (prodotti.length === 1) {
    var p0=prodotti[0], ql=p0.qty?(" "+p0.qty+" "+(p0.unit||"")):"";
    body =
      "<p style='font-size:14px;font-weight:700;color:#2c1a0e;margin:0 0 16px'>" +
      titolo+": <strong>"+p0.productName+"</strong>"+ql+" "+sub+"</p>" +
      "<div style='display:flex;gap:10px'>" +
      "<button onclick=\"_dispRispondi('"+p0._rid+"','"+p0.productName.replace(/'/g,"\\'")+"','confermato','"+pv+"')\" " +
      "style='flex:1;padding:12px;background:#3a7a2a;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer'>✅ Confermo</button>" +
      "<button onclick=\"_dispRispondi('"+p0._rid+"','"+p0.productName.replace(/'/g,"\\'")+"','non_disponibile','"+pv+"')\" " +
      "style='flex:1;padding:12px;background:#c0392b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer'>❌ Non disponibile</button>" +
      "</div>";
  } else {
    body = "<p style='font-size:14px;font-weight:700;color:#2c1a0e;margin:0 0 4px'>"+titolo+" "+sub+":</p>" +
           "<p style='font-size:12px;color:#7a5c45;margin:0 0 12px;font-style:italic'>Spunta i prodotti disponibili:</p>";
    prodotti.forEach(function(p,i){
      var ql=p.qty?(" ("+p.qty+" "+(p.unit||"")+")"):"";
      body += "<label style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0e4d4;cursor:pointer'>" +
        "<input type='checkbox' id='dchk-"+i+"' data-rid='"+p._rid+"' data-pname='"+p.productName.replace(/'/g,"&#39;")+"' style='width:18px;height:18px;accent-color:#3a7a2a'>" +
        "<span style='font-size:13px;font-weight:700;flex:1'>"+p.productName+"</span>" +
        "<span style='font-size:12px;color:#7a5c45'>"+ql+"</span></label>";
    });
    body += "<button onclick=\"_dispRispondiMulti('"+pv+"')\" " +
      "style='width:100%;margin-top:14px;padding:12px;background:var(--t);color:#fff;" +
      "border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:Lato,sans-serif'>✅ Invia risposta</button>";
  }

  popup.innerHTML =
    "<div style='background:#fff;border-radius:16px;padding:22px 20px;width:100%;max-width:420px;" +
    "box-shadow:0 8px 40px rgba(0,0,0,.35);max-height:80vh;overflow-y:auto'>" +
    "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:16px'>" +
    "<div style='font-family:Playfair Display,serif;font-size:16px;color:var(--br)'>📦 Richiesta conferma</div>" +
    "<span style='background:var(--cd);color:var(--br);font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px'>"+pv+"</span>" +
    "</div>" + body + "</div>";
}

function _dispAggiornaTuttiAdmin() {
  var pvAttivi = [];
  Object.values(window._richiesteInAttesa||{}).forEach(function(r){ if(pvAttivi.indexOf(r.pv)===-1)pvAttivi.push(r.pv); });
  document.querySelectorAll("[id^='disp-adm-']").forEach(function(el){
    if (pvAttivi.indexOf(el.dataset.pv)===-1) el.remove();
  });
  pvAttivi.forEach(function(pv){ _dispRenderAdmin(pv); });
}

/* ══════════════════════════════════════════════════════════════════
   11. RISPOSTE ADMIN
   ══════════════════════════════════════════════════════════════════ */
function _dispRispondi(rid, productName, esito, pv) {
  var r = (window._richiesteInAttesa||{})[rid]; if (!r) return;
  var ag = Object.assign({}, r, { stato:"risposta_inviata" });
  ag.prodotti = r.prodotti.map(function(p){
    return Object.assign({},p,{ esito: p.productName===productName ? esito : "confermato" });
  });
  if (window.fbSaveDoc) window.fbSaveDoc("richieste_conferma", rid, ag);
  delete window._richiesteInAttesa[rid];
  var pop = document.getElementById("disp-adm-"+pv.replace(/\s/g,"_")); if (pop) pop.remove();
  if (typeof showToast==="function") showToast(esito==="confermato"?"✅ Conferma inviata a "+pv:"❌ Non disponibile inviato a "+pv);
}

function _dispRispondiMulti(pv) {
  var popup = document.getElementById("disp-adm-"+pv.replace(/\s/g,"_")); if (!popup) return;
  var risposte = {};
  popup.querySelectorAll("input[type='checkbox']").forEach(function(chk){
    var rid=chk.dataset.rid, pname=chk.dataset.pname;
    if (!risposte[rid]) risposte[rid]={conf:[],nond:[]};
    (chk.checked ? risposte[rid].conf : risposte[rid].nond).push(pname);
  });
  Object.keys(risposte).forEach(function(rid){
    var r=(window._richiesteInAttesa||{})[rid]; if (!r) return;
    var ag=Object.assign({},r,{stato:"risposta_inviata"});
    ag.prodotti=r.prodotti.map(function(p){
      return Object.assign({},p,{esito:risposte[rid].conf.indexOf(p.productName)>=0?"confermato":"non_disponibile"});
    });
    if (window.fbSaveDoc) window.fbSaveDoc("richieste_conferma",rid,ag);
    delete window._richiesteInAttesa[rid];
  });
  popup.remove();
  if (typeof showToast==="function") showToast("✅ Risposta inviata a "+pv);
}

/* ══════════════════════════════════════════════════════════════════
   12. LISTENER COMMESSA — riceve risposta del laboratorio
   ══════════════════════════════════════════════════════════════════ */
(function(){
  var _unsub = null;
  function _start() {
    if (!window._userProfile) { setTimeout(_start,400); return; }
    if (typeof _isAdmin==="function" && _isAdmin()) return;
    var fb=window._fb;
    if (!fb||!fb.ready) { setTimeout(_start,400); return; }
    var pv=(typeof _userPV==="function")?_userPV():null;
    if (!pv) { setTimeout(_start,400); return; }
    if (_unsub) _unsub();
    var q=fb.query(fb.collection(fb.db,"richieste_conferma"),fb.where("pv","==",pv),fb.where("stato","==","risposta_inviata"));
    _unsub=fb.onSnapshot(q,function(snap){
      snap.forEach(function(d){
        var r=d.data();
        if (!window._dispMieRichieste[r.id]) return;
        delete window._dispMieRichieste[r.id];
        _dispRiceviRisposta(r);
        if (window.fbSaveDoc) window.fbSaveDoc("richieste_conferma",r.id,Object.assign({},r,{stato:"processata"}));
      });
    });
  }
  _start();
})();

function _dispRiceviRisposta(richiesta) {
  (richiesta.prodotti || []).forEach(function(p){
    if (p.esito === "non_disponibile") {
      window._dispRifiutati[p.productId] = true;
      delete window._dispConfermati[p.productId];
    } else {
      window._dispConfermati[p.productId] = true;
      delete window._dispRifiutati[p.productId];
    }
  });
  // Ricalcola tutto: sblocca se restano solo prodotti confermati,
  // resta bloccato se ci sono prodotti respinti ancora nell'ordine
  _dispCheckFormItems();
  try { if(typeof pgRenderCart==="function") pgRenderCart(); } catch(e){}
  _dispMostraRispostaCommessa(richiesta.prodotti || []);
}

function _dispMostraRispostaCommessa(prodotti) {
  var conf=prodotti.filter(function(p){return p.esito==="confermato";});
  var nond=prodotti.filter(function(p){return p.esito==="non_disponibile";});
  var h="";
  if (conf.length) {
    h+="<div style='margin-bottom:10px'><p style='font-size:13px;font-weight:700;color:#3a7a2a;margin:0 0 6px'>✅ Disponibile — puoi procedere:</p>";
    conf.forEach(function(p){h+="<div style='font-size:13px;padding:2px 0'>• "+p.productName+"</div>";});
    h+="</div>";
  }
  if (nond.length) {
    h+="<div style='margin-bottom:10px'><p style='font-size:13px;font-weight:700;color:#c0392b;margin:0 0 6px'>❌ Non disponibile — rimuovi dall'ordine:</p>";
    nond.forEach(function(p){h+="<div style='font-size:13px;padding:2px 0'>• "+p.productName+"</div>";});
    h+="</div>";
  }
  var ov=document.createElement("div");
  ov.id="disp-risposta-commessa";
  ov.style.cssText="position:fixed;inset:0;z-index:9200;display:flex;align-items:center;" +
    "justify-content:center;padding:20px;background:rgba(0,0,0,0.5);touch-action:none;";
  ov.innerHTML=
    "<div style='background:#fff;border-radius:16px;padding:24px 20px;width:100%;max-width:360px;box-shadow:0 8px 40px rgba(0,0,0,.3)'>" +
    "<div style='font-family:Playfair Display,serif;font-size:17px;color:var(--br);margin-bottom:14px'>📋 Risposta dal laboratorio</div>" +
    h +
    "<button id='disp-ok-btn' style='width:100%;padding:14px;background:var(--t);color:#fff;border:none;" +
    "border-radius:10px;font-size:15px;font-weight:700;font-family:Lato,sans-serif;margin-top:6px;" +
    "-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer'>Ho capito</button>" +
    "</div>";
  document.body.appendChild(ov);

  var btn=document.getElementById("disp-ok-btn");
  function chiudi(e){
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var el=document.getElementById("disp-risposta-commessa"); if(el) el.remove();
  }
  btn.addEventListener("touchend", chiudi, {capture:true, passive:false});
  btn.addEventListener("click",    chiudi, {capture:true});
}

/* ══════════════════════════════════════════════════════════════════
   13. RESET FORM
   ══════════════════════════════════════════════════════════════════ */
(function(){
  function _p(){ if(typeof closeModal!=="function"){setTimeout(_p,300);return;}
    var _o=closeModal; window.closeModal=function(){_dispResetForm();return _o.apply(this,arguments);}; }
  _p();
  // Chiusura del modulo ordine su schermo grande
  function _p15(){ if(typeof o15Close!=="function"){setTimeout(_p15,300);return;}
    var _o=o15Close; window.o15Close=function(){_dispResetForm();return _o.apply(this,arguments);}; }
  _p15();
  // Apertura di un nuovo ordine (o modifica): si riparte puliti e si controlla subito
  function _pOpen(){ if(typeof openOrderForm!=="function"){setTimeout(_pOpen,300);return;}
    var _o=openOrderForm; window.openOrderForm=function(){
      _dispResetForm();
      var r=_o.apply(this,arguments);
      setTimeout(_dispCheckFormItems,400);
      return r;
    }; }
  _pOpen();
})();

function _dispResetForm() {
  window._formPendingItems  = [];
  window._formSaveBlocked   = false;
  window._richiestaInviata  = false;
  window._currentRichiestaId= null;
  window._lastPendingPids   = "";
  window._popupChiusoTs     = 0;
  window._dispConfermati    = {};
  window._dispRifiutati     = {};
  window._dispRichiesti     = {};
  window._dispMieRichieste  = {};
  _dispRimuoviUI();
  _dispAggiornaBloccoSalva();
}
