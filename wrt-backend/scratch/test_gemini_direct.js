require('dotenv').config();
const geminiService = require('../src/services/gemini.service');

async function testDirectGemini() {
  console.log('Testing fresh payload directly to Google Gemini...');
  const payload = {
    motor: { model: 'Honda Vario 160 eSP+' },
    technician: 'Mekanik Senior WRT',
    mileage: 18500,
    complaint: 'Mesin tiba-tiba mati saat berhenti di lampu merah, indikator MIL berkedip 7 kali, dan idle tidak stabil.',
    dtc: { active: ['P0197'], pending: [] },
    live_data: { iat_celsius: 35.0, ect_celsius: 125.0, battery_volt: 12.4 }
  };
  
  const start = Date.now();
  const res = await geminiService.diagnose(payload, 'Context test');
  console.log(`\nFinished in ${Date.now() - start}ms!`);
  console.log('Provider:', res.metadata.provider);
  console.log('Model:', res.metadata.ai_model);
  console.log('Full Gemini Response:\n', JSON.stringify(res.layers.layer3_ai, null, 2));
}

testDirectGemini();
