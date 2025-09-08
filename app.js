const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Dummy user (you can connect MongoDB later)
const dummyUser = {
  email: 'user@example.com',
  password: 'password123'
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login187.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (email === dummyUser.email && password === dummyUser.password) {
    return res.send(`<h2>Login successful! Welcome, ${email} 🎉</h2>`);
  } else {
    return res.send('<h2>Invalid email or password. Please try again.</h2><a href="/">Go Back</a>');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
