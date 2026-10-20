/* ════════════════════════════════════════════════════════════════════
   GESTIONE DISPONIBILITÀ PRODOTTI — Il Pastaio
   File: disp.js  —  caricare DOPO app.js in index.html
   Versione semplificata (24/09/2026):
   - 3 stati: disponibile / non_disponibile / da_confermare
   - Commessa: prodotto NON disponibile → messaggio e prodotto tolto dall'ordine
               prodotto DA CONFERMARE  → messaggio "telefona al laboratorio",
                                          il prodotto resta e il Salva è libero
   - Ordini già salvati (riaperti in modifica): i prodotti già presenti non vengono MAI toccati
   - Laboratorio (admin): nessun messaggio durante il lavoro,
                          solo un riepilogo alla prima apertura del giorno
   - Badge di stato anche nella ricerca prodotti del modulo ordine
   - Schermo grande 15" (ottobre 2026): pulsanti dei prodotti non disponibili sbiaditi, niente pallini
   - Varianti (20/10/2026): prodotti con lo stesso codice raggruppati nel riepilogo del mattino e nella
     pagina Prodotti (scheda di gruppo con maniglia, pulsanti per tutte le varianti, "Varianti ▸");
     con la ricerca attiva si vedono solo le varianti trovate. Pulsanti di stato su una sola riga.
   ════════════════════════════════════════════════════════════════════ */

/* ── STATO GLOBALE ── */
window._disponibilita   = {};     // { pid: "disponibile"|"non_disponibile"|"da_confermare" }
window._dispCaricato    = false;  // true dopo il primo arrivo dei dati da Firebase
window._dispIniziali    = {};     // { pid: true } prodotti già presenti quando si apre l'ordine (mai toccati)
window._dispAvvisati    = {};     // { pid: true } prodotti "da confermare" già segnalati in questo ordine
window._dispInControllo = false;  // evita controlli annidati

function _dispIsAdmin() { return (typeof _isAdmin === "function") && _isAdmin(); }

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
    window._dispCaricato = true;
    if (typeof renderProducts === "function" &&
        document.getElementById("pg-prodotti") &&
        document.getElementById("pg-prodotti").classList.contains("show")) {
      renderProducts();
    }
    _dispDecoraRicerca(true);
    _dispAggiornaRiepilogo();
  });
}
setTimeout(dispInit, 800);

function dispGetStato(pid) { return window._disponibilita[pid] || "disponibile"; }

function dispSetStato(pid, stato) {
  window._disponibilita[pid] = stato;
  if (window.fbSaveDoc) window.fbSaveDoc("disponibilita", pid, { productId: pid, stato: stato, updatedAt: Date.now() });
  if (typeof renderProducts === "function") renderProducts();
  _dispDecoraRicerca(true);
}

/* ── VARIANTI (ottobre 2026) ──
   Le varianti di uno stesso prodotto (es. LSR X 4 / X 6 / X 8) hanno lo stesso codice prodotto.
   Si raggruppano per codice; i prodotti senza codice restano da soli. */

// Cambia lo stato di più prodotti insieme (un solo ridisegno alla fine)
function dispSetStatoGruppo(pids, stato) {
  pids.forEach(function(pid) {
    window._disponibilita[pid] = stato;
    if (window.fbSaveDoc) window.fbSaveDoc("disponibilita", pid, { productId: pid, stato: stato, updatedAt: Date.now() });
  });
  if (typeof renderProducts === "function") renderProducts();
  _dispDecoraRicerca(true);
}

// Raggruppa un elenco di prodotti per codice, mantenendo l'ordine del primo prodotto di ogni gruppo
function _dispGruppi(lista) {
  var gruppi = [], perCodice = {};
  lista.forEach(function(p) {
    if (!p || !p.id) return;
    var cod = (p.code !== undefined && p.code !== null && String(p.code).trim() !== "") ? String(p.code).trim() : null;
    if (cod && perCodice[cod]) { perCodice[cod].prodotti.push(p); return; }
    var g = { chiave: cod ? "c" + cod : "p" + p.id, codice: cod, prodotti: [p] };
    if (cod) perCodice[cod] = g;
    gruppi.push(g);
  });
  gruppi.forEach(function(g) {
    g.ids  = g.prodotti.map(function(p) { return p.id; });
    g.nome = g.prodotti.length > 1 ? _dispNomeComune(g.prodotti) : g.prodotti[0].name;
    g.icona = g.prodotti[0].image || "";
  });
  return gruppi;
}

