const mongoose = require('mongoose');

const ProblemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true }, // Supports Markdown/HTML
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    starterCode: { type: String, required: true }, // The function signature
    testCases: [
        {
            input: { type: String, required: true },
            output: { type: String, required: true }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Problem', ProblemSchema);