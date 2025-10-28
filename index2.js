require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors');
const routes = require('./routes/route');

const app = express();
const PORT = process.env.PORT || 3000;

//  Enable CORS for both local dev and live frontend
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://find-quick.vercel.app',
    'https://find-quick-fiue96s3q-ananthu-ps-projects.vercel.app',
    'https://find-quick-talktoananthu-6681-ananthu-ps-projects.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

//  JSON body parser
app.use(express.json());

//  API routes
app.use('/', routes);

//  Default route (optional but nice for testing)
app.get('/', (req, res) => {
  res.send('Backend server is running successfully ');
});

//  Start server
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});