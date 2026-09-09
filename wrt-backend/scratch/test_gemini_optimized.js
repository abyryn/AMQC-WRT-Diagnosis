require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FAST_SYSTEM_PROMPT = `Anda adalah Honda Master Technician (20 tahun pengalaman PGM-FI).
Berikan diagnosis terstruktur & singkat dalam JSON:
{
  "summary": "Ringkasan singkat 1 kalimat kondisi motor.",
  "risk_level": "low|medium|high|critical",
  "primary_cause": {
    "description": "Penyebab utama paling mungkin",
    "confidence": "90%",
    "evidence": ["DTC P0113", "IAT -40°C"]
  },
  "alternative_causes": [
    {"description": "Alternatif 1", "confidence": "10%"}
  ],
  "check_steps": [
    "Langkah 1: Periksa soket IAT",
    "Langkah 2: Ukur Vref 5V",
    "Langkah 3: Periksa kabel ECM"
  ],
  "safety_warning": "Peringatan keselamatan singkat"
}`;

async function testOptimized() {
  console.log('Testing Optimized Gemini Request...');
  const start = Date.now();
  const payload = {
    motor: 'Honda PCX 160 eSP+',
    complaint: 'Motor brebet saat digas',
    dtc: ['P0113'],
    sensors: { iat: -40.0, ect: 88.0, vbat: 11.8 }
  };

  const userPrompt = `${FAST_SYSTEM_PROMPT}\n\nDATA: ${JSON.stringify(payload)}`;

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 512, // Reduced from 4096 to 512
    },
  });

  const result = await model.generateContent(userPrompt);
  const elapsed = Date.now() - start;
  console.log('Finished in', elapsed, 'ms');
  console.log('Tokens used:', result.response.usageMetadata?.totalTokenCount);
  console.log('Result length:', result.response.text().length, 'chars');
  console.log('Result snippet:', result.response.text());
}

testOptimized();
