const mongoose = require('mongoose');

const CustomProblemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    starterCode: { type: String, required: true },
    testCases: [{
        input: { type: String, required: true },
        output: { type: String, required: true }
    }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomProblem', CustomProblemSchema);