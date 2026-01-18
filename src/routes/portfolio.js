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

// get all portfolios for the logged-in user
router.get('/', requireLogin, async (req, res) => {
  try {
    const q = `SELECT PortfolioID, Name, CashBalance
               FROM Portfolio
               WHERE UserID = $1
               ORDER BY PortfolioID`;
    const result = await db.query(q, [req.userId]);
    res.json({ portfolios: result.rows });
  } catch (err) {
    console.log('error fetching all portfolio', err);
    res.status(500).json({ ok: false });
  }
});

// create a new portfolio for the logged-in user
router.post('/add', requireLogin, async (req, res) => {
  const { name, cashBalance } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const initialCash = Number(cashBalance) || 0;

  try {
    const q = `INSERT INTO Portfolio (UserID, Name, CashBalance)
               VALUES ($1, $2, $3)
               RETURNING PortfolioID, Name, CashBalance`;
    const result = await db.query(q, [req.userId, name, initialCash]);
    res.status(201).json({ portfolio: result.rows[0] });
  } catch (err) {
    console.log('error while creating portfolio', err);
    res.status(500).json({ ok: false });
  }
});

// summary of a portfolio by id
router.get('/:portfolioId/summary', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);

  try {
    const q = `SELECT PortfolioID, Name, CashBalance
               FROM Portfolio
               WHERE PortfolioID = $1 AND UserID = $2`;
    const result = await db.query(q, [portfolioId, req.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json({  summary: result.rows[0] });
  } catch (err) {
    console.log('error getting summary for portfolio', err);
    res.status(500).json({ ok: false });
  }
});

// get portfolio by id if user owns it
router.get('/:portfolioId', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);

  try {
    const q = `SELECT PortfolioID, Name, CashBalance
               FROM Portfolio
               WHERE PortfolioID = $1 AND UserID = $2`;
    const result = await db.query(q, [portfolioId, req.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json({portfolio: result.rows[0] });
  } catch (err) {
    console.log('error getting portfolios', err);
    res.status(500).json({ ok: false });
  }
});

// update portfolio by id
router.put('/:portfolioId', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);
  const { name, cashBalance } = req.body;

  try {
    const exists = await db.query(
      'SELECT PortfolioID FROM Portfolio WHERE PortfolioID = $1 AND UserID = $2',
      [portfolioId, req.userId]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const q = `UPDATE Portfolio
               SET Name = COALESCE($1, Name),
                   CashBalance = COALESCE($2, CashBalance)
               WHERE PortfolioID = $3
               RETURNING PortfolioID, Name, CashBalance`;

    const result = await db.query(q, [
      name || null,
      cashBalance !== undefined ? Number(cashBalance) : null,
      portfolioId
    ]);

    res.json({ portfolio: result.rows[0] });
  } catch (err) {
    console.log('failed', err);
    res.status(500).json({ ok: false });
  }
});

// delete portfolio by id
router.delete('/:portfolioId', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);

  try {
    const q = `DELETE FROM Portfolio
               WHERE PortfolioID = $1 AND UserID = $2
               RETURNING PortfolioID`;

    const result = await db.query(q, [portfolioId, req.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json({ id: result.rows[0].portfolioid });
  } catch (err) {
    console.log('failed to delete portfolio', err);
    res.status(500).json({ ok: false });
  }
});

// deposit cash into portfolio and make a transaction record
router.post('/:portfolioId/deposit', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);
  const amount = Number(req.body.amount);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount given' });
  }
  const detail = `Deposit $${amount.toFixed(2)}`;

  try {
    const q = `UPDATE Portfolio SET CashBalance = CashBalance + $1
              WHERE PortfolioID=$2 AND UserID=$3
              RETURNING PortfolioID, CashBalance`;
    const result = await db.query(q, [amount, portfolioId, req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio is not found' });
    }

    await db.query(
        `INSERT INTO Transaction (PortfolioID, Amount, Detail)
       VALUES ($1, $2, $3)`,
      [portfolioId, amount, detail]
    );

    res.json({ portfolio: result.rows[0] });
  } catch (err) {
    console.log('fail to deposit to portfolio', err);
    res.status(500).json({ ok: false });
  }
});

