const fetch = require('node-fetch');

/**
 * Creates a unique video room on Daily.co for an appointment.
 * @param {string} appointmentId 
 * @returns {Promise<string>} The room URL
 */
const createVideoRoom = async (appointmentId) => {
  try {
    const roomName = `nexus-appt-${appointmentId}-${Date.now()}`;
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          exp: Math.round(Date.now() / 1000) + 60 * 60 * 24 
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Daily.co Create Room Error:', data);
      throw new Error(data.error || 'Failed to create video room');
    }

    console.log(`✅ Daily.co room created: ${data.url}`);
    return data.url;
  } catch (error) {
    console.error('❌ Error in createVideoRoom:', error.message);
    return null;
  }
};

const createMeetingToken = async (roomName, isOwner = false, userName = '') => {
  try {
    console.log(`🔐 Requesting Daily.co token for room: ${roomName}, isOwner: ${isOwner}, user: ${userName}`);
    const properties = {
      room_name: roomName,
      is_owner: isOwner,
      exp: Math.round(Date.now() / 1000) + 60 * 60 * 2 
    };

    if (userName) {
      properties.user_name = userName;
    }

    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      },
      body: JSON.stringify({ properties })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Daily.co Token API Error:', data);
      return null;
    }

    return data.token;
  } catch (error) {
    console.error('❌ Error creating meeting token:', error.message);
    return null;
  }
};

module.exports = { createVideoRoom, createMeetingToken };
