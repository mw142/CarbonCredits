const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { chat, getGroqClient } = require('../lib/chatbot');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    configured: Boolean(getGroqClient()),
    provider: 'groq',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  });
});

router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const result = await chat({
      messages: req.body?.messages,
      user: req.user || null,
      language: typeof req.body?.language === 'string' ? req.body.language.slice(0, 5) : 'en',
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[ai/chat]', err);
    res.status(status).json({
      error: err.message || 'Chat request failed.',
    });
  }
});

module.exports = router;
