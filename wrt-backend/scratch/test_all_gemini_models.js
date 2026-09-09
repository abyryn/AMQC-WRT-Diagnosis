require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
console.log('Testing Key:', apiKey ? `${apiKey.slice(0, 10)}...` : 'NONE');
const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
  'gemini-3.6-flash',
];

const prompt = `Anda Honda Master Technician. Berikan diagnosis JSON ringkas:
{
  "summary": "Sensor IAT terbaca -40°C mengindikasikan sirkuit terbuka.",
  "risk_level": "medium",
  "primary_cause": {"description": "Sirkuit Sensor IAT Open Circuit", "confidence": "95%", "evidence": ["DTC P0113"]},
  "alternative_causes": [],
  "check_steps": ["1. Periksa soket IAT"],
  "safety_warning": null
}`;

async function runBenchmark() {
  console.log('--- TESTING ALL GEMINI MODELS FOR SPEED AND STABILITY ---');
  for (const mName of modelsToTest) {
    console.log(`\nTesting: '${mName}'...`);
    const start = Date.now();
    try {
      const model = genAI.getGenerativeModel({
        model: mName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      });
      const result = await model.generateContent(prompt);
      const elapsed = Date.now() - start;
      console.log(`✅ SUCCESS [${mName}]: ${elapsed}ms`);
      console.log(`Snippet: ${result.response.text().slice(0, 100)}...`);
    } catch (err) {
      console.log(`❌ ERROR [${mName}]: ${err.message.split('\n')[0]}`);
    }
  }
}

runBenchmark();
