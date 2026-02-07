const axios = require('axios');
const Problem = require('../models/problem.model');
const CustomProblem = require('../models/customProblem.model');

const runPiston = async (code, language) => {
    const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
        language: language || 'javascript',
        version: '18.15.0',
        files: [{ content: code }]
    });
    return response.data.run;
};

exports.executeCode = async (req, res) => {
    const { code, language } = req.body;
    if (!code) return res.status(400).json({ output: "No code provided." });

    try {
        const result = await runPiston(code, language);
        res.json({ output: result.output });
    } catch (error) {
        console.error(error);
        res.status(500).json({ output: "Error executing code." });
    }
};

// Extract function name from starter code (e.g. "function solution(input) {" -> "solution")
const getFunctionName = (starterCode) => {
    if (!starterCode || typeof starterCode !== 'string') return 'solution';
    const match = starterCode.match(/\bfunction\s+(\w+)\s*\(/);
    return match ? match[1] : 'solution';
};

exports.submitCode = async (req, res) => {
    const { code, language, problemId } = req.body;

    try {
        if (!problemId) return res.status(400).json({ message: "problemId is required" });

        let problem = await Problem.findById(problemId);
        if (!problem) problem = await CustomProblem.findById(problemId);
        if (!problem) return res.status(404).json({ message: "Problem not found" });

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
            const passed = actualOutput === expectedOutput;
            
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
        console.error(error);
        res.status(500).json({ message: "Server Error during submission" });
    }
};