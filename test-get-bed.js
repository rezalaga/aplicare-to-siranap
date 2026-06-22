require('dotenv').config();
const SiranapService = require('./src/services/siranap.service');

async function testGet() {
  const service = new SiranapService();
  const res = await service.getBedData();
  
  if (res.success && Array.isArray(res.data)) {
    console.log(`Success! Found ${res.data.length} rooms in SIRANAP.`);
    console.log(`Sample room:`, res.data[0]);
  } else {
    console.log(`Failed to parse array. Data:`, res.data);
  }
}

testGet();
