export async function onRequestPost({ request, env }) {
  // 1. Enforce Production Security Headers (CORS & Security Hardening)
  const headers = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };

  try {
    const { jdText, cvBase64, mimeType } = await request.json();

    // 2. Fail Fast Payload Validations
    if (!jdText || !cvBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Malformed payload. Missing required fields." }), { status: 400, headers });
    }

    if (mimeType !== "application/pdf") {
      return new Response(JSON.stringify({ error: "Unsupported document format. Only PDF payloads are accepted." }), { status: 400, headers });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "API Gateway configuration error. Missing credentials." }), { status: 500, headers });
    }

    // 3. Construct System Prompt using System Instructions to enforce strict JSON structure
    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `Analyze the attached CV against the target Job Description below:\n\n[JOB DESCRIPTION]\n${jdText}\n\nPerform a deep semantic assessment.` },
            {
              inline_data: {
                mime_type: mimeType,
                data: cvBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseSchema: {
          type: "OBJECT",
          properties: {
            matchPercentage: { type: "INTEGER" },
            missingKeywords: { type: "ARRAY", items: { type: "STRING" } },
            strengths: { type: "ARRAY", items: { type: "STRING" } },
            recommendation: { type: "STRING" }
          },
          required: ["matchPercentage", "missingKeywords", "strengths", "recommendation"]
        }
      }
    };

    // 4. Downstream API Fetch to Gemini Engine
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const targetResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    // 5. Handle Upstream Volatility & Rate-Limits
    if (!targetResponse.ok) {
      if (targetResponse.status === 429) {
        return new Response(JSON.stringify({ error: "The scanner is currently handling a massive wave of users. Retrying automated queue cycle..." }), { status: 429, headers });
      }
      const rawErr = await targetResponse.text();
      throw new Error(`Upstream Engine Error: ${targetResponse.status} - ${rawErr}`);
    }

    const output = await targetResponse.json();
    const cleanOutputText = output.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!cleanOutputText) {
      throw new Error("Invalid structure returned from execution engine.");
    }

    // Return pure validated JSON directly back to the client
    return new Response(cleanOutputText, { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Critical edge runtime failure encountered.", details: err.message }), { status: 500, headers });
  }
}
