const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

const validCredentials = (email, password) =>
    typeof email === 'string' && email.trim().length > 0 && email.length <= 254 &&
    typeof password === 'string' && password.length > 0;

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// --- REGISTER USER (Existing Function) ---
exports.registerUser = async (req, res) => {
    // ... (your existing registerUser code is here) ...
    const { username, email, password } = req.body || {};
    try {
        if (!validCredentials(email, password) || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72 ||
            typeof username !== 'string' || !username.trim() || username.length > 100) {
            return res.status(400).json({ message: 'Invalid credentials. Use a password of at least 6 characters and at most 72 UTF-8 bytes.' });
        }
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const user = await User.create({ username, email, password });
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


// --- LOGIN USER (New Function) ---
exports.loginUser = async (req, res) => {
    const { email, password } = req.body || {};

    if (!validCredentials(email, password)) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    try {
        const user = await User.findOne({ email });

        // Check if user exists AND if passwords match
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            // Use a generic message for security
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.log("--- THE LOGIN ATTEMPT FAILED AND THE CATCH BLOCK WAS EXECUTED ---"); // <-- Add this line
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
exports.getUserProfile = async (req, res) => {
    // req.user is set by the protect middleware
    res.status(200).json(req.user); 
};
