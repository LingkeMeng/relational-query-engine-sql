const express = require('express');
const path = require('path');
const pool = require('./db');

// Router constants
const app = express();
const port = 3000;
const session = require('express-session');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const stocksRouter = require('./routes/stocks');
const portfolioRouter = require('./routes/portfolio');
const holdingsRouter = require('./routes/holdings');
const tradingRouter = require('./routes/trading');
const chartRouter = require('./routes/chart');

const listsRouter = require('./routes/lists');
const reviewsRouter = require('./routes/reviews');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'connect.sid',           
  secret: 'your_secret_key_here',
  resave: false,
  saveUninitialized: false,
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Uses API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/stocks', stocksRouter); 
app.use('/api/portfolio', portfolioRouter);
app.use('/api/holdings', holdingsRouter);
app.use('/api/trading', tradingRouter);
app.use('/api/chart', chartRouter);
app.use('/api', listsRouter);   
app.use('/api', reviewsRouter);  

app.get('/api/time', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ connected: true, time: result.rows[0].now });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ connected: false, error: err.message });
  }
});

// example API
app.post('/api/hello', (req, res) => {
  const name = req.body?.name || 'guest';
  res.json({ message: `Hello, ${name}!` });
});

// catch-all for client-side routes (Express v5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start the server and listen on specified host and port
const host = '0.0.0.0'; 
app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
