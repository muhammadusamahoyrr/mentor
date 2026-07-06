const fetch = require('node-fetch');
require('dotenv').config();

async function checkAccount() {
  const key = process.env.DAILY_API_KEY;
  console.log('API Key (first 12 chars):', key?.substring(0, 12) + '...');

  // 1. Check account info
  const acctRes = await fetch('https://api.daily.co/v1/', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const acct = await acctRes.json();
  console.log('\n=== ACCOUNT INFO ===');
  console.log('Domain:', acct.domain_name);
  console.log('Domain ID:', acct.domain_id);

  // 2. List rooms to check if the appointment room still exists
  const roomsRes = await fetch('https://api.daily.co/v1/rooms?limit=5', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const rooms = await roomsRes.json();
  console.log('\n=== ROOMS ===');
  console.log('Total rooms:', rooms.total_count);
  if (rooms.data) {
    rooms.data.forEach(r => {
      const expired = r.config?.exp ? (r.config.exp * 1000 < Date.now()) : false;
      console.log(`  - ${r.name} | privacy: ${r.privacy} | expired: ${expired} | exp: ${r.config?.exp ? new Date(r.config.exp * 1000).toISOString() : 'none'}`);
    });
  }

  // 3. Check billing/plan info via the config
  console.log('\n=== BILLING HINTS ===');
  console.log('HIPAA enabled:', acct.config?.hipaa);
  console.log('Block API requests:', acct.config?.block_api_requests);
  console.log('Account suspended:', acct.config?.account_suspended);
  console.log('Allow plan free:', acct.config?.allow_plan_free);

  // 4. Test meeting token creation
  if (rooms.data && rooms.data.length > 0) {
    const roomName = rooms.data[0].name;
    console.log(`\n=== TESTING MEETING TOKEN FOR ROOM: ${roomName} ===`);
    const tokRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: true,
          exp: Math.round(Date.now() / 1000) + 60 * 60 * 2
        }
      })
    });
    const tokData = await tokRes.json();
    console.log('Meeting Token Response:', tokData);
  }
}

checkAccount().catch(console.error);