// withdraw cash from portfolio and make a transaction record
router.post('/:portfolioId/withdraw', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);
  const amount = Number(req.body.amount);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount given' });
  }
  const detail = `Withdraw $${amount.toFixed(2)}`;
  try {
    const check = await db.query(
      `SELECT CashBalance 
        FROM Portfolio 
        WHERE PortfolioID = $1 AND UserID = $2`,
      [portfolioId, req.userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    if (check.rows[0].cashbalance < amount) {
      return res.status(400).json({ error: 'Not enough funds' });
    }

    const q = `UPDATE Portfolio SET CashBalance = CashBalance - $1
               WHERE PortfolioID = $2 AND UserID = $3 RETURNING PortfolioID, CashBalance`;

    const result = await db.query(q, [amount, portfolioId, req.userId]);

    await db.query(
        `INSERT INTO Transaction (PortfolioID, Amount, Detail)
       VALUES ($1, $2, $3)`,
      [portfolioId, -amount, detail]
    )

    res.json({ portfolio: result.rows[0] });
  } catch (err) {
    console.log('fail to withdraw from portfolio', err);
    res.status(500).json({ ok: false });
  }
});

// get cash balance of portfolio by id
router.get('/:portfolioId/cash', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);

  try {
    const q = `SELECT CashBalance
               FROM Portfolio
               WHERE PortfolioID = $1 AND UserID = $2`;

    const result = await db.query(q, [portfolioId, req.userId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json({ cash: result.rows[0].cashbalance });
  } catch (err) {
    console.log('error getting balance:', err);
    res.status(500).json({ ok: false });
  }
});

// get all transactions of a portfolio by id
router.get('/:portfolioId/transactions', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);

  try {
    const q = `SELECT TransactionID, Amount, Detail, CreatedAt
               FROM Transaction
               WHERE PortfolioID = $1`;

    const result = await db.query(q, [portfolioId]);

    res.json({ transactions: result.rows });
  } catch (err) {
    console.log('error getting transactions', err);
    res.status(500).json({ ok: false });
  }
});

// calculate total portfolio value (cash + holdings mv)
router.get('/:portfolioId/value', requireLogin, async (req, res) => {
  const portfolioId = Number(req.params.portfolioId);
  try {
    // Get cash balance
    const cashResult = await db.query(
        `SELECT CashBalance FROM Portfolio
         WHERE PortfolioID = $1 AND UserID = $2`,
        [portfolioId, req.userId]
      );
  
      if (cashResult.rows.length === 0) {
        return res.status(404).json({ error: "Portfolio not found or doesn't belong to this user" });
      }
      const cashBalance = Number(cashResult.rows[0].cashbalance);

    // Get holdings mv
    const holdingsResult = await db.query(
      `SELECT Symbol, Shares FROM Holdings WHERE PortfolioID = $1`,
      [portfolioId]
    );
    const holdings = holdingsResult.rows;
    let holdingsP = 0;
    for (const h of holdings) {
        const symbol = h.symbol;
        const priceResult = await db.query(
          `SELECT close 
           FROM Stocks 
          WHERE symbol = $1 AND timestamp::date <= CURRENT_DATE
           ORDER BY timestamp DESC LIMIT 1`,
          [symbol]
        );
        if (priceResult.rows.length > 0) {
          const closeP = Number(priceResult.rows[0].close);
          holdingsP += closeP * Number(h.shares);
        } 
      }
      const total = cashBalance + holdingsP;
      res.json({ portfolioId, cashBalance, holdingsP, total });
  } catch (err) {
    console.log('error calculating portfolio value', err);
    res.status(500).json({ ok: false });
  }
});

