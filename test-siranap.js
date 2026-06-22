require('dotenv').config();
const axios = require('axios');

async function testSiranap() {
  const rsId = process.env.SIRANAP_RS_ID;
  const password = process.env.SIRANAP_PASSWORD;
  const baseUrl = process.env.SIRANAP_BASE_URL || 'https://sirs.kemkes.go.id';

  if (!rsId || !password) {
    console.error('Missing credentials');
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = {
    'X-rs-id': rsId,
    'X-pass': password,
    'X-Timestamp': timestamp,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const payload = {
    id_tt: '5', // VIP
    ruang: 'TEST_RUANG',
    jumlah_ruang: '0',
    jumlah: '10',
    terpakai: '2',
    terpakai_suspek: '0',
    terpakai_konfirmasi: '0',
    prepare: '0',
    prepare_plan: '0',
    covid: '0',
    antrian: '0'
  };

  try {
    console.log('Sending payload JSON...');
    const res = await axios({
      method: 'post',
      url: `${baseUrl}/fo/index.php/Fasyankes`,
      data: payload,
      headers: headers,
    });
    console.log('JSON Status:', res.status);
    console.log('JSON Response:', res.data);
  } catch (e) {
    console.error('JSON Error:', e.response?.data || e.message);
  }

  // Coba dengan format x-www-form-urlencoded
  const qs = require('querystring');
  try {
    console.log('\nSending payload URL-ENCODED...');
    const headersForm = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
    const res = await axios({
      method: 'post',
      url: `${baseUrl}/fo/index.php/Fasyankes`,
      data: qs.stringify(payload),
      headers: headersForm,
    });
    console.log('URL-ENCODED Status:', res.status);
    console.log('URL-ENCODED Response:', res.data);
  } catch (e) {
    console.error('URL-ENCODED Error:', e.response?.data || e.message);
  }
}

testSiranap();
