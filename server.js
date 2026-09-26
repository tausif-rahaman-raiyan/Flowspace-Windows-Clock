const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Serve assets folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve src folder (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'src')));

// Serve icon as favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'icon.png'));
});

// Serve index.html for root and SPA fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Flowspace server running on http://${HOST}:${PORT}`);
});
