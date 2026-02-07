const CustomProblem = require('../models/customProblem.model');
const RoomTemplate = require('../models/roomTemplate.model');

exports.createProblem = async (req, res) => {
    try {
        const { title, description, starterCode, testCases } = req.body;
        
        const problem = await CustomProblem.create({
            title,
            description,
            starterCode,
            testCases,
            owner: req.user._id
        });

        res.status(201).json(problem);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getMyProblems = async (req, res) => {
    try {
        const problems = await CustomProblem.find({ owner: req.user._id });
        res.json(problems);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const { name, password, rounds, timeLimit, problemIds } = req.body;

        const template = await RoomTemplate.create({
            name,
            password, 
            rounds,
            timeLimit,
            problems: problemIds,
            owner: req.user._id
        });

        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.getMyTemplates = async (req, res) => {
    try {
        const templates = await RoomTemplate.find({ owner: req.user._id })
            .populate('problems');
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const { name, password, rounds, timeLimit, problemIds } = req.body;
        
        const template = await RoomTemplate.findById(req.params.id);
        
        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }

        if (template.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized" });
        }

        template.name = name;
        template.password = password;
        template.rounds = rounds;
        template.timeLimit = timeLimit;
        template.problems = problemIds;

        const updatedTemplate = await template.save();
        res.json(updatedTemplate);

    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const template = await RoomTemplate.findById(req.params.id);
        
        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }

        if (template.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized" });
        }

        await template.deleteOne();
        res.json({ message: "Template removed" });

    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};