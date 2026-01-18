// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

const SALT_ROUNDS = 10;

/**
 * POST /auth/register
 * Register a new user.
 */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email and password are required.',
    });
  }

  try {
    // Check if email already exists
    const existing = await db.query(
      'SELECT userid FROM users WHERE email = $1',
      [email],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user (now including name)
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING userid, name, email`,
      [name, email, passwordHash],
    );

    const user = result.rows[0];

    // Auto-login after register
    if (req.session) {
      req.session.userId = user.userid;
    }

    return res.status(201).json({
      success: true,
      user: {
        userid: user.userid,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

/**
 * POST /auth/login
 * Log in with email and password.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.',
    });
  }

  try {
    // Find user by email
    const result = await db.query(
      'SELECT userid, email, password_hash FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      // Do not reveal whether email exists
      return res.status(401).json({
        success: false,
        message: 'Wrong email or password.',
      });
    }

    const user = result.rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Wrong email or password.',
      });
    }

    // Save userId in session
    req.session.userId = user.userid;
    console.log('after login, session =', req.session); // debug log

    return res.json({
      success: true,
      user: {
        userid: user.userid,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

/**
 * POST /auth/logout
 * Log out current user.
 */
router.post('/logout', (req, res) => {
  console.log('POST /auth/logout hit, current session =', req.session);
  if (!req.session) {
    return res.json({ success: true });
  }

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error('POST /auth/logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error.',
      });
    }
    return res.json({ success: true });
  });
});

module.exports = router;
