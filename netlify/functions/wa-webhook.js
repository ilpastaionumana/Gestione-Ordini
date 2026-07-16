// netlify/functions/wa-webhook.js
//
// Riceve i messaggi WhatsApp in arrivo dai clienti (webhook Meta Cloud API),
// li salva su Firestore (collection "wa_messages") e mantiene aggiornata
// la collection "wa_conversations" (un documento per numero di telefono,
// usato dall'app per mostrare l'elenco chat con badge non letti e per
// gestire l'assegnazione del punto vendita).
//
// Se un numero non è ancora riconosciuto in anagrafica (customerId null),
// il webhook manda automaticamente al cliente un menu a lista con i 4 punti
// vendita, e ne legge la risposta per assegnare il pv alla conversazione.
// Il menu viene rimandato al massimo una seconda volta se il cliente non
// risponde toccando una voce del menu; oltre a questo la conversazione resta
// "in attesa" e va assegnata manualmente dall'admin nell'app.
//
// Nessuna dipendenza npm: usa solo moduli nativi di Node (crypto, fetch globale)
// per autenticarsi su Firestore tramite REST API con un Service Account.
//
// VARIABILI D'AMBIENTE RICHIESTE (da impostare su Netlify):
//   FB_CLIENT_EMAIL   -> "client_email" dal file JSON del Service Account Firebase
//   FB_PRIVATE_KEY    -> "private_key" dal file JSON del Service Account Firebase
//   WA_VERIFY_TOKEN   -> stringa a scelta, deve coincidere con quella inserita su Meta

const crypto = require("crypto");

const PROJECT_ID = "il-pastaio-b8d61";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GRAPH_API_VERSION = "v19.0";

// ── Punti vendita: stessa lista/alias di index.html (PUNTI / _PV_ALIAS / _normPV) ──
const PUNTI = ["NUMANA", "OSIMO STAZIONE", "SIROLO", "ANCONA"];
const PV_ALIAS = { OSIMO: "OSIMO STAZIONE", NUM: "NUMANA", OSI: "OSIMO STAZIONE", SIR: "SIROLO", ANC: "ANCONA" };
function normPV(s) {
  if (!s) return null;
  const u = String(s).trim().replace(/\s+/g, " ").toUpperCase();
  return PV_ALIAS[u] || u;
}

// ── Righe del menu a lista mandato ai contatti non ancora assegnati a un PV ──
const PV_LIST_ROWS = [
  { id: "pv_numana", title: "Numana" },
  { id: "pv_osimo", title: "Osimo Stazione" },
  { id: "pv_sirolo", title: "Sirolo" },
  { id: "pv_ancona", title: "Ancona" }
];
const PV_ID_TO_NAME = { pv_numana: "NUMANA", pv_osimo: "OSIMO STAZIONE", pv_sirolo: "SIROLO", pv_ancona: "ANCONA" };

// Numero massimo di volte che rimandiamo il menu se il cliente non risponde toccandolo
const MAX_PV_PROMPTS = 2;

// ── Normalizza numero telefono: stessa logica di normPhone() in index.html ──
function normPhone(p) {
  if (!p) return "";
  p = String(p).replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("0")) p = "39" + p.slice(1);
  else if (p.length === 10 && !p.startsWith("39")) p = "39" + p;
  else if (p.length === 9) p = "39" + p;
  return p;
}

// ── Base64url helper per JWT ──
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Crea e firma un JWT RS256 per l'autenticazione Service Account (Google OAuth2) ──
function createServiceAccountJWT(clientEmail, privateKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const signInput = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claim));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();
  const signature = signer.sign(privateKey);
  const encSig = signature
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return signInput + "." + encSig;
}

// ── Scambia il JWT per un access token OAuth2 valido per le API Google ──
async function getAccessToken() {
  const clientEmail = process.env.FB_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FB_PRIVATE_KEY || "";
  // Su Netlify le variabili multilinea vengono spesso salvate con \n letterali: li ripristiniamo
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("FB_CLIENT_EMAIL o FB_PRIVATE_KEY mancanti nelle variabili d'ambiente");
  }

  const jwt = createServiceAccountJWT(clientEmail, privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=" +
      encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" +
      jwt
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Impossibile ottenere access token: " + JSON.stringify(data));
  }
  return data.access_token;
}