/* Calculate the statistics of a portfolio (COV/Beta/matrix)
// stats for a portfolio
// portfolio statistics (COV, Beta, corr matrix)
// COV formula: stddev of returns / avg of returns
// Beta formula: Covariance(stock returns, market returns) / Variance(market returns) (we assumed this)
 matrix: correlation between each pair of stocks in the portfolio
 Beta and COV are cached in statistics_cache table
 */
 router.get('/:portfolioId/statistics/:start/:end', requireLogin, async (req, res) => {
  const { portfolioId, start, end } = req.params;
  const pid = Number(portfolioId);
  if (isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  console.log(`#####Calculating stats for portfolio ${pid} from ${start} to ${end}`);
  try {

    //print cache if exists
    const cacheSQL = `
      SELECT symbol, cov, beta
      FROM statistics_cache
      WHERE portfolio_id = $1
        AND start_date = $2
        AND end_date = $3
    `;
    const cacheRes = await db.query(cacheSQL, [pid, start, end]);
    let stats = [];

    if (cacheRes.rows.length > 0) {
      console.log('########loading stats from cache');
      stats = cacheRes.rows.map(r => ({
        symbol: r.symbol,
        COV: Number(r.cov),
        Beta: Number(r.beta)
      }));
    } else {
      console.log('########calculating stats from scratch');
      // load holdings
      const hRes = await db.query(
        `SELECT symbol, shares FROM Holdings WHERE portfolioid = $1`,
        [pid]
      );
      if (hRes.rows.length === 0) {
        return res.status(404).json({ error: 'No holdings for this portfolio' });
      }

      stats = [];

      for (const h of hRes.rows) {
        const sym = h.symbol;

        // calculate COV
        //1. calculate daily returns
        //2. calculate stdev and avg of returns
        //3. COV = stdev / avg
        const covSQL = `
          WITH t AS (
            SELECT (close - LAG(close) OVER (ORDER BY timestamp))
                     / LAG(close) OVER (ORDER BY timestamp) AS r
            FROM Stocks
            WHERE symbol = $1
            AND timestamp::date BETWEEN $2 AND $3
          )
          SELECT STDDEV(r) / AVG(r) AS cov
          FROM t
          WHERE r IS NOT NULL;
        `;
        const covRes = await db.query(covSQL, [sym, start, end]);

        // calculate Beta
        // !!! assmue market return is the average return of all stocks
        //1. calculate daily returns of the stock
        //2. calculate daily returns of the market !!(avg of all stocks)
        //3. Beta = Covariance(stock returns, market returns) / Variance(market returns)
        //with this assumption, stock beta should be around 1
        const betaSQL = `
          WITH s AS (
            SELECT timestamp,
              (close - LAG(close) OVER (ORDER BY timestamp))
                / LAG(close) OVER (ORDER BY timestamp) AS r1
            FROM Stocks
            WHERE symbol = $1
            AND timestamp::date BETWEEN $2 AND $3
          ),
          allr AS (
            SELECT symbol, timestamp,
              (close - LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp))
                / LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp) AS r2
            FROM Stocks
            WHERE timestamp::date BETWEEN $2 AND $3
          ),
          m AS (
            SELECT timestamp, AVG(r2) AS mr
            FROM allr
            WHERE r2 IS NOT NULL
            GROUP BY timestamp
          ),
          j AS (
            SELECT s.r1, m.mr
            FROM s
            JOIN m ON s.timestamp = m.timestamp
            WHERE s.r1 IS NOT NULL AND m.mr IS NOT NULL
          )
          SELECT COVAR_POP(r1, mr) / VAR_POP(mr) AS beta
          FROM j;
        `;
        const betaRes = await db.query(betaSQL, [sym, start, end]);

        stats.push({
          symbol: sym,
          COV: covRes.rows[0]?.cov ?? null,
          Beta: betaRes.rows[0]?.beta ?? null
        });
      }

      // store in cache
      const insertSQL = `
        INSERT INTO statistics_cache (portfolio_id, start_date, end_date, symbol, cov, beta)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (portfolio_id, start_date, end_date, symbol)
        DO UPDATE SET
          cov = EXCLUDED.cov,
          beta = EXCLUDED.beta,
          updated_at = NOW()
      `;
      for (const s of stats) {
        await db.query(insertSQL, [
          pid,
          start,
          end,
          s.symbol,
          s.COV,
          s.Beta
        ]);
      }
    }

    // calculate correlation matrix
    const matrixSQL = `
      WITH r AS (
        SELECT
          h.symbol,
          s.timestamp::date AS d,
          (s.close - LAG(s.close) OVER (
            PARTITION BY h.symbol ORDER BY s.timestamp
          )) / LAG(s.close) OVER (
            PARTITION BY h.symbol ORDER BY s.timestamp
          ) AS rt
        FROM Holdings h
        JOIN Stocks s ON s.symbol = h.symbol
        WHERE h.portfolioid = $1
        AND s.timestamp::date BETWEEN $2 AND $3
      ),
      p AS (
        SELECT
          r1.symbol AS s1,
          r2.symbol AS s2,
          corr(r1.rt, r2.rt) AS corr_val,
          covar_pop(r1.rt, r2.rt) AS cov_val
        FROM r r1
        JOIN r r2 ON r1.d = r2.d AND r1.symbol <= r2.symbol
        WHERE r1.rt IS NOT NULL AND r2.rt IS NOT NULL
        GROUP BY r1.symbol, r2.symbol
      )
      SELECT * FROM p ORDER BY s1, s2;
    `;
    const matRes = await db.query(matrixSQL, [pid, start, end]);

    res.json({
      stats,
      corrMatrix: matRes.rows
    });

  } catch (err) {
    console.log('stats calc error:', err);
    res.status(500).json({ ok: false });
  }
});


const { SimpleLinearRegression } = require('ml-regression-simple-linear');
// a very simple future prediction based on historical stock prices (one month data)
// using linear regression trend extrapolation (improved)
router.get("/predict/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const days = '30'; // predict for 30 days

  const { rows } = await db.query(
    `
    SELECT timestamp, close
    FROM Stocks
    WHERE symbol = $1
    ORDER BY timestamp DESC
    LIMIT 50;
    `,
    [symbol]
  );

  if (rows.length < 5) {
    return res.status(400).json({ error: "Not enough data to predict" });
  }

  // reverse to chronological order
  const data = rows.reverse();

  // LINEAR REGRESSION SECTION
  const x = data.map((_, i) => i);
  const y = data.map(r => r.close);

  const regression = new SimpleLinearRegression(x, y);

  // slope from regression 
  const slope = regression.slope;

// generate predictions
  let predictions = [];

  const last = data[data.length - 1];

  let lastDate = new Date(last.timestamp);
  let lastP = Number(last.close);

  for (let i = 1; i <= days; i++) {
    lastDate.setDate(lastDate.getDate() + 1);
    const dayIndex = data.length - 1 + i;
    lastP = regression.predict(dayIndex);

    predictions.push({
      date: lastDate.toISOString().slice(0, 10),
      predicted_close: parseFloat(lastP.toFixed(2))
    });
  }
// summarize trend
  let trend;
  let summary;

  if (slope > 0) {
    trend = "upward";
    summary = "The predicted trend is upward, good time to consider buying.";
  } else if (slope < 0) {
    trend = "downward";
    summary = "The predicted trend is downward, avoid buying at the moment.";
  } else {
    trend = "stable";
    summary = "Stock price is predicted to remain relatively stable.";
  }

  res.json({ symbol, predictions, trend, summary });
});


// export the router
module.exports = router;
