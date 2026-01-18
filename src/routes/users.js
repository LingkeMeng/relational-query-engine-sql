const express = require('express');
const db = require('../db');
const router = express.Router();

function requireLogin(req, res, next) {
  // Pretend user with id 1 is logged in.
  //req.userId = 1;
  //next();
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not logged in.',
    });
  }
  req.userId = req.session.userId;
  next();
}

/**
 * GET /users/me
 * Get current logged-in user info.
 */
router.get('/me', requireLogin, async (req, res) => {
  console.log('>>> /users/me handler reached');
  const userId = req.userId;
  try {
    const result = await db.query(
      'SELECT userid, name, email FROM users WHERE userid = $1',
      [userId],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found.' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /users/me error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/**
 * GET /users/search?q=...
 * Search users by keyword.
 */
router.get('/search', requireLogin, async (req, res) => {
  const q = req.query.q || '';
  try {
    const result = await db.query(
      'SELECT userid, name, email FROM users WHERE email ILIKE $1 LIMIT 20',
      [`%${q}%`],
    );
    return res.json({ results: result.rows });
  } catch (err) {
    console.error('GET /users/search error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/**
 * GET /users/me/friends
 * List all friends of current user.
 */
router.get('/me/friends', requireLogin, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await db.query(
      `
      SELECT u.userid, u.email
      FROM friend f
      JOIN users u
        ON (u.userid = f.userid1 AND f.userid2 = $1)
        OR (u.userid = f.userid2 AND f.userid1 = $1)
      `,
      [userId],
    );
    return res.json({ friends: result.rows });
  } catch (err) {
    console.error('GET /users/me/friends error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/**
 * DELETE /users/me/friends/:friendId
 * Remove a friend.
 */
router.delete('/me/friends/:friendId', requireLogin, async (req, res) => {
  const userId = req.userId;
  const friendId = req.params.friendId;
  try {
    await db.query(
      `
      DELETE FROM friend
      WHERE (userid1 = $1 AND userid2 = $2)
         OR (userid1 = $2 AND userid2 = $1)
      `,
      [userId, friendId],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users/me/friends/:friendId error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/**
 * GET /users/me/friend-requests?type=incoming|outgoing
 */
router.get('/me/friend-requests', requireLogin, async (req, res) => {
  const userId = req.userId;
  const type = req.query.type || 'incoming';

  let sql, params;
  if (type === 'outgoing') {
    sql = `
      SELECT
          r.requestid,
          r.fromuserid AS fromuserid,
          r.touserid   AS touserid,
          r.status,
          r.created_at AS created_at,
          u.email      AS to_email,
          u.name  AS from_name 
      FROM request r
      JOIN users u ON u.userid = r.touserid
      WHERE r.fromuserid = $1
    `; // change!!!le
    params = [userId];
  } else {
    sql = `
      SELECT
          r.requestid,
          r.fromuserid AS fromuserid,
          r.touserid   AS touserid,
          r.status,
          r.created_at AS created_at,
          u.email      AS from_email,
          u.name  AS from_name
      FROM request r
      JOIN users u ON u.userid = r.fromuserid
      WHERE r.touserid = $1
    `;
    params = [userId];
  }

  try {
    const result = await db.query(sql, params);
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('GET /users/me/friend-requests error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/**
 * POST /users/me/friend-requests/:requestId/accept
 */
router.post(
  '/me/friend-requests/:requestId/accept',
  requireLogin,
  async (req, res) => {
    const userId = req.userId;
    const requestId = parseInt(req.params.requestId, 10);

    try {
      const result = await db.query(
        `SELECT requestid, fromuserid, touserid, status
       FROM request
       WHERE requestid = $1`,
        [requestId],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Request not found.' });
      }

      const row = result.rows[0];
      const fromId = row.fromuserid;
      const toId = row.touserid;

      if (toId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not allowed to accept this request.',
        });
      }

      if (row.status !== 'PENDING') {
        return res
          .status(400)
          .json({ success: false, message: 'Request is not pending.' });
      }

      // ACCEPTED
      await db.query(
        `UPDATE request
       SET status = 'ACCEPTED'
       WHERE requestid = $1`,
        [requestId],
      );
      const id1 = Math.min(fromId, toId);
      const id2 = Math.max(fromId, toId);

      await db.query(
        `INSERT INTO friend (userid1, userid2)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
        [id1, id2],
      );

      return res.json({ success: true });
    } catch (err) {
      console.error(
        'POST /users/me/friend-requests/:requestId/accept error:',
        err,
      );
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  },
);

/**
 * POST /users/me/friend-requests/:requestId/reject
 */
router.post(
  '/me/friend-requests/:requestId/reject',
  requireLogin,
  async (req, res) => {
    const userId = req.userId;
    const requestId = parseInt(req.params.requestId, 10);

    try {
      const result = await db.query(
        `SELECT requestid, fromuserid, touserid, status
       FROM request
       WHERE requestid = $1`,
        [requestId],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Request not found.' });
      }

      const row = result.rows[0];

      if (row.touserid !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not allowed to reject this request.',
        });
      }

      if (row.status !== 'PENDING') {
        return res
          .status(400)
          .json({ success: false, message: 'Request is not pending.' });
      }

      await db.query(
        `UPDATE request
       SET status = 'REJECTED'
       WHERE requestid = $1`,
        [requestId],
      );

      return res.json({ success: true });
    } catch (err) {
      console.error(
        'POST /users/me/friend-requests/:requestId/reject error:',
        err,
      );
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  },
);

/**
 * POST /users/:userId/friend-requests
 * Send a friend request to another user.
 */
/**
 * POST /users/:userId/friend-requests
 * Send a friend request to another user.
 */
router.post('/:userId/friend-requests', requireLogin, async (req, res) => {
  const fromId = req.userId;
  const toId = parseInt(req.params.userId, 10);

  if (Number.isNaN(toId)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid target user id.' });
  }

  if (fromId === toId) {
    return res
      .status(400)
      .json({ success: false, message: 'Cannot send request to yourself.' });
  }

  try {
    const userCheck = await db.query(
      'SELECT userid FROM users WHERE userid = $1',
      [toId],
    );
    if (userCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Target user not found.' });
    }
    const [id1, id2] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const friendCheck = await db.query(
      `
      SELECT 1
      FROM friend
      WHERE userid1 = $1 AND userid2 = $2
      `,
      [id1, id2],
    );
    if (friendCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: 'You are already friends.' });
    }

    const pendingCheck = await db.query(
      `
      SELECT 1
      FROM request
      WHERE status = 'PENDING'
        AND (
          (fromuserid = $1 AND touserid = $2) OR
          (fromuserid = $2 AND touserid = $1)
        )
      `,
      [fromId, toId],
    );
    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'There is already a pending request between you and this user.',
      });
    }

    const result = await db.query(
      `
      INSERT INTO request (fromuserid, touserid, status)
      VALUES ($1, $2, 'PENDING')
      RETURNING requestid
      `,
      [fromId, toId],
    );

    return res.status(201).json({
      success: true,
      requestId: result.rows[0].requestid,
    });
  } catch (err) {
    console.error('POST /users/:userId/friend-requests error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/:userId', requireLogin, async (req, res) => {
  const targetId = req.params.userId;
  try {
    const result = await db.query(
      'SELECT userid, email FROM users WHERE userid = $1',
      [targetId],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found.' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /users/:userId error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
