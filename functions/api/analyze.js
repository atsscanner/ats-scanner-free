import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';

// Cloudflare Workers handler using fetch API
export default async function handler(request, env) {
    // 1. CORS & Method Validation
    // Validate GEMINI_API_KEY is configured
    if (!env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY environment variable not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed. Engine requires POST requests.' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        // Initialize the Enterprise LLM Engine with proper API key from Cloudflare env
        const ai = new GoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
        
        // Parse request body
        const { jdText, cvType, cvContent, mimeType } = await request.json();

        // 2. Payload Validation
        if (!jdText || !cvContent) {
            return new Response(JSON.stringify({ error: 'Missing mandatory target job description or CV payload.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        let candidateText = "";

        // 3. Document Extraction Matrix
        if (cvType === 'file' && mimeType === 'application/pdf') {
            // Buffer size calculation to protect against serverless memory/timeout crashes
            const base64Size = Buffer.byteLength(cvContent, 'base64');
            
            // Hard cap at ~4.5MB to ensure stable Cloudflare execution
            if (base64Size > 4.5 * 1024 * 1024) {
                return new Response(JSON.stringify({ error: 'Payload exceeds 4.5MB serverless processing limits.' }), {
                    status: 413,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Convert Base64 back to binary buffer for pdf-parse
            const pdfBuffer = Buffer.from(cvContent, 'base64');
            const pdfData = await pdfParse(pdfBuffer);
            candidateText = pdfData.text;
        } else {
            // Text paste or DOCX (which was pre-parsed by Mammoth.js on the client)
            candidateText = cvContent;
        }

        // 4. Prompt Engineering Architecture
        // We instruct the model to act as a strict system and enforce a JSON-only response schema
        const systemPrompt = `You are a strict, enterprise-grade Applicant Tracking System (ATS) Evaluator. 
Compare the candidate's resume text against the job description.
You must output ONLY valid JSON matching this exact schema without markdown formatting blocks:
{
    "matchPercentage": Number (integer between 0-100 representing alignment),
    "recommendation": String (2-3 sentences of strategic advice on how to improve the profile),
    "strengths": Array of Strings (3-5 key matched skills, tools, or requirements),
    "missingKeywords": Array of Strings (3-5 critical missing skills, certs, or requirements)
}`;

        // 5. LLM Execution Engine
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const response = await model.generateContent({
            contents: [
                { 
                    role: 'user', 
                    parts: [{ text: `${systemPrompt}\n\n---JOB DESCRIPTION---\n${jdText}\n\n---CANDIDATE RESUME---\n${candidateText}` }] 
                }
            ],
            generationConfig: {
                // Force JSON compliance at the API level
                responseMimeType: "application/json",
                // Low temperature for highly deterministic, analytical scoring
                temperature: 0.1 
            }
        });

        // 6. Response Mapping
        const responseText = response.response.text();
        const resultData = JSON.parse(responseText);
        return new Response(JSON.stringify(resultData), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (error) {
        console.error('ATS Engine Execution Exception:', error);
        
        // Return a clean error to the frontend error handler
        return new Response(JSON.stringify({ 
            error: 'Internal evaluation exception. Ensure document is not password protected or corrupted.' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
