const express = require('express');
const db = require('../db');

const router = express.Router();

// Login check 
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    req.userId = req.session.userId;
    next();
  }

// Get all holdings for a specific portfolio by id
router.get('/:portfolioId', requireLogin, async (req, res) => {
    const portfolioId = Number(req.params.portfolioId);

    try {
        const result = await db.query(
            'SELECT HoldingID, Symbol, Shares, AvgPrice, CreatedAt, UpdatedAt FROM Holdings WHERE PortfolioID = $1',
            [portfolioId]
        );

        return res.json({ holdings: result.rows });
    } catch (err) {
        console.error('holdings fetch error:', err);
        return res.status(500).json({ ok: false });
    }
});

// function to get holdings with mv and closest pricing
router.get('/:portfolioId/holdingsValue', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);

  try {
    const holdingsRes = await db.query(
      `SELECT Symbol, Shares
       FROM Holdings
       WHERE PortfolioID = $1`,
      [portfolioId]
    );

    const holdings = holdingsRes.rows;
    const enriched = [];
    for (const h of holdings) {
      const priceRes = await db.query(
        `SELECT close
         FROM Stocks
         WHERE symbol = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [h.symbol]
      );

      const lastClose = priceRes.rows.length ? Number(priceRes.rows[0].close) : null;
      const mv = lastClose ? lastClose * Number(h.shares) : null;

      enriched.push({
        symbol: h.symbol,
        shares: Number(h.shares),
        lastClose,
        mv
      });
    }
    return res.json({ holdings: enriched });

  } catch (err) {
    console.log("error getting holdings value", err);
    res.status(500).json({ ok: false });
  }
});


  module.exports = router;





