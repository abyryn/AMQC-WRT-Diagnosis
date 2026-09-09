require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_PROMPT = `Anda adalah Honda Master Technician (20 tahun pengalaman PGM-FI).
TUGAS: Analisis data ECU Honda PGM-FI & berikan diagnosis terstruktur CEPAT dan RINGKAS dalam JSON.

ATURAN PERFORMA:
1. "summary": Maksimal 1-2 kalimat padat dan jelas.
2. "primary_cause": "description" maksimal 1-2 kalimat ringkas.
3. "check_steps": Maksimal 4-5 poin langkah tindakan singkat (mudah ke sulit).
4. Format output WAJIB JSON murni tanpa markdown/teks pengantar:

{
  "summary": "Ringkasan 1-2 kalimat kondisi motor",
  "risk_level": "low|medium|high|critical",
  "primary_cause": {
    "description": "Penyebab utama yang paling mungkin",
    "confidence": "90%",
    "evidence": ["bukti data sensor/DTC"]
  },
  "alternative_causes": [
    {"description": "Penyebab alternatif 1", "confidence": "10%"}
  ],
  "check_steps": [
    "Langkah 1: ...",
    "Langkah 2: ...",
    "Langkah 3: ..."
  ],
  "additional_data_needed": [],
  "safety_warning": "Peringatan keselamatan jika ada, null jika aman"
}`;

async function testFullDiagnosis() {
  const payload = {
    motor: { model: 'Honda PCX 160 eSP+' },
    technician: 'Mekanik Test',
    mileage: 14250,
    complaint: 'Motor brebet saat digas di tarikan awal, lampu MIL berkedip 9 kali setelah terkena hujan, dan konsumsi bensin terasa lebih boros.',
    dtc: { active: ['P0113'], pending: [] },
    live_data: { iat_celsius: -40.0, ect_celsius: 88.0, battery_volt: 11.8 }
  };

  const userPrompt = `${SYSTEM_PROMPT}\n\nDATA ECU:\n${JSON.stringify(payload, null, 2)}`;

  console.log('Sending full diagnosis request to gemini-3.6-flash...');
  const start = Date.now();
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    });
    const result = await model.generateContent(userPrompt);
    const elapsed = Date.now() - start;
    console.log(`[SUCCESS] Diagnosis completed in ${elapsed}ms!`);
    console.log('Output:', result.response.text());
  } catch (err) {
    console.log(`[ERROR] Diagnosis failed after ${Date.now() - start}ms:`, err.message);
  }
}

testFullDiagnosis();
