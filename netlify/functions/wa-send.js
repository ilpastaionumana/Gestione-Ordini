// netlify/functions/wa-send.js
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// ─────────────────────────────────────────────────────────────
// SMISTATORE MESSAGGI (ottobre 2026)
// Meta dal 13/10/2027 accetta i modelli MARKETING solo dal canale
// "Marketing Messages API" (/marketing_messages). Gli altri modelli
// (utilità, servizio) restano sul canale di sempre (/messages).
// Prima di ogni invio chiediamo a Meta la categoria del modello e
// scegliamo il canale giusto. Finché l'iscrizione al nuovo canale non
// è completa, Meta stesso rimanda i messaggi sul canale di sempre
// (product_policy CLOUD_API_FALLBACK): quindi funziona da subito.
// ─────────────────────────────────────────────────────────────
const GRAPH_NEW = "https://graph.facebook.com/v23.0";
const CATEGORY_TTL_MS = 60 * 60 * 1000; // ricontrolla la categoria ogni ora
const categoryCache = {};               // { nomeModello: { cat, at } }
let wabaIdCache = null;

// Trova l'ID dell'account WhatsApp Business: prima dalla variabile
// WA_WABA_ID su Netlify (se impostata), altrimenti lo chiede a Meta dal token.
async function getWabaId(token) {
  if (process.env.WA_WABA_ID) return process.env.WA_WABA_ID;
  if (wabaIdCache) return wabaIdCache;
  try {
    const r = await fetch(`${GRAPH_NEW}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`);
    const d = await r.json();
    const scopes = (d && d.data && d.data.granular_scopes) || [];
    const sc = scopes.find(x => x.scope === "whatsapp_business_management" && x.target_ids && x.target_ids.length)
            || scopes.find(x => x.scope === "whatsapp_business_messaging" && x.target_ids && x.target_ids.length);
    if (sc) wabaIdCache = sc.target_ids[0];
  } catch (e) { console.log("WABA lookup error:", e.message); }
  return wabaIdCache;
}

// Restituisce "MARKETING", "UTILITY", "AUTHENTICATION" oppure null se non riesce a saperlo.
async function getTemplateCategory(token, name) {
  const c = categoryCache[name];
  if (c && Date.now() - c.at < CATEGORY_TTL_MS) return c.cat;
  try {
    const waba = await getWabaId(token);
    if (!waba) return null;
    const r = await fetch(`${GRAPH_NEW}/${waba}/message_templates?name=${encodeURIComponent(name)}&fields=name,category,language,status&limit=50`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const d = await r.json();
    const list = (d && d.data) || [];
    const t = list.find(x => x.name === name && x.language === "it") || list.find(x => x.name === name);
    if (!t || !t.category) return null;
    categoryCache[name] = { cat: t.category, at: Date.now() };
    return t.category;
  } catch (e) {
    console.log("Template category lookup error:", e.message);
    return null;
  }
}

async function postToMeta(url, token, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { status: res.status, data };
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { phoneId, token, to, template, components, message } = body;

  if (!phoneId || !token || !to) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  let payload;

  if (template) {
    payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: { name: template, language: { code: "it" } }
    };

    // Aggiunge componenti body solo se ci sono parametri
    if (components && components.length > 0) {
      // Estrae i parametri dal primo componente body (se passati già formattati)
      // oppure costruisce il componente body direttamente dai parametri
      const firstComp = components[0];
      if (firstComp.type === "body" && firstComp.parameters) {
        payload.template.components = [{
          type: "body",
          parameters: firstComp.parameters
        }];
      } else {
        // fallback: assume che components sia array di parametri diretti
        payload.template.components = [{
          type: "body",
          parameters: components
        }];
      }
    }

  } else if (message) {
    payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: message }
    };
  } else {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing template or message" }) };
  }

  // Log del payload per debug
  console.log("WA payload:", JSON.stringify(payload));

  try {
    const cloudUrl = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const marketingUrl = `${GRAPH_NEW}/${phoneId}/marketing_messages`;

    // Solo i modelli possono essere marketing; i messaggi di testo libero vanno sempre sul canale di sempre.
    const category = template ? await getTemplateCategory(token, template) : null;
    let route = (category === "MARKETING") ? "marketing" : "cloud";
    console.log("WA route:", template || "(testo)", category, "→", route);

    let result;
    if (route === "marketing") {
      result = await postToMeta(marketingUrl, token, {
        ...payload,
        recipient_type: "individual",
        product_policy: "CLOUD_API_FALLBACK"
      });
      // Se il nuovo canale rifiuta (es. il modello non è più marketing), riprova sul canale di sempre.
      if (result.data && result.data.error) {
        console.log("Marketing channel error, retry on Cloud API:", JSON.stringify(result.data.error));
        delete categoryCache[template];
        route = "cloud";
        result = await postToMeta(cloudUrl, token, payload);
      }
    } else {
      result = await postToMeta(cloudUrl, token, payload);
      // Rete di sicurezza: se Meta rifiuta perché il modello è (diventato) marketing, riprova sul nuovo canale.
      const err = result.data && result.data.error;
      if (template && err && /marketing/i.test(err.message || "")) {
        console.log("Cloud API refused marketing template, retry on Marketing Messages API:", JSON.stringify(err));
        route = "marketing";
        result = await postToMeta(marketingUrl, token, {
          ...payload,
          recipient_type: "individual",
          product_policy: "CLOUD_API_FALLBACK"
        });
      }
    }

    console.log("WA response:", route, result.status, JSON.stringify(result.data));
    return {
      statusCode: result.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(result.data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
