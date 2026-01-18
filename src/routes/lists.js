// src/routes/lists.js
const express = require('express');
const db = require('../db');
const router = express.Router();

function requireLogin(req, res, next) {
  // Pretend user with id 1 is logged in.
  /*
  req.userId = 1;
  next();
  */
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not logged in.',
    });
  }
  req.userId = req.session.userId;
  next();
}

// Helper,get one list's basic info
async function getListById(listId) {
  const result = await db.query(
    `
    SELECT
      l.listid,
      l.ownerid,
      l.name,
      l.is_public,
      u.email AS owner_email
    FROM stocklist l
    JOIN users u ON u.userid = l.ownerid
    WHERE l.listid = $1
    `,
    [listId],
  );
  return result.rows[0] || null;
}

// Helper, check if current user can access this list
async function canAccessList(userId, listRow) {
  if (!listRow) return false;

  // Owner always has access
  if (listRow.ownerid === userId) return true;

  if (listRow.is_public) return true;

  const shared = await db.query(
    `
    SELECT 1
    FROM stocklist_shared_with
    WHERE listid = $1 AND userid = $2
    `,
    [listRow.listid, userId],
  );

  return shared.rowCount > 0;
}

// ------------------------------ list ----------------------------- //
// Create a new stock list
router.post('/lists', requireLogin, async (req, res) => {
  const userId = req.userId;
  const { name, is_public } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'List name is required.',
    });
  }

  // default: false (private)
  const visibilityFlag = typeof is_public === 'boolean' ? is_public : false;

  try {
    const result = await db.query(
      `
      INSERT INTO stocklist (ownerid, name, is_public)
      VALUES ($1, $2, $3)
      RETURNING listid, ownerid, name, is_public
      `,
      [userId, name, visibilityFlag],
    );

    return res.json({
      success: true,
      list: result.rows[0],
    });
  } catch (err) {
    console.error('POST /lists error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Only owner can delete a stocklist
router.delete('/lists/:listId', requireLogin, async (req, res) => {
  const userId = req.userId;
  const listId = parseInt(req.params.listId, 10);

  if (Number.isNaN(listId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id.',
    });
  }

  try {
    // First fetch the stocklist to verify it exists and check owner
    const result = await db.query(
      `SELECT ownerid FROM stocklist WHERE listid = $1`,
      [listId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'List not found.',
      });
    }

    const ownerId = result.rows[0].ownerid;

    // Only the owner can delete
    if (ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can delete this list.',
      });
    }

    // Delete the stocklist
    await db.query(`DELETE FROM stocklist WHERE listid = $1`, [listId]);

    return res.json({
      success: true,
      message: 'Stocklist deleted.',
    });
  } catch (err) {
    console.error('DELETE /lists/:listId error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Return all stocklists accessible to the current user,
// each tagged with visibility: 'private' | 'shared' | 'public'.
router.get('/lists', requireLogin, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await db.query(
      `
      SELECT
        l.listid,
        l.ownerid,
        l.name,
        l.is_public,
        u.email AS owner_email,

        -- if it has been shared to any user (at least one), diff from private and shared
        EXISTS (
          SELECT 1
          FROM stocklist_shared_with sw
          WHERE sw.listid = l.listid
        ) AS has_shares,

        -- whther it has been shared to the current user
        EXISTS (
          SELECT 1
          FROM stocklist_shared_with sw2
          WHERE sw2.listid = l.listid AND sw2.userid = $1
        ) AS shared_with_me

      FROM stocklist l
      JOIN users u ON u.userid = l.ownerid

      WHERE
        -- owned by current user
        l.ownerid = $1
        -- or public lists
        OR l.is_public = TRUE
        -- shared with current user
        OR EXISTS (
          SELECT 1
          FROM stocklist_shared_with sw3
          WHERE sw3.listid = l.listid AND sw3.userid = $1
        )

      ORDER BY l.listid
      `,
      [userId],
    );

    const lists = result.rows.map((row) => {
      let visibility;

      if (row.is_public) {
        visibility = 'public';
      } else if (row.has_shares) {
        visibility = 'shared';
      } else {
        visibility = 'private';
      }

      return {
        listid: row.listid,
        name: row.name,
        ownerid: row.ownerid,
        owner_email: row.owner_email,
        is_public: row.is_public,
        visibility, // "private" | "shared" | "public"
      };
    });

    return res.json({
      success: true,
      lists,
    });
  } catch (err) {
    console.error('GET /lists error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Get detailed info of a stocklist that the current user can access.
router.get('/lists/:listId', requireLogin, async (req, res) => {
  const userId = req.userId;
  const listId = parseInt(req.params.listId, 10);

  if (Number.isNaN(listId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id.',
    });
  }

  try {
    // 1. Load basic list info
    const list = await getListById(listId);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found.',
      });
    }

    // 2. Access control
    const allowed = await canAccessList(userId, list);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // 3. Load stocks in this list
    // stockin(listid, symbol, shares)
    const stocksResult = await db.query(
      `
      SELECT symbol, shares
      FROM stockin
      WHERE listid = $1
      ORDER BY symbol
      `,
      [listId],
    );

    const stocks = stocksResult.rows;

    // 4. Compute visibility tag: private / shared / public
    let visibility;

    if (list.is_public) {
      visibility = 'public';
    } else {
      const shareCheck = await db.query(
        `
        SELECT 1
        FROM stocklist_shared_with
        WHERE listid = $1
        LIMIT 1
        `,
        [listId],
      );
      visibility = shareCheck.rowCount > 0 ? 'shared' : 'private';
    }

    // 5. Return combined result
    return res.json({
      success: true,
      list: {
        listid: list.listid,
        ownerid: list.ownerid,
        owner_email: list.owner_email,
        name: list.name,
        is_public: list.is_public,
        visibility, 
      },
      stocks,
    });
  } catch (err) {
    console.error('GET /lists/:listId error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Share a stocklist with another user.
// Only the owner of the list is allowed to share it.
router.post('/lists/:listId/share/:userId', requireLogin, async (req, res) => {
  const ownerId = req.userId;
  const listId = parseInt(req.params.listId, 10);
  const targetUserId = parseInt(req.params.userId, 10);

  // Basic validation
  if (Number.isNaN(listId) || Number.isNaN(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id or user id.',
    });
  }

  if (targetUserId === ownerId) {
    // Sharing to yourself is redundant, but we can just treat it as a no-op.
    return res.json({
      success: true,
      message: 'List is already accessible to the owner.',
    });
  }

  try {
    // 1. Check that the list exists and that the requester is the owner
    const listResult = await db.query(
      `
      SELECT ownerid
      FROM stocklist
      WHERE listid = $1
      `,
      [listId],
    );

    if (listResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'List not found.',
      });
    }

    const listOwnerId = listResult.rows[0].ownerid;

    if (listOwnerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can share this list.',
      });
    }

    // 2. Optionally check that the target user exists
    const userResult = await db.query(
      `
      SELECT userid
      FROM users
      WHERE userid = $1
      `,
      [targetUserId],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found.',
      });
    }

    // 3. Insert the share relation; ignore if it already exists
    await db.query(
      `
      INSERT INTO stocklist_shared_with (listid, userid)
      VALUES ($1, $2)
      ON CONFLICT (listid, userid) DO NOTHING
      `,
      [listId, targetUserId],
    );

    return res.json({
      success: true,
      message: 'List shared successfully.',
    });
  } catch (err) {
    console.error('POST /lists/:listId/share/:userId error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Add or update stocks in a stocklist.
// Only the owner of the list is allowed to modify its stocks.
//
// Expected JSON body:
// {
//   "stocks": [
//     { "symbol": "AAPL", "shares": 10 },
//     { "symbol": "MSFT", "shares": 5 }
//   ]
// }
router.post('/lists/:listId/stocks', requireLogin, async (req, res) => {
  const userId = req.userId;
  const listId = parseInt(req.params.listId, 10);

  if (Number.isNaN(listId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id.',
    });
  }

  const { stocks } = req.body;

  // Basic validation on request body
  if (!Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Field "stocks" must be a non-empty array.',
    });
  }

  try {
    // 1) Check the list exists and get its owner
    const listResult = await db.query(
      `
      SELECT ownerid
      FROM stocklist
      WHERE listid = $1
      `,
      [listId],
    );

    if (listResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'List not found.',
      });
    }

    const ownerId = listResult.rows[0].ownerid;

    // Only owner can modify the stocks
    if (ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the creator can modify this list's stocks.",
      });
    }

    // 2) Insert or update each stock
    for (const item of stocks) {
      if (!item || typeof item.symbol !== 'string') {
        // Skip invalid entries
        continue;
      }
      const symbol = item.symbol.trim();
      const shares = Number(item.shares);

      // Basic shares validation
      if (!symbol || Number.isNaN(shares) || shares < 0) {
        continue;
      }

      await db.query(
        `
        INSERT INTO stockin (listid, symbol, shares)
        VALUES ($1, $2, $3)
        ON CONFLICT (listid, symbol) DO UPDATE
          SET shares = EXCLUDED.shares
        `,
        [listId, symbol, shares],
      );
    }

    // 3) Return the updated list of stocks for this list
    const stocksResult = await db.query(
      `
      SELECT symbol, shares
      FROM stockin
      WHERE listid = $1
      ORDER BY symbol
      `,
      [listId],
    );

    return res.json({
      success: true,
      stocks: stocksResult.rows,
    });
  } catch (err) {
    console.error('POST /lists/:listId/stocks error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Return all stocks in a given stocklist, if the current user can access that list.
router.get('/lists/:listId/stocks', requireLogin, async (req, res) => {
  const userId = req.userId;
  const listId = parseInt(req.params.listId, 10);

  if (Number.isNaN(listId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id.',
    });
  }

  try {
    // 1. Check that the list exists and get basic info
    const listResult = await db.query(
      `
      SELECT listid, ownerid, is_public
      FROM stocklist
      WHERE listid = $1
      `,
      [listId],
    );

    if (listResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'List not found.',
      });
    }

    const list = listResult.rows[0];

    // 2. Check access permission
    let canAccess = false;

    // Owner can always access
    if (list.ownerid === userId) {
      canAccess = true;
    }

    // Public list: anyone can access
    if (!canAccess && list.is_public) {
      canAccess = true;
    }

    // Non-public but shared with this user
    if (!canAccess) {
      const sharedResult = await db.query(
        `
        SELECT 1
        FROM stocklist_shared_with
        WHERE listid = $1 AND userid = $2
        `,
        [listId, userId],
      );
      if (sharedResult.rowCount > 0) {
        canAccess = true;
      }
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // 3. Load stocks in this list
    const stocksResult = await db.query(
      `
      SELECT symbol, shares
      FROM stockin
      WHERE listid = $1
      ORDER BY symbol
      `,
      [listId],
    );

    return res.json({
      success: true,
      stocks: stocksResult.rows,
    });
  } catch (err) {
    console.error('GET /lists/:listId/stocks error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});
// Remove one stock (symbol) from a stocklist.
// Only the owner of the stocklist can delete stocks.
router.delete(
  '/lists/:listId/stocks/:symbol',
  requireLogin,
  async (req, res) => {
    const userId = req.userId;
    const listId = parseInt(req.params.listId, 10);
    const symbol = req.params.symbol;

    if (Number.isNaN(listId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid list id.',
      });
    }

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol.',
      });
    }

    try {
      // 1. Confirm list exists and get owner
      const listResult = await db.query(
        `
      SELECT ownerid
      FROM stocklist
      WHERE listid = $1
      `,
        [listId],
      );

      if (listResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'List not found.',
        });
      }

      const ownerId = listResult.rows[0].ownerid;

      // Only owner can delete stock entries
      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Only the creator can modify this list's stocks.",
        });
      }

      // 2. Delete the stock from the list
      const deleteResult = await db.query(
        `
      DELETE FROM stockin
      WHERE listid = $1 AND symbol = $2
      `,
        [listId, symbol],
      );

      if (deleteResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: `Stock '${symbol}' not found in this list.`,
        });
      }

      return res.json({
        success: true,
        message: `Stock '${symbol}' removed from the list.`,
      });
    } catch (err) {
      console.error('DELETE /lists/:listId/stocks/:symbol error:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error.',
      });
    }
  },
);

