const axios = require('axios');

async function testLogin() {
  const username = 'devuser';
  const password = 'devpassword123';
  const url = 'http://127.0.0.1:8000/api/v1/auth/login';

  console.log(`Testing login for ${username} at ${url}...`);

  try {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post(url, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log('Login successful!');
    console.log('Token:', response.data.access_token);
  } catch (error) {
    console.error('Login failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Detail:', error.response.data.detail);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
