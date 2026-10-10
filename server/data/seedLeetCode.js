const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Problem = require('../models/problem.model');

dotenv.config({ path: require('node:path').resolve(__dirname, '../../.env') });

const problems = [
    {
        title: "Two Sum",
        description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        difficulty: "Easy",
        starterCode: "function twoSum(nums, target) {\n  \n}",
        testCases: [
            { input: "[2,7,11,15], 9", output: "[0,1]" },
            { input: "[3,2,4], 6", output: "[1,2]" }
        ]
    },
    {
        title: "Valid Parentheses",
        description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
        difficulty: "Easy",
        starterCode: "function isValid(s) {\n  \n}",
        testCases: [
            { input: "'()'", output: "true" },
            { input: "'()[]{}'", output: "true" },
            { input: "'(]'", output: "false" }
        ]
    },
    {
        title: "Best Time to Buy and Sell Stock",
        description: "You are given an array prices where prices[i] is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.",
        difficulty: "Easy",
        starterCode: "function maxProfit(prices) {\n  \n}",
        testCases: [
            { input: "[7,1,5,3,6,4]", output: "5" },
            { input: "[7,6,4,3,1]", output: "0" }
        ]
    },
    {
        title: "Valid Palindrome",
        description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.",
        difficulty: "Easy",
        starterCode: "function isPalindrome(s) {\n  \n}",
        testCases: [
            { input: "'A man, a plan, a canal: Panama'", output: "true" },
            { input: "'race a car'", output: "false" }
        ]
    },
    {
        title: "Invert Binary Tree",
        description: "Given the root of a binary tree, invert the tree, and return its root. (Represented as array for input/output)",
        difficulty: "Easy",
        starterCode: "function invertTree(root) {\n  \n}",
        testCases: [
            { input: "[4,2,7,1,3,6,9]", output: "[4,7,2,9,6,3,1]" },
            { input: "[2,1,3]", output: "[2,3,1]" }
        ]
    },
    {
        title: "Valid Anagram",
        description: "Given two strings s and t, return true if t is an anagram of s, and false otherwise.",
        difficulty: "Easy",
        starterCode: "function isAnagram(s, t) {\n  \n}",
        testCases: [
            { input: "'anagram', 'nagaram'", output: "true" },
            { input: "'rat', 'car'", output: "false" }
        ]
    },
    {
        title: "Binary Search",
        description: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, return its index. Otherwise, return -1.",
        difficulty: "Easy",
        starterCode: "function search(nums, target) {\n  \n}",
        testCases: [
            { input: "[-1,0,3,5,9,12], 9", output: "4" },
            { input: "[-1,0,3,5,9,12], 2", output: "-1" }
        ]
    },
    {
        title: "Maximum Subarray",
        description: "Given an integer array nums, find the subarray which has the largest sum and return its sum.",
        difficulty: "Medium",
        starterCode: "function maxSubArray(nums) {\n  \n}",
        testCases: [
            { input: "[-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
            { input: "[1]", output: "1" },
            { input: "[5,4,-1,7,8]", output: "23" }
        ]
    },
    {
        title: "Group Anagrams",
        description: "Given an array of strings strs, group the anagrams together. You can return the answer in any order.",
        difficulty: "Medium",
        starterCode: "function groupAnagrams(strs) {\n  \n}",
        testCases: [
            { input: "['eat','tea','tan','ate','nat','bat']", output: "[['eat','tea','ate'],['tan','nat'],['bat']]" },
            { input: "['']", output: "[['']]" }
        ]
    },
    {
        title: "Longest Consecutive Sequence",
        description: "Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence.",
        difficulty: "Medium",
        starterCode: "function longestConsecutive(nums) {\n  \n}",
        testCases: [
            { input: "[100,4,200,1,3,2]", output: "4" },
            { input: "[0,3,7,2,5,8,4,6,0,1]", output: "9" }
        ]
    },
    {
        title: "Container With Most Water",
        description: "You are given an integer array height of length n. Find two lines that together with the x-axis form a container, such that the container contains the most water.",
        difficulty: "Medium",
        starterCode: "function maxArea(height) {\n  \n}",
        testCases: [
            { input: "[1,8,6,2,5,4,8,3,7]", output: "49" },
            { input: "[1,1]", output: "1" }
        ]
    },
    {
        title: "Find Minimum in Rotated Sorted Array",
        description: "Suppose an array of length n sorted in ascending order is rotated between 1 and n times. Find the minimum element of this array.",
        difficulty: "Medium",
        starterCode: "function findMin(nums) {\n  \n}",
        testCases: [
            { input: "[3,4,5,1,2]", output: "1" },
            { input: "[4,5,6,7,0,1,2]", output: "0" }
        ]
    },
    {
        title: "Climbing Stairs",
        description: "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
        difficulty: "Easy",
        starterCode: "function climbStairs(n) {\n  \n}",
        testCases: [
            { input: "2", output: "2" },
            { input: "3", output: "3" }
        ]
    },
    {
        title: "Single Number",
        description: "Given a non-empty array of integers nums, every element appears twice except for one. Find that single one.",
        difficulty: "Easy",
        starterCode: "function singleNumber(nums) {\n  \n}",
        testCases: [
            { input: "[2,2,1]", output: "1" },
            { input: "[4,1,2,1,2]", output: "4" }
        ]
    },
    {
        title: "Reverse String",
        description: "Write a function that reverses a string. The input string is given as an array of characters s.",
        difficulty: "Easy",
        starterCode: "function reverseString(s) {\n  \n}",
        testCases: [
            { input: "['h','e','l','l','o']", output: "['o','l','l','e','h']" }
        ]
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB...");
        
        await Problem.deleteMany({});
        await Problem.insertMany(problems);
        
        console.log(`✅ Successfully seeded ${problems.length} LeetCode-style problems!`);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDB();