// DELETE /lists/:listId/share/:userId
// Remove share permission from a user.
// Only the list owner can perform this.
router.delete(
  '/lists/:listId/share/:userId',
  requireLogin,
  async (req, res) => {
    const ownerId = req.userId;
    const listId = parseInt(req.params.listId, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    // Validate params
    if (Number.isNaN(listId) || Number.isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid list id or user id.',
      });
    }

    try {
      // 1. Check list exists and requester is owner
      const listResult = await db.query(
        `
      SELECT ownerid
      FROM stocklist
      WHERE listid = $1
      `,
        [listId],
      );

      if (listResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'List not found.',
        });
      }

      const listOwnerId = listResult.rows[0].ownerid;

      if (listOwnerId !== ownerId) {
        return res.status(403).json({
          success: false,
          message: 'Only the creator can remove sharing.',
        });
      }

      // Prevent removing share from self (owner always has access)
      if (targetUserId === ownerId) {
        return res.json({
          success: true,
          message: 'Owner always has access; nothing to remove.',
        });
      }

      // 2. Delete share record
      const deleteResult = await db.query(
        `
      DELETE FROM stocklist_shared_with
      WHERE listid = $1 AND userid = $2
      `,
        [listId, targetUserId],
      );

      if (deleteResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'This user does not have share access for this list.',
        });
      }

      return res.json({
        success: true,
        message: 'Share removed successfully.',
      });
    } catch (err) {
      console.error('DELETE /lists/:listId/share/:userId error:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error.',
      });
    }
  },
);

module.exports = router;
