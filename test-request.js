const http = require('http');

const req = http.get('http://127.0.0.1:5000/signin', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body start:', data.substring(0, 500));
        process.exit(0);
    });
});
req.on('error', err => {
    console.error('Request Error:', err);
    process.exit(1);
});
