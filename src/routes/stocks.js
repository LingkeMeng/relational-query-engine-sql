const express = require('express');
const pool = require('../db');

const router = express.Router();

// Get all unique stock symbols
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT symbol FROM Stocks ORDER BY symbol'
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Error fetching stocks:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// get latest 15 stocks added
router.get("/all/limit", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT symbol, timestamp, open, high, low, close, volume
      FROM Stocks
      ORDER BY timestamp DESC
      LIMIT 15
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("stocks/all error:", err);
    res.status(500).json({ error: "Failed to load stocks" });
  }
});

// Get all price data for a specific stock symbol
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100, order = 'DESC' } = req.query;
    
    const result = await pool.query(
      `SELECT * FROM Stocks 
       WHERE symbol = $1 
       ORDER BY timestamp ${order === 'ASC' ? 'ASC' : 'DESC'} 
       LIMIT $2`,
      [symbol.toUpperCase(), parseInt(limit)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stock not found' });
    }
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Error fetching stock data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Get latest stats (price for MV) for a specific stock
router.get('/:symbol/latest', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM Stocks 
       WHERE symbol = $1 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [symbol.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No data found for this stock' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching latest price:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Find the price data for specific stock on specific date
router.get('/:symbol/:date', async (req, res) => {
  try {
    const { symbol, date } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM Stocks WHERE symbol = $1 AND timestamp = $2',
      [symbol.toUpperCase(), date]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Price data not found for this date' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching price:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Find the price data within date range
router.get('/:symbol/range/:startDate/:endDate', async (req, res) => {
  try {
    const { symbol, startDate, endDate } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM Stocks 
       WHERE symbol = $1 
       AND timestamp BETWEEN $2 AND $3 
       ORDER BY timestamp ASC`,
      [symbol.toUpperCase(), startDate, endDate]
    );
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Error fetching price range:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Add new stock price record
router.post('/add', async (req, res) => {
  try {
    const { symbol, timestamp, open, high, low, close, volume } = req.body;
    
    if (!symbol || !timestamp || !open || !high || !low || !close || !volume) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required (symbol, timestamp, open, high, low, close, volume)' 
      });
    }
    // Ensure the symbol exists in StockSymbols table if completely new
    await pool.query(
        `INSERT INTO StockSymbols (symbol)
         VALUES ($1)
         ON CONFLICT (symbol) DO NOTHING`,
        [symbol]
      );
    
    const result = await pool.query(
      `INSERT INTO Stocks (symbol, timestamp, open, high, low, close, volume) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [symbol.toUpperCase(), timestamp, open, high, low, close, volume]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error adding stock data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Update stock price record
router.put('/:symbol/:date', async (req, res) => {
  try {
    const { symbol, date } = req.params;
    const { open, high, low, close, volume } = req.body;
    
    const result = await pool.query(
      `UPDATE Stocks 
       SET open = $1, high = $2, low = $3, close = $4, volume = $5 
       WHERE symbol = $6 AND timestamp = $7 
       RETURNING *`,
      [open, high, low, close, volume, symbol.toUpperCase(), date]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stock record not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating stock data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete stock price record
router.delete('/:symbol/:date', async (req, res) => {
  try {
    const { symbol, date } = req.params;
    
    const result = await pool.query(
      'DELETE FROM Stocks WHERE symbol = $1 AND timestamp = $2 RETURNING *',
      [symbol.toUpperCase(), date]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stock record not found' });
    }
    
    res.json({ success: true, message: 'Stock record deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting stock data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get stock statistics (useful for stats)
router.get('/:symbol/stats', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const result = await pool.query(
      `SELECT 
         symbol,
         COUNT(*) as total_records,
         MIN(timestamp) as earliest_date,
         MAX(timestamp) as latest_date,
         AVG(close) as avg_close_price,
         MAX(high) as all_time_high,
         MIN(low) as all_time_low,
         SUM(volume) as total_volume
       FROM Stocks 
       WHERE symbol = $1
       GROUP BY symbol`,
      [symbol.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No data found for this stock' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching stock stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});



module.exports = router;