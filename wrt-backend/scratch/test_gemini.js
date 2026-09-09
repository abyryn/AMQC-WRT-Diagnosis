require('dotenv').config();
const geminiService = require('../src/services/gemini.service');

async function test() {
  console.log('Testing geminiService.diagnose...');
  const start = Date.now();
  const payload = {
    motor: { model: 'Honda PCX 160 eSP+' },
    technician: 'Mekanik Test',
    mileage: 14250,
    complaint: 'Motor brebet saat digas',
    dtc: { active: ['P0113'], pending: [] },
    live_data: { iat_celsius: -40.0, ect_celsius: 88.0, battery_volt: 11.8 }
  };
  
  const result = await geminiService.diagnose(payload, 'Test context');
  const elapsed = Date.now() - start;
  console.log('Finished in', elapsed, 'ms');
  console.log('Result:', JSON.stringify(result, null, 2));
}

test();
