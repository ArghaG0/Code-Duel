const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getMatchHistory } = require('../controllers/match.controller');

router.get('/history', protect, getMatchHistory);

module.exports = router;