// Parte iniziale comune dei nomi delle varianti ("Lasagne al ragù X 4" + "… X 6" → "Lasagne al ragù")
function _dispNomeComune(prodotti) {
  var parole = prodotti.map(function(p) { return String(p.name || "").trim().split(/\s+/); });
  var comuni = [];
  for (var i = 0; i < parole[0].length; i++) {
    var w = parole[0][i];
    if (!parole.every(function(ws) { return ws[i] !== undefined && ws[i].toLowerCase() === w.toLowerCase(); })) break;
    comuni.push(w);
  }
  // toglie in coda le parolette che da sole non dicono niente (x, da, per, -, numeri, parentesi…)
  var vuote = ["x", "da", "di", "per", "con", "e", "-", "–", "(", "gr", "g", "kg", "pz"];
  while (comuni.length) {
    var ult = comuni[comuni.length - 1].toLowerCase().replace(/[(),.:;]+$/, "");
    if (ult === "" || vuote.indexOf(ult) > -1 || /^[\d.,x×]+$/.test(ult)) comuni.pop(); else break;
  }
  var nome = comuni.join(" ").replace(/[\s\-–(,.:;]+$/, "");
  return nome || prodotti[0].name;
}

// Stato del gruppo: lo stato comune, oppure "misto"
function _dispStatoGruppo(ids) {
  var s0 = dispGetStato(ids[0]);
  for (var i = 1; i < ids.length; i++) if (dispGetStato(ids[i]) !== s0) return "misto";
  return s0;
}

// Lo stato "più grave" tra le varianti (serve a decidere in quale sezione del riepilogo va il gruppo)
function _dispStatoPeggiore(ids) {
  var st = ids.map(dispGetStato);
  if (st.indexOf("non_disponibile") > -1) return "non_disponibile";
  if (st.indexOf("da_confermare") > -1) return "da_confermare";
  return "disponibile";
}

// Nome breve della singola variante (sigla se c'è, altrimenti nome completo)
function _dispNomeVariante(p) {
  return (p.shortName && String(p.shortName).trim()) ? String(p.shortName).trim() : p.name;
}

/* ══════════════════════════════════════════════════════════════════
   2. BADGE E PULSANTI ADMIN NELLA PAGINA PRODOTTI
   ══════════════════════════════════════════════════════════════════ */
var _DISP_CFG = {
  disponibile:     { label:"Disponibile",     bg:"#e8f5e3", color:"#3a7a2a", icon:"✅" },
  non_disponibile: { label:"Non disponibile", bg:"#fdecea", color:"#c0392b", icon:"🔴" },
  da_confermare:   { label:"Da confermare",   bg:"#fff8e1", color:"#e65100", icon:"🕐" }
};

function dispBadgeHTML(pid) {
  var c = _DISP_CFG[dispGetStato(pid)] || _DISP_CFG.disponibile;
  return "<span style='font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;" +
    "background:" + c.bg + ";color:" + c.color + "'>" + c.icon + " " + c.label + "</span>";
}

function dispCambioHTML(pid) {
  var s = dispGetStato(pid);
  var opts = [
    { stato:"disponibile",     icon:"✅", label:"Disponibile" },
    { stato:"non_disponibile", icon:"🔴", label:"Non disp." },
    { stato:"da_confermare",   icon:"🕐", label:"Da confermare" }
  ];
  return _dispFilaPulsanti(s, "dispSetStato('" + pid + "',", "");
}

// Fila unica di 3 pulsanti (pagina Prodotti). chiamata = inizio della funzione da chiamare, es. "dispSetStato('abc',"
function _dispFilaPulsanti(attivo, chiamata, prefisso) {
  var opts = [
    { stato:"disponibile",     t:"✅ " + (prefisso ? prefisso + " disp." : "Disp.") },
    { stato:"non_disponibile", t:"🔴 " + (prefisso ? prefisso + " non disp." : "Non disp.") },
    { stato:"da_confermare",   t:"🕐 " + (prefisso ? prefisso + " da conf." : "Da conf.") }
  ];
  var html = "<div style='display:flex;gap:4px;margin-top:8px;flex-wrap:nowrap'>";
  opts.forEach(function(o) {
    var a = attivo === o.stato;
    html += "<button type='button' onclick=\"event.stopPropagation();" + chiamata + "'" + o.stato + "')\" " +
      "style='flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:700;padding:6px 2px;border-radius:8px;" +
      "border:1.5px solid " + (a?"#5c3317":"#e0cdb8") + ";font-family:Lato,sans-serif;" +
      "background:" + (a?"var(--br,#5C3317)":"#fff") + ";color:" + (a?"#fff":"var(--txl,#7A5C45)") + ";cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation'>" + o.t + "</button>";
  });
  return html + "</div>";
}

(function() {
  function _patch() {
    if (typeof renderProducts !== "function") { setTimeout(_patch, 200); return; }
    var _orig = renderProducts;
    window.renderProducts = function() {
      _orig.apply(this, arguments);
      document.querySelectorAll("#pr-list .card").forEach(function(card) {
        var pid = card.dataset.dragId;
        if (!pid || card.dataset.dragType !== "prod") return;

        // Badge disponibilità — dentro il div flex:1 (nome + codice)
        var flexDiv = card.querySelector("div[style*='flex:1']");
        if (flexDiv) {
          var old = card.querySelector(".disp-badge"); if (old) old.remove();
          var b = document.createElement("div");
          b.className = "disp-badge"; b.style.marginTop = "4px";
          b.innerHTML = dispBadgeHTML(pid);
          flexDiv.appendChild(b);
        }

        // Pulsanti cambio stato (solo admin) — sotto la riga principale della card, tutti su una riga
        if (_dispIsAdmin()) {
          var ob = card.querySelector(".disp-btns"); if (ob) ob.remove();
          var bd = document.createElement("div");
          bd.className = "disp-btns";
          bd.style.cssText = "padding:2px 0 0 0";
          bd.innerHTML = dispCambioHTML(pid);
          card.appendChild(bd);
        }
      });
      _dispRaggruppaPaginaProdotti();
      _dispCompattaGruppoTrascinato();
    };
  }
  _patch();
})();

/* ── PAGINA PRODOTTI: varianti raggruppate (ottobre 2026) ──
   Le schede delle varianti (stesso codice, stessa categoria) vanno dentro una scheda di gruppo.
   Con la ricerca attiva niente gruppi: si vedono solo le varianti trovate, come prima. */
window._dispPrAperti = {};            // { codice: true } gruppi aperti nella pagina Prodotti
window._dispGruppoTrascinato = null;  // ids delle varianti del gruppo che si sta spostando

function _dispRaggruppaPaginaProdotti() {
  var lista = document.getElementById("pr-list");
  if (!lista) return;
  var q = (document.getElementById("pr-q") || { value: "" }).value.trim();
  if (q) return;
  var perId = {};
  products.forEach(function(p) { if (p && p.id) perId[p.id] = p; });

  // ogni sezione = una categoria: si raggruppa solo dentro la stessa categoria
  Array.prototype.forEach.call(lista.children, function(sezione) {
    var schede = Array.prototype.filter.call(sezione.children, function(c) {
      return c.classList && c.classList.contains("card") && c.dataset.dragType === "prod" && perId[c.dataset.dragId];
    });
    var prodSez = schede.map(function(c) { return perId[c.dataset.dragId]; });
    _dispGruppi(prodSez).forEach(function(g) {
      if (g.prodotti.length < 2) return;
      var schedeG = g.ids.map(function(id) {
        return schede.filter(function(c) { return c.dataset.dragId === id; })[0];
      }).filter(Boolean);
      if (schedeG.length < 2) return;
      var aperto = !!window._dispPrAperti[g.codice];
      var sg = _dispStatoGruppo(g.ids);

      // scheda di gruppo
      var gc = document.createElement("div");
      gc.className = "card disp-gruppo";
      gc.dataset.dragId = g.ids[0];          // spostandola si sposta tutto il gruppo
      gc.dataset.dragType = "prod";
      gc.style.cssText = "margin-bottom:7px;transition:outline .1s;border-left:4px solid var(--t,#C4622D)";
      var badge = sg === "misto"
        ? "<span style='font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;background:#fff3e0;color:#e65100'>⚠ Stati diversi</span>"
        : dispBadgeHTML(g.ids[0]);
      gc.innerHTML =
        "<div style='display:flex;align-items:center;gap:10px'>" +
          "<span style='font-size:17px;color:var(--txl);padding:6px 4px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;flex-shrink:0' class='_drag-handle-prod'>⠿</span>" +
          "<span style='font-size:24px;width:34px;text-align:center'>" + g.icona + "</span>" +
          "<div style='flex:1;min-width:0'>" +
            "<div style='font-size:14px;font-weight:700'>" + g.nome +
              " <span style='font-size:10.5px;font-weight:700;color:var(--txl);background:#f5ece1;border-radius:10px;padding:1px 7px;white-space:nowrap'>" + g.prodotti.length + " varianti</span></div>" +
            "<div style='font-size:11px;color:var(--txl);margin-top:2px'><span style='background:var(--cd);color:var(--br);font-weight:700;padding:1px 6px;border-radius:10px'>cod. " + g.codice + "</span></div>" +
            "<div style='margin-top:4px'>" + badge + "</div>" +
          "</div>" +
          "<button type='button' class='btn btn-s btn-sm' onclick=\"_dispPrApriGruppo('" + g.codice + "')\" style='white-space:nowrap'>Varianti " + (aperto ? "▾" : "▸") + "</button>" +
        "</div>" +
        (_dispIsAdmin() ? "<div style='padding:2px 0 0 0'>" +
          _dispFilaPulsanti(sg, "dispSetStatoGruppo(" + JSON.stringify(g.ids).replace(/"/g, "'") + ",", sg === "misto" ? "Tutte" : "") +
        "</div>" : "");
      var maniglia = gc.querySelector("._drag-handle-prod");
      maniglia.addEventListener("touchstart", function(ev) {
        window._dispGruppoTrascinato = g.ids.slice(); _dragStart(ev, "prod", g.ids[0]);
      }, { passive: false });
      maniglia.addEventListener("mousedown", function(ev) {
        window._dispGruppoTrascinato = g.ids.slice(); _dragStart(ev, "prod", g.ids[0]);
      });

      // contenitore delle schede delle varianti (rientrato)
      var dentro = document.createElement("div");
      dentro.className = "disp-gruppo-varianti";
      dentro.style.cssText = "margin:0 0 10px 18px;border-left:3px solid #e8d6bf;padding-left:8px;display:" + (aperto ? "block" : "none");
      sezione.insertBefore(gc, schedeG[0]);
      sezione.insertBefore(dentro, schedeG[0]);
      schedeG.forEach(function(c) { dentro.appendChild(c); });
    });
  });
}

function _dispPrApriGruppo(codice) {
  window._dispPrAperti[codice] = !window._dispPrAperti[codice];
  if (typeof renderProducts === "function") renderProducts();
}

// Dopo aver spostato una scheda di gruppo, le altre varianti seguono la prima (stesso ordine di prima)
function _dispCompattaGruppoTrascinato() {
  var ids = window._dispGruppoTrascinato;
  if (!ids || (typeof _drag !== "undefined" && _drag.active)) return;
  window._dispGruppoTrascinato = null;
  var primo = products.findIndex(function(p) { return p.id === ids[0]; });
  if (primo < 0) return;
  var prima = products.map(function(p) { return p.id; }).join(",");
  var altri = products.filter(function(p) { return ids.indexOf(p.id) > 0; })
    .sort(function(a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
  var resto = products.filter(function(p) { return ids.indexOf(p.id) <= 0; });
  var pos = resto.findIndex(function(p) { return p.id === ids[0]; });
  var nuovo = resto.slice(0, pos + 1).concat(altri, resto.slice(pos + 1));
  if (nuovo.map(function(p) { return p.id; }).join(",") === prima) return;
  products.length = 0;
  Array.prototype.push.apply(products, nuovo);
  lsSet("pf_products", products);
  renderProducts();
}

/* ══════════════════════════════════════════════════════════════════
   3. BADGE NELLA RICERCA PRODOTTI DEL MODULO ORDINE
   Solo per prodotti NON disponibili o DA CONFERMARE (quelli disponibili restano puliti)
   ══════════════════════════════════════════════════════════════════ */
function _dispBadgePiccolo(stato) {
  var c = _DISP_CFG[stato];
  return "<span style='font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;white-space:nowrap;" +
    "background:" + c.bg + ";color:" + c.color + "'>" + c.icon + " " + c.label + "</span>";
}

function _dispDecoraRicerca(forza) {
  // Righe prodotto (telefono e carrello schermo grande): div.pgrow con id "pgr-<pid>"
  document.querySelectorAll(".pgrow[id^='pgr-']").forEach(function(row) {
    var pid = row.id.slice(4);
    var stato = dispGetStato(pid);
    var old = row.querySelector(":scope > .disp-row-badge");
    if (old && !forza && old.dataset.stato === stato) return;
    if (old) old.remove();
    if (stato === "disponibile") return;
    var d = document.createElement("div");
    d.className = "disp-row-badge";
    d.dataset.stato = stato;
    d.style.cssText = "padding:4px 0 0 2px;line-height:1";
    d.innerHTML = _dispBadgePiccolo(stato);
    row.appendChild(d);
  });

  // Schermo grande: pulsanti delle varianti (onclick="o15AddProduct('pid')")
  document.querySelectorAll(".o15-vp-btn").forEach(function(btn) {
    var m = (btn.getAttribute("onclick") || "").match(/o15AddProduct\('([^']+)'\)/);
    if (!m) return;
    _dispPallino(btn, dispGetStato(m[1]), forza);
  });

  // Schermo grande: pulsanti con il codice prodotto (id "o15-btn-<codice>")
  if (typeof products !== "undefined" && Array.isArray(products)) {
    document.querySelectorAll(".o15-pcode[id^='o15-btn-']").forEach(function(btn) {
      var code = btn.id.slice(8);
      var gruppo = products.filter(function(p){ return String(p.code) === String(code); });
      if (!gruppo.length) return;
      var stati = gruppo.map(function(p){ return dispGetStato(p.id); });
      var stato = "disponibile";
      if (stati.every(function(s){ return s === "non_disponibile"; })) stato = "non_disponibile";
      else if (stati.some(function(s){ return s !== "disponibile"; })) stato = "da_confermare";
      _dispPallino(btn, stato, forza);
    });
  }
}

// Schermo grande: nessun pallino dentro i pulsanti (ottobre 2026).
// I prodotti NON disponibili hanno il pulsante sbiadito (per tutti, admin compreso);
// toccandolo compare comunque il messaggio alla commessa (vedi _dispControllaOrdine).
function _dispPallino(btn, stato, forza) {
  var old = btn.querySelector(":scope > .disp-dot");
  if (old) old.remove();
  var off = stato === "non_disponibile";
  if (btn.classList.contains("disp-off") !== off) btn.classList.toggle("disp-off", off);
}

// Ogni volta che la lista prodotti cambia (ricerca, aggiunte…) rimettiamo i badge
(function() {
  var _t = null;
  function _avvia() {
    if (!document.body) { setTimeout(_avvia, 200); return; }
    new MutationObserver(function(muts) {
      // ignora i cambiamenti fatti dai nostri stessi badge
      var utile = muts.some(function(m) {
        return Array.prototype.some.call(m.addedNodes, function(n) {
          return n.nodeType === 1 && !(n.classList && (n.classList.contains("disp-row-badge") || n.classList.contains("disp-dot")));
        });
      });
      if (!utile) return;
      clearTimeout(_t);
      _t = setTimeout(function(){ _dispDecoraRicerca(false); }, 40);
    }).observe(document.body, { childList: true, subtree: true });
  }
  _avvia();
})();

/* ══════════════════════════════════════════════════════════════════
   4. CONTROLLO DEI PRODOTTI AGGIUNTI ALL'ORDINE (solo commessa)
   ══════════════════════════════════════════════════════════════════ */

// Apertura ordine: memorizza i prodotti già presenti (ordine in modifica) → non verranno mai toccati
(function() {
  function _p() {
    if (typeof openOrderForm !== "function") { setTimeout(_p, 300); return; }
    var _o = openOrderForm;
    window.openOrderForm = function() {
      window._dispIniziali = {};
      window._dispAvvisati = {};
      _dispChiudiPopup();
      var r = _o.apply(this, arguments);
      try {
        if (typeof formItems !== "undefined" && Array.isArray(formItems)) {
          formItems.forEach(function(it) {
            if (it && it.productId) window._dispIniziali[_dispPid(it)] = true;
          });
        }
      } catch (e) {}
      return r;
    };
  }
  _p();
})();

function _dispPid(it) {
  return it._realPid || String(it.productId).replace(/__pz_tmp$/, "");
}

// Legge i prodotti con quantità > 0: carrello vero (formItems) + campi visibili sullo schermo
function _dispProdottiInseriti() {
  var mappa = {};
  try {
    if (typeof formItems !== "undefined" && Array.isArray(formItems)) {
      formItems.forEach(function(it) {
        if (!it || !it.productId) return;
        var q = parseFloat(it.qty) || 0;
        if (it.confezioni && it.confezioni.length) {
          q = Math.max(q, it.confezioni.reduce(function(s, c){ return s + (parseFloat(c && c.qty) || 0); }, 0));
        }
        if (q > 0) mappa[_dispPid(it)] = it.productName || "";
      });
    }
  } catch (e) {}
  document.querySelectorAll(".pgrow-qty[data-pid]").forEach(function(inp) {
    var pid = inp.dataset.pid;
    if (!pid || mappa[pid] !== undefined) return;
    if ((parseFloat(inp.value) || 0) <= 0) return;
    var row = inp.closest(".pgrow-conf-row");
    var nomeEl = row ? row.querySelector(".pgrow-name") : null;
    var testo = nomeEl ? nomeEl.textContent.trim() : "";
    var idx = testo.indexOf(" ");                 // formato "🍝 Nome"
    mappa[pid] = idx >= 0 ? testo.substring(idx + 1).trim() : testo;
  });
  return mappa;
}

function _dispNomeProdotto(pid, nomeTrovato) {
  try {
    if (typeof products !== "undefined") {
      var p = products.find(function(x){ return x.id === pid; });
      if (p) return p.name;
    }
  } catch (e) {}
  return nomeTrovato || pid;
}

// Toglie completamente un prodotto dall'ordine che si sta compilando
function _dispRimuoviDallOrdine(pid) {
  // PRIMA svuota le quantità e togli il cursore: se un campo perde il cursore con "1" dentro,
  // app.js rimetterebbe il prodotto nell'ordine
  document.querySelectorAll(".pgrow-qty[data-pid='" + pid + "']").forEach(function(inp){
    inp.value = "";
    if (document.activeElement === inp) { try { inp.blur(); } catch (e) {} }
  });
  try {
    if (typeof formItems !== "undefined" && Array.isArray(formItems)) {
      formItems = formItems.filter(function(x){ return !x || _dispPid(x) !== pid; });
    }
  } catch (e) {}
  if (window._o15Active) {
    // Schermo grande: la riga nel carrello va tolta del tutto
    var r15 = document.getElementById("pgr-" + pid); if (r15) r15.remove();
    try { if (typeof o15RefreshGridHighlight === "function") o15RefreshGridHighlight(pid); } catch (e) {}
    try { if (typeof o15RefreshCartEmptyState === "function") o15RefreshCartEmptyState(); } catch (e) {}
  } else {
    // Telefono: svuota le quantità della riga (resta nella lista di ricerca, vuota)
    document.querySelectorAll(".pgrow-qty[data-pid='" + pid + "']").forEach(function(inp){ inp.value = ""; inp.blur(); });
    var row = document.getElementById("pgr-" + pid); if (row) row.style.background = "";
  }
}

function _dispControllaOrdine() {
  if (window._dispInControllo) return;
  if (_dispIsAdmin()) return;                 // il laboratorio non riceve mai questi messaggi
  window._dispInControllo = true;
  try {
    var inseriti = _dispProdottiInseriti();
    var tolti = [], daConfermare = [];

    Object.keys(inseriti).forEach(function(pid) {
      if (window._dispIniziali[pid]) return;  // già nell'ordine salvato: promessa al cliente, non si tocca
      var stato = dispGetStato(pid);
      if (stato === "non_disponibile") {
        tolti.push({ pid: pid, nome: _dispNomeProdotto(pid, inseriti[pid]) });
      } else if (stato === "da_confermare" && !window._dispAvvisati[pid]) {
        window._dispAvvisati[pid] = true;
        daConfermare.push({ pid: pid, nome: _dispNomeProdotto(pid, inseriti[pid]) });
      }
    });

    if (tolti.length) {
      tolti.forEach(function(x){ _dispRimuoviDallOrdine(x.pid); });
      try { if (typeof fUpdateCart === "function") fUpdateCart(); } catch (e) {}
    }
    if (tolti.length || daConfermare.length) _dispMostraAvviso(tolti, daConfermare);
  } finally {
    window._dispInControllo = false;
  }
}

// Quando far partire il controllo
(function() {
  var _t = null;
  function programma(ms) { clearTimeout(_t); _t = setTimeout(_dispControllaOrdine, ms); }

  // mentre si scrive una quantità (telefono e tastierino schermo grande)
  ["input", "change"].forEach(function(evt) {
    document.addEventListener(evt, function(e) {
      if (e.target && e.target.classList && e.target.classList.contains("pgrow-qty")) programma(120);
    }, true);
  });

  // ogni volta che app.js aggiorna il carrello (aggiunte da schermo grande, ordini incollati…)
  function _patchCart() {
    if (typeof fUpdateCart !== "function") { setTimeout(_patchCart, 300); return; }
    var _o = fUpdateCart;
    window.fUpdateCart = function() {
      var r = _o.apply(this, arguments);
      if (!window._dispInControllo) programma(60);
      return r;
    };
  }
  _patchCart();
})();

/* ══════════════════════════════════════════════════════════════════
   5. MESSAGGIO ALLA COMMESSA (anteprime 2 e 3)
   ══════════════════════════════════════════════════════════════════ */
function _dispChiudiPopup() {
  document.querySelectorAll("[id='disp-avviso']").forEach(function(el){ el.remove(); });
}

function _dispMostraAvviso(tolti, daConfermare) {
  _dispChiudiPopup();
  var h = "";
  var nomi = function(lista){ return lista.map(function(x){ return "<b>" + x.nome + "</b>"; }).join(", "); };

  if (tolti.length) {
    h += "<div style='font-family:Playfair Display,serif;font-size:17px;color:var(--br,#5C3317);margin:0 0 10px'>🔴 " +
         (tolti.length > 1 ? "Prodotti non disponibili" : "Prodotto non disponibile") + "</div>" +
         "<p style='font-size:13.5px;line-height:1.45;margin:0 0 8px'>" + nomi(tolti) +
         (tolti.length > 1 ? " al momento non si possono ordinare." : " al momento non si può ordinare.") + "</p>" +
         "<p style='font-size:12.5px;color:var(--txl,#7A5C45);line-height:1.45;margin:0 0 14px'>" +
         (tolti.length > 1 ? "Non sono stati aggiunti" : "Non è stato aggiunto") +
         " all'ordine. Proponi un'alternativa al cliente.</p>";
  }
  if (daConfermare.length) {
    h += "<div style='font-family:Playfair Display,serif;font-size:17px;color:var(--br,#5C3317);margin:" + (tolti.length ? "6px" : "0") + " 0 10px'>🕐 " +
         (daConfermare.length > 1 ? "Prodotti da confermare" : "Prodotto da confermare") + "</div>" +
         "<p style='font-size:13.5px;line-height:1.45;margin:0 0 10px'>" + nomi(daConfermare) +
         (daConfermare.length > 1 ? " vanno confermati" : " va confermato") + " dal laboratorio.</p>" +
         "<p style='background:#fff8e1;border-radius:8px;padding:10px;color:#8a4a00;font-weight:700;font-size:13.5px;line-height:1.4;margin:0 0 14px'>" +
         "📞 Prima di confermare l'ordine al cliente, telefona al laboratorio.</p>";
  }
  var testoBtn = daConfermare.length ? "OK, telefono" : "OK";

  var ov = document.createElement("div");
  ov.id = "disp-avviso";
  ov.style.cssText = "position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;" +
    "padding:20px;background:rgba(0,0,0,0.45);";
  ov.innerHTML =
    "<div style='background:#fff;border-radius:16px;padding:20px 18px;width:100%;max-width:380px;" +
    "box-shadow:0 8px 40px rgba(0,0,0,.3);max-height:80vh;overflow-y:auto'>" + h +
    "<button type='button' class='disp-ok' style='width:100%;padding:13px;background:var(--t,#C4622D);color:#fff;border:none;" +
    "border-radius:10px;font-size:15px;font-weight:700;font-family:Lato,sans-serif;cursor:pointer;" +
    "-webkit-tap-highlight-color:transparent;touch-action:manipulation'>" + testoBtn + "</button></div>";
  document.body.appendChild(ov);

  var focusPid = daConfermare.length ? daConfermare[0].pid : null;
  var chiuso = false;
  function chiudi(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (chiuso) return; chiuso = true;
    ov.remove();
    // rimette il cursore sulla quantità del prodotto da confermare (utile col tastierino a schermo)
    if (focusPid) {
      var inp = document.getElementById("pgi-" + focusPid);
      if (inp) setTimeout(function(){ try { inp.focus(); } catch (x) {} }, 30);
    }
  }
  var btn = ov.querySelector(".disp-ok");
  btn.addEventListener("click", chiudi);
  btn.addEventListener("touchend", chiudi, { passive: false });
  ov.addEventListener("click", function(e){ if (e.target === ov) chiudi(e); });
}

/* ══════════════════════════════════════════════════════════════════
   6. RIEPILOGO PER IL LABORATORIO A INIZIO GIORNATA (anteprima 4)
   Solo admin, solo alla prima apertura del giorno su quel dispositivo,
   solo se c'è almeno un prodotto non disponibile o da confermare.
   ══════════════════════════════════════════════════════════════════ */
var _DISP_KEY_GIORNO = "disp_riepilogo_giorno";
window._dispRiepilogoLista = null;   // prodotti mostrati nel riepilogo aperto

function _dispOggi() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function _dispRiepilogoGiaVisto() {
  try { return localStorage.getItem(_DISP_KEY_GIORNO) === _dispOggi(); } catch (e) { return false; }
}

function _dispSegnaRiepilogoVisto() {
  try { localStorage.setItem(_DISP_KEY_GIORNO, _dispOggi()); } catch (e) {}
}

(function() {
  function _prova() {
    // Aspetta: profilo vero (non quello "admin" di default), dati disponibilità e prodotti
    if (!window._userProfile || !window._dispCaricato ||
        typeof products === "undefined" || !Array.isArray(products)) { setTimeout(_prova, 700); return; }
    if (!_dispIsAdmin()) return;
    if (_dispRiepilogoGiaVisto()) return;
    setTimeout(_dispMostraRiepilogo, 800); // lascia finire il caricamento dell'app
  }
  setTimeout(_prova, 1500);
})();

function _dispMostraRiepilogo() {
  if (document.getElementById("disp-riepilogo")) return;
  if (!_dispIsAdmin() || _dispRiepilogoGiaVisto()) return;
  // un gruppo (prodotto con le sue varianti) entra nel riepilogo se almeno una variante non è disponibile
  var lista = _dispGruppi(products).filter(function(g) {
    return _dispStatoPeggiore(g.ids) !== "disponibile";
  }).map(function(g) {
    g.statoIniziale = _dispStatoPeggiore(g.ids);
    return g;
  });
  if (!lista.length) return;                 // tutto disponibile: nessun popup
  window._dispRiepilogoLista = lista;
  window._dispRiepAperti = {};               // gruppi con l'elenco varianti aperto

  var ov = document.createElement("div");
  ov.id = "disp-riepilogo";
  ov.style.cssText = "position:fixed;inset:0;z-index:9300;display:flex;align-items:center;justify-content:center;" +
    "padding:18px;background:rgba(0,0,0,0.45);";
  ov.innerHTML =
    "<div style='background:#fff;border-radius:16px;padding:20px 18px;width:100%;max-width:420px;" +
    "box-shadow:0 8px 40px rgba(0,0,0,.3);max-height:85vh;overflow-y:auto'>" +
    "<div style='font-family:Playfair Display,serif;font-size:18px;color:var(--br,#5C3317);margin:0 0 6px'>☀️ Disponibilità di oggi</div>" +
    "<p style='font-size:12.5px;color:var(--txl,#7A5C45);margin:0 0 8px;line-height:1.4'>Controlla se è tutto giusto prima di iniziare. Tocca per cambiare lo stato.</p>" +
    "<div class='disp-riep-body'></div>" +
    "<button type='button' class='disp-riep-ok' style='width:100%;margin-top:14px;padding:13px;background:#3a7a2a;color:#fff;" +
    "border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:Lato,sans-serif;cursor:pointer;" +
    "-webkit-tap-highlight-color:transparent;touch-action:manipulation'>✅ Tutto giusto, chiudi</button></div>";
  document.body.appendChild(ov);
  _dispRenderRiepilogo();

  var btn = ov.querySelector(".disp-riep-ok");
  var chiuso = false;
  function chiudi(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (chiuso) return; chiuso = true;
    _dispSegnaRiepilogoVisto();
    window._dispRiepilogoLista = null;
    ov.remove();
  }
  btn.addEventListener("click", chiudi);
  btn.addEventListener("touchend", chiudi, { passive: false });
}

// Disegna le righe del riepilogo (i prodotti restano in lista anche dopo il cambio, per vedere cosa si è fatto)
function _dispRenderRiepilogo() {
  var ov = document.getElementById("disp-riepilogo");
  var lista = window._dispRiepilogoLista;
  if (!ov || !lista) return;
  var body = ov.querySelector(".disp-riep-body");

  var opts = [
    { stato:"disponibile",     t:"✅ Disp." },
    { stato:"non_disponibile", t:"🔴 Non disp." },
    { stato:"da_confermare",   t:"🕐 Da conf." }
  ];
  // fila di 3 pulsanti; azione = funzione chiamata con lo stato, piccoli = pulsanti delle singole varianti
  function pulsanti(attivo, azione, piccoli) {
    var h = "<div style='display:flex;gap:4px'>";
    opts.forEach(function(o) {
      var a = attivo === o.stato;
      h += "<button type='button' onclick=\"" + azione + "('" + o.stato + "')\" " +
        "style='flex:1;font-size:" + (piccoli ? "10.5px" : "11px") + ";font-weight:700;padding:" + (piccoli ? "5px 2px" : "7px 2px") + ";border-radius:8px;cursor:pointer;" +
        "border:1.5px solid " + (a ? "var(--br,#5C3317)" : "#e0cdb8") + ";background:" + (a ? "var(--br,#5C3317)" : "#fff") + ";" +
        "color:" + (a ? "#fff" : "var(--txl,#7A5C45)") + ";font-family:Lato,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:manipulation'>" + o.t + "</button>";
    });
    return h + "</div>";
  }
  var aperti = window._dispRiepAperti || {};

  function sezione(titolo, colore, items) {
    if (!items.length) return "";
    var h = "<div style='font-size:12px;font-weight:900;color:" + colore + ";margin:8px 0 2px'>" + titolo + " (" + items.length + ")</div>";
    items.forEach(function(g) {
      var multi = g.prodotti.length > 1;
      var sg = _dispStatoGruppo(g.ids);
      var aperto = !!aperti[g.chiave];
      h += "<div style='border-top:1px solid #f0e4d4;padding:9px 0'>" +
        "<div style='font-size:13px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap'>" +
          "<span>" + g.icona + " " + g.nome + "</span>";
      if (multi) {
        h += "<span style='font-size:10.5px;font-weight:700;color:var(--txl,#7A5C45);background:#f5ece1;border-radius:10px;padding:1px 7px'>" + g.prodotti.length + " varianti</span>" +
          "<button type='button' onclick=\"_dispRiepApriVarianti('" + g.chiave + "')\" " +
          "style='margin-left:auto;font-size:11px;font-weight:700;color:var(--br,#5C3317);background:#f5ece1;border:none;border-radius:8px;padding:4px 9px;cursor:pointer;" +
          "font-family:Lato,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:manipulation'>Varianti " + (aperto ? "▾" : "▸") + "</button>";
      }
      h += "</div>";
      if (multi && sg === "misto") {
        h += "<div style='font-size:11px;font-weight:700;color:#e65100;margin:-2px 0 6px'>⚠ stati diversi tra le varianti</div>";
      }
      h += pulsanti(sg, "_dispRiepCambiaGruppo.bind(null,'" + g.chiave + "')", false);
      if (multi && aperto) {
        h += "<div style='margin:8px 0 0 14px;border-left:3px solid #f0e4d4;padding-left:10px'>";
        g.prodotti.forEach(function(p) {
          h += "<div style='padding:6px 0'>" +
            "<div style='font-size:12px;font-weight:700;margin-bottom:4px;color:#4a3020'>" + _dispNomeVariante(p) + "</div>" +
            pulsanti(dispGetStato(p.id), "_dispRiepCambia.bind(null,'" + p.id + "')", true) +
          "</div>";
        });
        h += "</div>";
      }
      h += "</div>";
    });
    return h;
  }
  // raggruppati secondo lo stato che avevano all'apertura del riepilogo
  body.innerHTML =
    sezione("🔴 Non disponibili", "#c0392b", lista.filter(function(x){ return x.statoIniziale === "non_disponibile"; })) +
    sezione("🕐 Da confermare",   "#e65100", lista.filter(function(x){ return x.statoIniziale === "da_confermare"; }));
}

function _dispRiepCambia(pid, stato) {
  dispSetStato(pid, stato);
  _dispRenderRiepilogo();
}

// Pulsanti del gruppo: cambiano lo stato di tutte le varianti insieme
function _dispRiepCambiaGruppo(chiave, stato) {
  var g = (window._dispRiepilogoLista || []).find(function(x) { return x.chiave === chiave; });
  if (!g) return;
  dispSetStatoGruppo(g.ids, stato);
  _dispRenderRiepilogo();
}

// Apre / chiude l'elenco delle varianti di un gruppo
function _dispRiepApriVarianti(chiave) {
  window._dispRiepAperti = window._dispRiepAperti || {};
  window._dispRiepAperti[chiave] = !window._dispRiepAperti[chiave];
  _dispRenderRiepilogo();
}

// Se lo stato cambia da un altro dispositivo mentre il riepilogo è aperto, aggiorna i pulsanti
function _dispAggiornaRiepilogo() { _dispRenderRiepilogo(); }
