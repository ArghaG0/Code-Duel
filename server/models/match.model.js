const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['ranked', 'custom'],
        default: 'ranked'
    },
    players: [{
        userId: { type: String },
        username: { type: String },
        score: { type: Number, default: 0 },
        result: { type: String, enum: ['win', 'loss', 'draw'] }
    }],
    winnerId: {
        type: String
    },
    endReason: {
        type: String,
        default: 'Score Limit'
    },
    playedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Match', MatchSchema);