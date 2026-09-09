require('dotenv').config();
const geminiService = require('../src/services/gemini.service');

async function testCache() {
  const payload = {
    motor: { model: 'Honda PCX 160 eSP+' },
    technician: 'Mekanik Test',
    mileage: 14250,
    complaint: 'Motor brebet saat digas',
    dtc: { active: ['P0113'], pending: [] },
    live_data: { iat_celsius: -40.0, ect_celsius: 88.0, battery_volt: 11.8 }
  };
  
  console.log('--- Call 1 (Initial Request) ---');
  const t1 = Date.now();
  const r1 = await geminiService.diagnose(payload, 'Test context');
  console.log(`Call 1 Latency: ${Date.now() - t1}ms | Provider: ${r1.metadata.provider}`);

  console.log('\n--- Call 2 (Cached Request) ---');
  const t2 = Date.now();
  const r2 = await geminiService.diagnose(payload, 'Test context');
  console.log(`Call 2 Latency: ${Date.now() - t2}ms | Provider: ${r2.metadata.provider}`);
}

testCache();
