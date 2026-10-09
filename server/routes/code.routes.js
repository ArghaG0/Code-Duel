const express = require('express');
const router = express.Router();
const { executeCode, submitCode } = require('../controllers/code.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/execute', protect, executeCode);
router.post('/submit', protect, submitCode);

module.exports = router;
