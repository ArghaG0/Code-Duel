const { runSandbox } = require('../services/sandbox');
const Problem = require('../models/problem.model');
const CustomProblem = require('../models/customProblem.model');

// Bound outstanding sandbox work per process and per authenticated account.
const activeUsers = new Set();
const withExecutionLimit = handler => async (req, res) => {
    const userId = req.user?._id?.toString();
    if (!userId) return res.status(401).json({ message: 'Not authorized' });
    const { code, language } = req.body || {};
    if (typeof code !== 'string' || !code.trim() || Buffer.byteLength(code, 'utf8') > 50000 ||
        (language !== undefined && language !== 'javascript')) {
        return res.status(400).json({ message: 'Provide JavaScript code of at most 50000 UTF-8 bytes.' });
    }
    if (activeUsers.has(userId) || activeUsers.size >= 4) {
        return res.status(429).json({ message: 'Execution capacity busy. Try again shortly.' });
    }
    activeUsers.add(userId);
    try {
        return await handler(req, res);
    } finally {
        activeUsers.delete(userId);
    }
};

exports.executeCode = withExecutionLimit(async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ output: "No code provided." });

    try {
        const [result] = await runSandbox(code);
        res.json({ output: result.output + (result.error ? `\n${result.error}` : '') });
    } catch (error) {
        console.error('Code execution failed');
        res.status(500).json({ output: "Error executing code." });
    }
});

// Extract function name from starter code (e.g. "function solution(input) {" -> "solution")
const getFunctionName = (starterCode) => {
    if (!starterCode || typeof starterCode !== 'string') return 'solution';
    const match = starterCode.match(/\bfunction\s+(\w+)\s*\(/);
    return match ? match[1] : 'solution';
};

exports.submitCode = withExecutionLimit(async (req, res) => {
    const { code, problemId } = req.body;

    try {
        if (typeof problemId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(problemId)) {
            return res.status(400).json({ message: 'A valid problemId is required' });
        }

        let problem = await Problem.findById(problemId);
        if (!problem) problem = await CustomProblem.findById(problemId);
        if (!problem) return res.status(404).json({ message: "Problem not found" });

        if (!Array.isArray(problem.testCases) || problem.testCases.length < 1 || problem.testCases.length > 20 ||
            problem.testCases.some(testCase => typeof testCase.input !== 'string' || typeof testCase.output !== 'string' ||
                Buffer.byteLength(testCase.input, 'utf8') > 10000 || Buffer.byteLength(testCase.output, 'utf8') > 10000)) {
            return res.status(400).json({ message: 'Problem must have 1-20 test cases with input/output of at most 10000 UTF-8 bytes each.' });
        }

        const functionName = getFunctionName(problem.starterCode);
        
        const executions = await runSandbox(code, problem.testCases.map(testCase =>
            functionName + '(' + testCase.input + ')'));
        const results = problem.testCases.map((testCase, i) => {
            const result = executions[i];
            const expected = testCase.output.trim();
            return {
                id: i + 1,
                passed: !result.error && result.actual === expected,
                input: testCase.input,
                expected,
                actual: result.error || result.actual
            };
        });
        const allPassed = results.every(result => result.passed);

        res.json({ 
            success: allPassed, 
            results: results 
        });

    } catch (error) {
        console.error('Code submission failed');
        res.status(500).json({ message: "Server Error during submission" });
    }
});
