const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Problem = require('../models/problem.model');

dotenv.config({ path: require('node:path').resolve(__dirname, '../../.env') });

const problems = [
    {
        title: "Two Sum",
        description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
        difficulty: "Easy",
        starterCode: `function twoSum(nums, target) {
  // Write your solution here
  
}

// Example Test Case
console.log(twoSum([2, 7, 11, 15], 9));`,
        testCases: [
            { input: "[2,7,11,15], 9", output: "[0,1]" },
            { input: "[3,2,4], 6", output: "[1,2]" },
            { input: "[3,3], 6", output: "[0,1]" }
        ]
    },
    {
        title: "Palindrome Number",
        description: "Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise.",
        difficulty: "Easy",
        starterCode: `function isPalindrome(x) {
  // Write your solution here
  
}

// Example Test Case
console.log(isPalindrome(121));`,
        testCases: [
            { input: "121", output: "true" },
            { input: "-121", output: "false" },
            { input: "10", output: "false" }
        ]
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB...");
        await Problem.deleteMany();
        await Problem.insertMany(problems);
        console.log("✅ Coding Problems Seeded!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDB();
