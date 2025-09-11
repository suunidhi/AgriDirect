// app.js
import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // for JSON requests
app.use(express.static(path.join(__dirname, 'public')));

// Routes - serve the signup/login HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shared_homepage.html')); 
});

app.get('/farmer/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'farmer_signup18.html'));
});

app.get('/farmer/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'farmer_login19.html'));
});

app.get('/consumer/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consumer_signup18.html'));
});

app.get('/consumer/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consumer_login18.html'));
});

app.listen(port, () => {
  console.log(`🌐 Frontend server is running at http://localhost:${port}`);
});
