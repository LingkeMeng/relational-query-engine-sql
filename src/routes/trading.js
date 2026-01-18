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

// Buy stocks (creating holdings if not existing)
router.post('/buy',requireLogin, async (req, res) => {
    // get incoming data
    let { portfolioId, symbol, sharesCount, pricePerShare } = req.body;
    //convert to number , bug if not
    const sharesCountNum = Number(sharesCount);
    // if price is not filled, use last closing price from Stocks table
    if (pricePerShare === null || pricePerShare === undefined || isNaN(pricePerShare)) {
        const q = await db.query(`
          SELECT close FROM Stocks
          WHERE symbol = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `, [symbol]);
    
        if (q.rowCount === 0) {
          return res.status(400).json({ error: "No price data for this symbol." });
        }
    
        pricePerShare = q.rows[0].close;  
      }
    
    const pricePerShareNum = Number(pricePerShare);
    // Vaildation on data input
    if (!portfolioId || !symbol || !sharesCountNum) {
        return res.status(400).json({ error: 'portfolioId, symbol, sharesCount are required.' });
    }

    try{
        //selected portfolio belongs to logged-in user
        const portfolioUserCheck = await db.query(
            'SELECT PortfolioID FROM Portfolio WHERE PortfolioID = $1 AND UserID = $2',
            [portfolioId, req.userId]
        );
        if (portfolioUserCheck.rows.length === 0) {
            return res.status(403).json({ error: 'The portfolio does not belong to this user.' });
        }
        // symbol must appear in Stocks symbol list
        const stockCheck = await db.query(
            'SELECT symbol FROM StockSymbols WHERE symbol = $1',
            [symbol]
        );
        if (stockCheck.rows.length === 0) {
            return res.status(400).json({ error: 'This stock symbol is not available.' });
        }
        //Validate sharesCount and pricePerShare are positive numbers
        if (sharesCountNum <= 0 || pricePerShareNum <= 0) {
            return res.status(400).json({ error: 'sharesCount and pricePerShare must be positive numbers.' });
        }
        // Validate there is enough cash in portfolio to make the purchase
        const totalCost = sharesCountNum * pricePerShareNum;  // old total cost 
        const cashCheck = await db.query(
            'SELECT CashBalance FROM Portfolio WHERE PortfolioID = $1',
            [portfolioId]
        );
        const currentCash = Number(cashCheck.rows[0].cashbalance);
        if (currentCash < totalCost) {
            return res.status(400).json({ error: 'Not enough cash in balance to complete this action.' });
        }

        // Check if holding already exists for this stock in the portfolio
        const holdingExist = await db.query(
            'SELECT HoldingID, Shares, AvgPrice FROM Holdings WHERE PortfolioID = $1 AND Symbol = $2',
            [portfolioId, symbol]
        );
        // If exists, update the shares count and deduct cash and avg price
        if (holdingExist.rows.length > 0) { 
            const oldAvg = holdingExist.rows[0].avgprice || 0;
            const newCount = holdingExist.rows[0].shares + sharesCountNum;
            // calculate new average price
            const newAvgPrice = Number(((oldAvg * holdingExist.rows[0].shares) + (pricePerShareNum * sharesCountNum)) / newCount);
            await db.query(
                'UPDATE Holdings SET Shares = $1 , AvgPrice = $2 WHERE HoldingID = $3',
                [newCount, newAvgPrice, holdingExist.rows[0].holdingid]
            );
        } else {
            // If not exists, create a new holding and calculate avg price
            const avgPrice = pricePerShareNum;
            await db.query(
                'INSERT INTO Holdings (PortfolioID, Symbol, Shares, AvgPrice) VALUES ($1, $2, $3, $4)',
                [portfolioId, symbol, sharesCountNum, avgPrice]
            );
        }
        // Deduct the total cost from portfolio cash balance
        const newBalance = currentCash - totalCost;
        await db.query(
            'UPDATE Portfolio SET CashBalance = $1 WHERE PortfolioID = $2',
            [newBalance, portfolioId]
        );
        // Record the transaction
        const detail = `Bought ${sharesCountNum} shares of ${symbol} at $${pricePerShareNum} each.`;
        await db.query(
            'INSERT INTO Transaction (PortfolioID, Amount, Detail) VALUES ($1, $2, $3)',
            [portfolioId, -totalCost, detail]
        );
        return res.json({  message: 'Stock purchase successful, with updated holdings and cash balance.' });
    } catch (err) {
        console.error('Error processing stock purchase:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

});

// Sell stocks (updating holdings)
router.post('/sell', requireLogin, async (req, res) => {
    let { portfolioId, symbol, sharesCount, pricePerShare } = req.body;
    const sharesCountNum = Number(sharesCount);

    // if price is not filled, use last closing price from Stocks table
    if (pricePerShare === null || pricePerShare === undefined || isNaN(pricePerShare)) {
        const q = await db.query(`
          SELECT close FROM Stocks
          WHERE symbol = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `, [symbol]);
    
        if (q.rowCount === 0) {
          return res.status(400).json({ error: "No price data for this symbol." });
        }
    
        pricePerShare = q.rows[0].close;  
      }
      const pricePerShareNum = Number(pricePerShare);
    // Validation

    if (!portfolioId || !symbol || !sharesCountNum ) {
        return res.status(400).json({ error: 'portfolioId, symbol, sharesCount, are required.' });
    }
    if (sharesCountNum <= 0 || pricePerShareNum <= 0) {
        return res.status(400).json({ error: 'sharesCount and pricePerShare must be positive numbers.' });
    }
    
    try {
        // Check if portfolio belongs to user
        const portfolioUserCheck = await db.query(
            'SELECT PortfolioID FROM Portfolio WHERE PortfolioID = $1 AND UserID = $2',
            [portfolioId, req.userId]
        );
        if (portfolioUserCheck.rows.length === 0) {
            return res.status(403).json({ error: 'The portfolio does not belong to this user.' });
        }

        // Check if symbol exists
        const stockCheck = await db.query(
            'SELECT symbol FROM StockSymbols WHERE symbol = $1',
            [symbol]
        );
        if (stockCheck.rows.length === 0) {
            return res.status(400).json({ error: 'This stock symbol is not available.' });
        }

        // Get existing holding (must exist to sell)
        const holdingExist = await db.query(
            'SELECT HoldingID, Shares, AvgPrice FROM Holdings WHERE PortfolioID = $1 AND Symbol = $2',
            [portfolioId, symbol]
        );
        if (holdingExist.rows.length === 0) {
            return res.status(400).json({ error: 'No existing holding for this stock.' });
        }
        const oldShares = holdingExist.rows[0].shares;
        // Validate enough shares to sell
        if (oldShares < sharesCountNum) {
            return res.status(400).json({ error: 'Not enough shares to sell.' });
        }
        const holdingId = holdingExist.rows[0].holdingid;

        // Calculate proceeds
        const totalProceeds = sharesCountNum * pricePerShareNum;
        // selling some but not all
        if (oldShares > sharesCountNum) {
            const newCount = oldShares - sharesCountNum;

            // avgPrice does NOT change
            await db.query(
                'UPDATE Holdings SET Shares = $1 WHERE HoldingID = $2',
                [newCount, holdingId]
            );

        } else {
            // Selling ALL shares, when this happens delete this holding
            await db.query(
                'DELETE FROM Holdings WHERE HoldingID = $1',
                [holdingId]
            );
        }

        // Update the cash balance of the portfolio
        const cashCheck = await db.query(
            'SELECT CashBalance FROM Portfolio WHERE PortfolioID = $1',
            [portfolioId]
        );
        const currentCash = Number(cashCheck.rows[0].cashbalance);
        const newBalance = Number(currentCash + totalProceeds);
        await db.query(
            'UPDATE Portfolio SET CashBalance = $1 WHERE PortfolioID = $2',
            [newBalance, portfolioId]
        );

        // Record transaction
        const detail = `Sold ${sharesCountNum} shares of ${symbol} at $${pricePerShareNum} each.`;
        await db.query(
            'INSERT INTO Transaction (PortfolioID, Amount, Detail) VALUES ($1, $2, $3)',
            [portfolioId, totalProceeds, detail]          
        );

        return res.json({ message: 'Stock sell successful, with updated holdings and cash balance.' });

    } catch (err) {
        console.error('Error processing stock sell:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});



module.exports = router;