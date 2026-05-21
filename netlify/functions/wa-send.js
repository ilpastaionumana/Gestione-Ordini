const https = require("https");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { phoneId, token, to, message, template } = JSON.parse(event.body);

    let payload;
    if (template) {
      // Invia template (es. hello_world per test)
      payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: template,
          language: { code: "en_US" }
        }
      };
    } else {
      // Invia testo libero
      payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: message }
      };
    }

    const postData = JSON.stringify(payload);

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: "graph.facebook.com",
        path: `/v19.0/${phoneId}/messages`,
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });

    return {
      statusCode: result.status,
      headers: { ...headers, "Content-Type": "application/json" },
      body: result.body
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ error: { message: e.message } })
    };
  }
};
