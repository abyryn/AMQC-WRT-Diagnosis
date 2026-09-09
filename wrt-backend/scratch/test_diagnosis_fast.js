require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Compact, high-speed System Prompt
const SYSTEM_PROMPT = `Anda Honda Master Tech PGM-FI. Diagnosis data ECU ke JSON murni:
{
  "summary": "1 kalimat ringkasan",
  "risk_level": "medium",
  "primary_cause": {"description": "Penyebab utama", "confidence": "90%", "evidence": ["P0113"]},
  "alternative_causes": [],
  "check_steps": ["1. Periksa IAT", "2. Ukur Vref"],
  "safety_warning": null
}`;

async function testFastDiagnosis() {
  const payload = {
    motor: 'Honda PCX 160',
    complaint: 'Brebet tarikan awal',
    dtc: ['P0113'],
    live: { iat: -40, ect: 88, vbat: 11.8 }
  };

  console.log('Testing streamlined prompt with gemini-3.6-flash...');
  const start = Date.now();
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 400,
      }
    });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\nDATA: ${JSON.stringify(payload)}`);
    console.log(`[SUCCESS] Completed in ${Date.now() - start}ms!`);
    console.log('Output:', result.response.text());
  } catch (err) {
    console.log(`[ERROR] ${Date.now() - start}ms:`, err.message);
  }
}

testFastDiagnosis();
