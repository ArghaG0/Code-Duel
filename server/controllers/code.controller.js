const axios = require('axios');
const Problem = require('../models/problem.model');
const CustomProblem = require('../models/customProblem.model');

// Bound outstanding remote work per process and per authenticated account.
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

const runPiston = async (code, language) => {
    const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
        language: language || 'javascript',
        version: '18.15.0',
        files: [{ content: code }]
    }, {
        timeout: 10000,
        signal: AbortSignal.timeout(15000),
        maxContentLength: 1024 * 1024,
        maxBodyLength: 256 * 1024,
        maxRedirects: 0
    });
    return response.data.run;
};

exports.executeCode = withExecutionLimit(async (req, res) => {
    const { code, language } = req.body;
    if (!code) return res.status(400).json({ output: "No code provided." });

    try {
        const result = await runPiston(code, language);
        res.json({ output: result.output });
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
    const { code, language, problemId } = req.body;

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
        
        const results = [];
        let allPassed = true;

        for (let i = 0; i < problem.testCases.length; i++) {
            const testCase = problem.testCases[i];
            
            // Use a special prefix that we can easily find in the output
            // We print on a new line to ensure it's separated from user logs
            const testHarness = `
${code}

console.log("\\n___RESULT::" + JSON.stringify(${functionName}(${testCase.input})));
`;
            const result = await runPiston(testHarness, language);
            const rawOutput = result.output || "";
            
            // PARSING LOGIC:
            // 1. Split output by newlines
            // 2. Find the line that starts with ___RESULT::
            // 3. Parse the JSON after that prefix
            const lines = rawOutput.trim().split('\n');
            let actualOutput = "undefined";
            
            for (let j = lines.length - 1; j >= 0; j--) {
                const line = lines[j].trim();
                if (line.startsWith('___RESULT::')) {
                    actualOutput = line.replace('___RESULT::', '');
                    break;
                }
            }

            // Strict string comparison
            const expectedOutput = testCase.output.trim();
            const passed = result.code === 0 && !result.signal && actualOutput === expectedOutput;
            
            if (!passed) {
                allPassed = false;
                // Optional: Log for server debugging
                // console.log(`Test ${i+1} Failed. Got: ${actualOutput}, Expected: ${expectedOutput}`);
            }

            results.push({
                id: i + 1,
                passed,
                input: testCase.input,
                expected: expectedOutput,
                actual: actualOutput
            });
        }

        res.json({ 
            success: allPassed, 
            results: results 
        });

    } catch (error) {
        console.error('Code submission failed');
        res.status(500).json({ message: "Server Error during submission" });
    }
});
