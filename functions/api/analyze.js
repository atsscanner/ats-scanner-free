import { GoogleGenAI } from '@google/genai';
import pdfParse from 'pdf-parse';

// Initialize the Enterprise LLM Engine
// Assumes GEMINI_API_KEY is configured in your deployment environment secrets
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    // 1. CORS & Method Validation
    // Adjust Access-Control headers if your frontend is hosted on a different domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Engine requires POST requests.' });
    }

    try {
        const { jdText, cvType, cvContent, mimeType } = req.body;

        // 2. Payload Validation
        if (!jdText || !cvContent) {
            return res.status(400).json({ error: 'Missing mandatory target job description or CV payload.' });
        }

        let candidateText = "";

        // 3. Document Extraction Matrix
        if (cvType === 'file' && mimeType === 'application/pdf') {
            // Buffer size calculation to protect against serverless memory/timeout crashes
            const base64Size = Buffer.byteLength(cvContent, 'base64');
            
            // Hard cap at ~4.5MB to ensure stable Vercel/Cloudflare execution
            if (base64Size > 4.5 * 1024 * 1024) {
                return res.status(413).json({ error: 'Payload exceeds 4.5MB serverless processing limits.' });
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { 
                    role: 'user', 
                    parts: [{ text: `${systemPrompt}\n\n---JOB DESCRIPTION---\n${jdText}\n\n---CANDIDATE RESUME---\n${candidateText}` }] 
                }
            ],
            config: {
                // Force JSON compliance at the API level
                responseMimeType: "application/json",
                // Low temperature for highly deterministic, analytical scoring
                temperature: 0.1 
            }
        });

        // 6. Response Mapping
        const resultData = JSON.parse(response.text());
        return res.status(200).json(resultData);

    } catch (error) {
        console.error('ATS Engine Execution Exception:', error);
        
        // Return a clean error to the frontend error handler
        return res.status(500).json({ 
            error: 'Internal evaluation exception. Ensure document is not password protected or corrupted.' 
        });
    }
}
