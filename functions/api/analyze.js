export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };

  try {
    const { jdText, cvType, cvContent, mimeType } = await request.json();

    if (!jdText || !cvContent) {
      return new Response(JSON.stringify({ error: "Missing required JD or CV data strings." }), { status: 400, headers });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing backend API credentials configuration." }), { status: 500, headers });
    }

    const partsArray = [
      { text: `Analyze the attached CV/Resume against the target Job Description below:\n\n[JOB DESCRIPTION]\n${jdText.slice(0, 6000)}\n\nPerform a deep semantic assessment.` }
    ];

    if (cvType === 'file' && mimeType === 'application/pdf') {
      partsArray.push({
        inline_data: {
          mime_type: mimeType,
          data: cvContent
        }
      });
    } else {
      partsArray.push({ text: `[USER CV/RESUME CONTENT]\n${cvContent.slice(0, 10000)}` });
    }

    const geminiPayload = {
      contents: [{ role: "user", parts: partsArray }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1200,
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit. Retrying pipeline cycle..." }), { status: 429, headers });
      }
      throw new Error(`Upstream Engine Error: ${response.status}`);
    }

    const output = await response.json();
    return new Response(output.candidates[0].content.parts[0].text, { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Edge processing runtime failure.", details: err.message }), { status: 500, headers });
  }
}
