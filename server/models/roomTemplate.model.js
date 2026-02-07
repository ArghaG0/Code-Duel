const mongoose = require('mongoose');

const RoomTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    password: { type: String }, 
    rounds: { type: Number, default: 1, max: 5 },
    timeLimit: { type: Number, default: 300 }, 
    problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomProblem' }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoomTemplate', RoomTemplateSchema);