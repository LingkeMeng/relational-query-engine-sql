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

// ------------------------ list access helpers ------------------------ //

// Get basic info about a list
async function getListAccessInfo(listId) {
  const result = await db.query(
    `
    SELECT listid, ownerid, is_public
    FROM stocklist
    WHERE listid = $1
    `,
    [listId],
  );
  return result.rows[0] || null;
}

// Check if current user can access the list at all
async function canAccessList(userId, listInfo) {
  if (!listInfo) return false;

  // Owner can always access
  if (listInfo.ownerid === userId) return true;

  if (listInfo.is_public) return true;

  const shared = await db.query(
    `
    SELECT 1
    FROM stocklist_shared_with
    WHERE listid = $1 AND userid = $2
    `,
    [listInfo.listid, userId],
  );

  return shared.rowCount > 0;
}

// ------------------------ POST /lists/:listId/reviews ------------------------ //
/**
 * Create or update the current user's review for a list.
 *
 * Rules:
 * - User must have access to the list (owner / shared-with / public).
 * - At most one review per (user, list).
 * - If a review already exists, we treat this as "edit" and update content.
 * - Content length <= 4000 characters.
 */
router.post('/lists/:listId/reviews', requireLogin, async (req, res) => {
  const userId = req.userId;
  const listId = parseInt(req.params.listId, 10);
  const { content } = req.body;

  // Basic validation
  if (Number.isNaN(listId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id.',
    });
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Review content is required.',
    });
  }

  if (content.length > 4000) {
    return res.status(400).json({
      success: false,
      message: 'Review content must be at most 4000 characters.',
    });
  }

  try {
    // 1) Check list exists and access
    const listInfo = await getListAccessInfo(listId);
    if (!listInfo) {
      return res.status(404).json({
        success: false,
        message: 'List not found.',
      });
    }

    const allowed = await canAccessList(userId, listInfo);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this list.',
      });
    }

    // 2) Check if user already has a review for this list
    const existing = await db.query(
      `
      SELECT reviewid, listid, userid, content, created_at, updated_at
      FROM review
      WHERE listid = $1 AND userid = $2
      `,
      [listId, userId],
    );

    let reviewRow;
    let created;

    if (existing.rowCount === 0) {
      // 3a) No existing review → INSERT new one
      const insertResult = await db.query(
        `
        INSERT INTO review (listid, userid, content, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING reviewid, listid, userid, content, created_at, updated_at
        `,
        [listId, userId, content.trim()],
      );
      reviewRow = insertResult.rows[0];
      created = true;
    } else {
      // 3b) Existing review → UPDATE content (edit)
      const reviewId = existing.rows[0].reviewid;
      const updateResult = await db.query(
        `
        UPDATE review
        SET content = $1,
            updated_at = NOW()
        WHERE reviewid = $2
        RETURNING reviewid, listid, userid, content, created_at, updated_at
        `,
        [content.trim(), reviewId],
      );
      reviewRow = updateResult.rows[0];
      created = false;
    }

    return res.json({
      success: true,
      created, 
      review: reviewRow,
    });
  } catch (err) {
    console.error('POST /lists/:listId/reviews error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});


// List all reviews for a given stock list that the current user is allowed to see.
router.get('/lists/:listId/reviews', requireLogin, async (req, res) => {
  const userId = req.userId;
  const listId = parseInt(req.params.listId, 10);

  if (Number.isNaN(listId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list id.',
    });
  }

  try {
    // 1. Check list exists
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

    const listInfo = listResult.rows[0];
    const ownerId = listInfo.ownerid;
    const isPublic = listInfo.is_public;

    // 2. Check access: owner OR public OR shared
    let allowed = ownerId === userId || isPublic;

    if (!allowed) {
      const shared = await db.query(
        `
        SELECT 1
        FROM stocklist_shared_with
        WHERE listid = $1 AND userid = $2
        `,
        [listId, userId],
      );
      allowed = shared.rowCount > 0;
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this list.',
      });
    }

    // 3. Load all reviews for this list
    const reviewsResult = await db.query(
      `
      SELECT r.reviewid,
             r.userid,
             r.content,
             r.created_at,
             r.updated_at,
             u.email AS user_email
      FROM review r
      JOIN users u ON u.userid = r.userid
      WHERE r.listid = $1
      ORDER BY r.created_at DESC
      `,
      [listId],
    );

    // 4. Filter according to visibility rules for non-public lists:
    //    - public list: everyone who can access the list sees all reviews
    //    - non-public: only reviewer and list owner can see each review
    const visibleReviews = reviewsResult.rows.filter((row) => {
      if (isPublic) return true;
      if (row.userid === userId) return true; // reviewer
      if (ownerId === userId) return true; // list owner
      return false;
    });

    return res.json({
      success: true,
      reviews: visibleReviews,
    });
  } catch (err) {
    console.error('GET /lists/:listId/reviews error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// Delete a review. Only the reviewer or the list owner can delete.
router.delete(
  '/lists/:listId/reviews/:reviewId',
  requireLogin,
  async (req, res) => {
    const userId = req.userId;
    const listId = parseInt(req.params.listId, 10);
    const reviewId = parseInt(req.params.reviewId, 10);

    if (Number.isNaN(listId) || Number.isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid list id or review id.',
      });
    }

    try {
      // 1. Load the review and its list info in one query
      const reviewResult = await db.query(
        `
      SELECT r.reviewid,
             r.listid,
             r.userid AS reviewer_id,
             r.content,
             r.created_at,
             r.updated_at,
             l.ownerid AS list_owner_id,
             l.is_public
      FROM review r
      JOIN stocklist l ON l.listid = r.listid
      WHERE r.reviewid = $1 AND r.listid = $2
      `,
        [reviewId, listId],
      );

      if (reviewResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Review not found for this list.',
        });
      }

      const row = reviewResult.rows[0];
      const reviewerId = row.reviewer_id;
      const listOwnerId = row.list_owner_id;

      // 2. Permission check: only reviewer or list owner
      if (userId !== reviewerId && userId !== listOwnerId) {
        return res.status(403).json({
          success: false,
          message: 'Not allowed to delete this review.',
        });
      }

      // 3. Perform deletion
      await db.query(
        `
      DELETE FROM review
      WHERE reviewid = $1
      `,
        [reviewId],
      );

      return res.json({
        success: true,
        message: 'Review deleted.',
      });
    } catch (err) {
      console.error('DELETE /lists/:listId/reviews/:reviewId error:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error.',
      });
    }
  },
);

module.exports = router;
