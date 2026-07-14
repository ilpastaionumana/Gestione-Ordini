// netlify/functions/wa-webhook.js
//
// Riceve i messaggi WhatsApp in arrivo dai clienti (webhook Meta Cloud API)
// e li salva su Firestore, collection "wa_messages".
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

// ── Salva un singolo messaggio in arrivo su Firestore (upsert per wamid = idempotente) ──
async function saveMessage(msg, contacts, accessToken) {
  const waId = msg.from || "";
  const phone = normPhone(waId);
  const contact = (contacts || []).find(function (c) { return c.wa_id === waId; });
  const profileName = (contact && contact.profile && contact.profile.name) || null;

  const type = msg.type || "unknown";
  let text = null;
  if (type === "text" && msg.text) text = msg.text.body;
  else if (type === "button" && msg.button) text = msg.button.text;
  else if (type === "interactive" && msg.interactive) {
    text =
      (msg.interactive.button_reply && msg.interactive.button_reply.title) ||
      (msg.interactive.list_reply && msg.interactive.list_reply.title) ||
      null;
  }

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
        await saveMessage(msg, contacts, accessToken);
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
