require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testRawCall() {
  const models = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  for (const m of models) {
    console.log(`\nTesting model '${m}'...`);
    const start = Date.now();
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent('Say hello');
      console.log(`[SUCCESS] Response in ${Date.now() - start}ms:`, result.response.text());
    } catch (err) {
      console.log(`[EXACT ERROR] after ${Date.now() - start}ms:`);
      console.log(err.message);
    }
  }
}

testRawCall();
