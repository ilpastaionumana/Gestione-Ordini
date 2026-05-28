// netlify/functions/wa-send.js
// Proxy per Meta WhatsApp Cloud API — supporta template con e senza componenti

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { phoneId, token, to, template, components, message } = body;

  if (!phoneId || !token || !to) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  // Costruisce il payload per Meta API
  let payload;

  if (template) {
    // Invio tramite template approvato
    const templatePayload = {
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: {
        name: template,
        language: { code: "it" }
      }
    };

    // Aggiunge componenti (parametri variabili) se presenti
    if (components && components.length > 0) {
      templatePayload.template.components = components;
    }

    payload = templatePayload;

  } else if (message) {
    // Invio testo libero (solo per sessioni aperte — modalità Live)
    payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: message }
    };

  } else {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing template or message" }) };
  }

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

    return {
      statusCode: res.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
