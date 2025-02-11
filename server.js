const express = require('express');
const app = express();
const path = require('path');

// Serve static files from root directory
app.use(express.static('.'));

// Route handlers
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/index.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/profile.html'));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
