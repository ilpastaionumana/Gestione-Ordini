// netlify/functions/wa-send.js
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

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
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json();
    console.log("WA response:", res.status, JSON.stringify(data));
    return {
      statusCode: res.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
