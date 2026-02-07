const Match = require('../models/match.model');

exports.getMatchHistory = async (req, res) => {
    try {
        const matches = await Match.find({
            'players.userId': req.user._id
        }).sort({ playedAt: -1 }).limit(20);

        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};