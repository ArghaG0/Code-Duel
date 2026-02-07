const express = require('express');
const router = express.Router();
const { updateUserProfile } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.route('/profile').put(protect, updateUserProfile);

module.exports = router;