// ── Conversione valori JS -> formato tipizzato Firestore REST ──
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  return { stringValue: String(v) };
}
function toFirestoreFields(obj) {
  const fields = {};
  Object.keys(obj).forEach(function (k) {
    fields[k] = toFirestoreValue(obj[k]);
  });
  return fields;
}

// ── Conversione valore tipizzato Firestore REST -> valore JS ──
function fromFirestoreValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  return null; // nullValue o tipo non gestito
}
function fromFirestoreFields(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(function (k) {
    out[k] = fromFirestoreValue(fields[k]);
  });
  return out;
}

// ── Legge un singolo documento Firestore per path completo (collection/docId). null se non esiste ──
async function getDocument(path, accessToken) {
  const url = FIRESTORE_BASE + "/" + path;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("Errore lettura Firestore " + path, res.status);
    return null;
  }
  const data = await res.json();
  return fromFirestoreFields(data.fields);
}

// ── Scrive (sovrascrivendo per intero) un documento Firestore per path completo ──
async function setDocument(path, obj, accessToken) {
  const url = FIRESTORE_BASE + "/" + path;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(obj) })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Errore scrittura Firestore " + path, res.status, errText);
  }
}

// ── Cerca un cliente su Firestore per un campo esatto (phone oppure bsuid) ──
async function queryCustomerIdByField(field, value, accessToken) {
  if (!value) return null;
  const url = FIRESTORE_BASE + ":runQuery";
  const body = {
    structuredQuery: {
      from: [{ collectionId: "customers" }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: "EQUAL",
          value: { stringValue: value }
        }
      },
      limit: 1
    }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) return null;
  const data = await res.json();
  const match = Array.isArray(data) ? data.find(function (r) { return r.document; }) : null;
  if (!match) return null;
  const name = match.document.name || "";
  const id = name.split("/").pop();
  return id || null;
}

// ── Fallback: prima match per telefono, poi per bsuid ──
async function findCustomerId(phone, waId, accessToken) {
  var id = await queryCustomerIdByField("phone", phone, accessToken);
  if (id) return id;
  id = await queryCustomerIdByField("bsuid", waId, accessToken);
  return id;
}

// ── Legge il pv (normalizzato) di un cliente già in anagrafica, se presente ──
async function getCustomerPV(customerId, accessToken) {
  if (!customerId) return null;
  const doc = await getDocument("customers/" + encodeURIComponent(customerId), accessToken);
  if (!doc || !doc.pv) return null;
  return normPV(doc.pv);
}

// ── Legge token+phoneId dell'account WhatsApp da settings/wa_config ──
async function getWaConfig(accessToken) {
  const doc = await getDocument("settings/wa_config", accessToken);
  if (!doc || !doc.token || !doc.phoneId) return null;
  return { token: doc.token, phoneId: doc.phoneId };
}

// ── Estrae tipo e testo "leggibile" da un messaggio Meta in arrivo ──
function extractMsgContent(msg) {
  const type = msg.type || "unknown";
  let text = null;
  let listReplyId = null;
  if (type === "text" && msg.text) text = msg.text.body;
  else if (type === "button" && msg.button) text = msg.button.text;
  else if (type === "interactive" && msg.interactive) {
    if (msg.interactive.list_reply) {
      text = msg.interactive.list_reply.title || null;
      listReplyId = msg.interactive.list_reply.id || null;
    } else if (msg.interactive.button_reply) {
      text = msg.interactive.button_reply.title || null;
    }
  }
  return { type, text, listReplyId };
}

// ── Manda al cliente il menu a lista per scegliere il punto vendita ──
async function sendPvListMessage(phoneId, token, to) {
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Ciao! 👋 Per quale punto vendita scrivi? Scegli dal menu qui sotto:" },
      action: {
        button: "Scegli negozio",
        sections: [{ title: "Punti vendita", rows: PV_LIST_ROWS }]
      }
    }
  };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Errore invio menu PV:", res.status, errText);
    }
  } catch (e) {
    console.error("Errore invio menu PV:", e.message);
  }
}

