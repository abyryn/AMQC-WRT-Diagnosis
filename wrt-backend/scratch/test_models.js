require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const candidateModels = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-exp',
];

async function benchmarkModels() {
  const prompt = 'Jawab 1 kata: halo';
  for (const mName of candidateModels) {
    const start = Date.now();
    try {
      const model = genAI.getGenerativeModel({ model: mName });
      const res = await model.generateContent(prompt);
      console.log(`[OK] Model: ${mName} | Time: ${Date.now() - start}ms | Output: ${res.response.text().trim()}`);
    } catch (err) {
      console.log(`[ERR] Model: ${mName} | Time: ${Date.now() - start}ms | Error: ${err.message.split('\n')[0]}`);
    }
  }
}

benchmarkModels();
