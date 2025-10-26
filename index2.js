require('dotenv').config(); // Load env variables

const express = require('express');
const cors = require('cors');
const routes = require('./routes/route');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic CORS
app.use(cors({ origin: 'http://localhost:4200' }));

// JSON parser
app.use(express.json());

// Routes
app.use('/', routes);

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));