// ── Salva un singolo messaggio in arrivo su Firestore (upsert per wamid = idempotente) ──
async function saveMessage(msg, contacts, accessToken) {
  const waId = msg.from || "";
  const phone = normPhone(waId);
  const contact = (contacts || []).find(function (c) { return c.wa_id === waId; });
  const profileName = (contact && contact.profile && contact.profile.name) || null;

  const { type, text, listReplyId } = extractMsgContent(msg);
  const customerId = await findCustomerId(phone, waId, accessToken);

  const docFields = toFirestoreFields({
    from: phone,
    fromRaw: waId,
    profileName: profileName,
    type: type,
    text: text,
    timestamp: msg.timestamp ? parseInt(msg.timestamp, 10) : null,
    receivedAt: new Date().toISOString(),
    direction: "in",
    customerId: customerId,
    pv: null,
    read: false
  });

  const url = FIRESTORE_BASE + "/wa_messages/" + encodeURIComponent(msg.id);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: docFields })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Errore salvataggio Firestore wa_messages:", res.status, errText);
  }

  return { phone, waId, profileName, customerId, type, text, listReplyId };
}

// ── Aggiorna (o crea) il riepilogo conversazione per questo numero, e gestisce l'assegnazione PV ──
async function upsertConversation(info, msg, accessToken) {
  const { phone, waId, profileName, customerId, listReplyId } = info;
  const convPath = "wa_conversations/" + encodeURIComponent(phone);
  const inboundTs = msg.timestamp ? parseInt(msg.timestamp, 10) * 1000 : Date.now();

  let conv = await getDocument(convPath, accessToken);
  if (!conv) {
    conv = {
      phone: phone,
      profileName: profileName || null,
      customerId: customerId || null,
      pv: null,
      pvStatus: "pending",
      lastMessageText: null,
      lastMessageAt: 0,
      lastInboundAt: 0,
      unreadCount: 0,
      pvPromptCount: 0
    };
    // Se il numero è già un cliente noto con pv in anagrafica, assegna subito senza chiedere nulla
    const custPv = await getCustomerPV(customerId, accessToken);
    if (custPv) {
      conv.pv = custPv;
      conv.pvStatus = "assigned";
    }
  }

  // Risposta al menu: assegna il pv scelto dal cliente
  if (conv.pvStatus === "pending" && listReplyId && PV_ID_TO_NAME[listReplyId]) {
    conv.pv = PV_ID_TO_NAME[listReplyId];
    conv.pvStatus = "assigned";
  }

  // Se nel frattempo il cliente è stato collegato/aggiornato in anagrafica con un pv, riallinea
  if (conv.pvStatus === "pending" && customerId && !listReplyId) {
    const custPv = await getCustomerPV(customerId, accessToken);
    if (custPv) {
      conv.pv = custPv;
      conv.pvStatus = "assigned";
    }
  }

  conv.customerId = customerId || conv.customerId || null;
  conv.profileName = profileName || conv.profileName || null;
  conv.lastMessageText = info.text;
  conv.lastMessageAt = inboundTs;
  conv.lastInboundAt = inboundTs;
  conv.unreadCount = (conv.unreadCount || 0) + 1;

  // Se ancora senza pv, e non era questo il messaggio di risposta al menu, valuta se ri-mandarlo
  if (conv.pvStatus === "pending" && !listReplyId && (conv.pvPromptCount || 0) < MAX_PV_PROMPTS) {
    const cfg = await getWaConfig(accessToken);
    if (cfg) {
      await sendPvListMessage(cfg.phoneId, cfg.token, waId);
      conv.pvPromptCount = (conv.pvPromptCount || 0) + 1;
    }
  }

  await setDocument(convPath, conv, accessToken);
}

// ── Elabora l'intero payload del webhook Meta (può contenere più entry/messaggi) ──
async function processWebhook(body) {
  if (body.object !== "whatsapp_business_account") return;
  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const messages = value.messages || [];
      if (!messages.length) continue; // status update (delivered/read/sent): ignorato per ora
      const contacts = value.contacts || [];
      const accessToken = await getAccessToken();
      for (const msg of messages) {
        const info = await saveMessage(msg, contacts, accessToken);
        await upsertConversation(info, msg, accessToken);
      }
    }
  }
}

exports.handler = async function (event) {
  // ── Verifica webhook (chiamata GET fatta da Meta in fase di configurazione) ──
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];
    if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
      return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: challenge || "" };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    // Rispondiamo comunque 200 per non far ritentare Meta all'infinito su payload malformati
    return { statusCode: 200, body: "ignored" };
  }

  try {
    await processWebhook(body);
  } catch (err) {
    // Logghiamo l'errore ma rispondiamo comunque 200: se rispondiamo con errore,
    // Meta ritenta a raffica lo stesso webhook per ore
    console.error("wa-webhook error:", err);
  }

  return { statusCode: 200, body: "EVENT_RECEIVED" };
};
