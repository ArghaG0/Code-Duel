const express = require('express');
const router = express.Router();
const { executeCode, submitCode } = require('../controllers/code.controller');

router.post('/execute', executeCode);
router.post('/submit', submitCode); // <--- New Route

module.exports = router;