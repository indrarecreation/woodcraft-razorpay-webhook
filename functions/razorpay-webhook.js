export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "WOODCRAFT Razorpay webhook receiver is online.",
      appsScript: "configured"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

export async function onRequestPost({ request, env }) {
  try {
    // Read the RAW Razorpay request body.
    // This must remain unchanged for signature verification.
    const rawBody = await request.text();

    // Get Razorpay's signature.
    const razorpaySignature =
      request.headers.get("X-Razorpay-Signature");

    if (!razorpaySignature) {
      return jsonResponse(
        {
          success: false,
          error: "Missing Razorpay signature."
        },
        400
      );
    }

    // Get Razorpay webhook secret from Cloudflare.
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return jsonResponse(
        {
          success: false,
          error: "Webhook secret is not configured."
        },
        500
      );
    }

    // Create HMAC SHA-256 signature.
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );

    const calculatedSignature =
      bufferToHex(signatureBuffer);

    // Verify Razorpay signature.
    if (!safeEqual(
      calculatedSignature,
      razorpaySignature
    )) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid Razorpay webhook signature."
        },
        401
      );
    }

    // Razorpay signature verified.
    const event = JSON.parse(rawBody);

    console.log(
      "Verified Razorpay webhook:",
      event.event
    );

    // Apps Script backend.
    const appsScriptUrl =
      "https://script.google.com/macros/s/AKfycbwAx9mO8Zp3laWdzDN_MD3b7azHuKWXPX5_KsXrofFxq2nbWoNb-3qB28CZimpnCIsGuA/exec";

    // Secret used between Cloudflare and Apps Script.
    const forwardSecret =
      env.RAZORPAY_WEBHOOK_FORWARD_SECRET;

    if (!forwardSecret) {
      return jsonResponse(
        {
          success: false,
          error:
            "Apps Script forwarding secret is not configured."
        },
        500
      );
    }

    const forwardPayload = {
      action: "handleRazorpayWebhook",
      forwardingSecret: forwardSecret,
      event: event
    };

    // Forward verified webhook to Apps Script.
    const appsScriptResponse = await fetch(
      appsScriptUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(forwardPayload)
      }
    );

    const appsScriptText =
      await appsScriptResponse.text();

    console.log(
      "Apps Script response:",
      appsScriptText
    );

    // First check HTTP response.
    if (!appsScriptResponse.ok) {
      return jsonResponse(
        {
          success: false,
          error:
            "Apps Script rejected the webhook.",
          appsScriptStatus:
            appsScriptResponse.status
        },
        502
      );
    }

    // Apps Script may return HTTP 200 with success:false.
    // Parse the actual response to make sure processing succeeded.
    let appsScriptResult;

    try {
      appsScriptResult =
        JSON.parse(appsScriptText);
    } catch (parseError) {
      return jsonResponse(
        {
          success: false,
          error:
            "Invalid response received from Apps Script.",
          appsScriptResponse:
            appsScriptText
        },
        502
      );
    }

    // IMPORTANT:
    // Do not tell Razorpay the webhook succeeded
    // unless Apps Script explicitly reports success:true.
    if (
      !appsScriptResult ||
      appsScriptResult.success !== true
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Apps Script reported webhook processing failure.",
          appsScriptResult:
            appsScriptResult
        },
        502
      );
    }

    // Everything succeeded.
    return jsonResponse({
      success: true,
      message:
        "Razorpay webhook verified and successfully processed.",
      appsScript:
        appsScriptResult
    });

  } catch (error) {

    console.error(
      "Webhook error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error: error.message
      },
      500
    );
  }
}


function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);

  return Array.from(bytes)
    .map(byte =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}


function safeEqual(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}


function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status: status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
