const express = require('express');
const db = require('../db');
const fs = require('fs');
const QuickChart = require('quickchart-js');

const router = express.Router();

// historical price chart 
router.get('/:symbol/:start/:end', async (req, res) => {
  try {
    const { symbol, start, end } = req.params;
    
    const q = `
      SELECT timestamp::date as day, close
      FROM Stocks
      WHERE symbol = $1
        AND timestamp::date BETWEEN $2 AND $3
      ORDER BY timestamp;
    `;
    const { rows } = await db.query(q, [symbol.toUpperCase(), start, end]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'No price data found' });
    }
    const MAX_POINTS = 60; //qc API limit
    const limitedRows = rows.slice(-MAX_POINTS);

    const dates = limitedRows.map(r => {
      const d = new Date(r.day);
      return d.toISOString().slice(0, 10);  
    });
    const closes = limitedRows.map(r => Number(r.close));
    const chart = new QuickChart();
    chart.setWidth(800).setHeight(400);
    chart.setConfig({
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: symbol.toUpperCase() + ' Price',
            data: closes,
            borderColor: 'blue',
            fill: false
          }
        ]
      }
    });

    const imgData = await chart.toBinary();
    if (!fs.existsSync('./charts')) {
      fs.mkdirSync('./charts');
    }

    const filename = `./charts/${symbol}_${start}_${end}.png`;
    fs.writeFileSync(filename, imgData);

    res.json({ ok: true, file: filename });

  } catch (err) {
    console.log('chart error:', err);
    res.status(500).json({ ok: false });
  }
});

//prediction chart (support one month data)
const { SimpleLinearRegression } = require('ml-regression-simple-linear');

router.get('/predict/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const days = '30'; // predict for 30 days

    const sql = `
      SELECT timestamp, close
      FROM Stocks
      WHERE symbol = $1
      ORDER BY timestamp DESC
      LIMIT 50;
    `;

    const out = await db.query(sql, [symbol.toUpperCase()]);
    if (out.rows.length < 5) {
      return res.json({ ok: false, error: "Not enough data to predict" });
    }

    // chronological order
    const items = out.rows.reverse();
    const last = items[items.length - 1];

    // Linear Regression (Improved Prediction)

    const x = items.map((_, i) => i);
    const y = items.map(r => Number(r.close));

    const regression = new SimpleLinearRegression(x, y);

    let d = new Date(last.timestamp);
    let price = Number(last.close);

    const predDates = [];
    const predVals = [];

    for (let i = 0; i < days; i++) {
      d.setDate(d.getDate() + 1);

      const idx = items.length + i;
      price = regression.predict(idx);

      predDates.push(d.toISOString().slice(0, 10));
      predVals.push(Number(price.toFixed(2)));
    }
    // Chart 
    const chart = new QuickChart();
    chart.setWidth(900).setHeight(450);

    chart.setConfig({
      type: 'line',
      data: {
        labels: [
          ...items.map(r => r.timestamp.toISOString().slice(0, 10)),
          ...predDates
        ],
        datasets: [
          {
            label: symbol.toUpperCase() + ' Historical',
            data: items.map(r => Number(r.close)),
            borderColor: 'blue',
            fill: false
          },
          {
            label: symbol.toUpperCase() + ' Predicted',
            data: [
              ...Array(items.length).fill(null),
              ...predVals
            ],
            borderColor: 'green',
            borderDash: [4, 4],
            fill: false
          }
        ]
      }
    });

    const buffer = await chart.toBinary();

    if (!fs.existsSync('./charts')) fs.mkdirSync('./charts');

    const f = `./charts/${symbol}_pred_${Date.now()}.png`;
    fs.writeFileSync(f, buffer);

    res.json({ ok: true, file: f });

  } catch (err) {
    console.log("predict chart err:", err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
