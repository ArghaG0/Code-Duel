const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { 
    createProblem, 
    getMyProblems, 
    createTemplate, 
    getMyTemplates,
    updateTemplate,
    deleteTemplate
} = require('../controllers/customRoom.controller');

router.post('/problem', protect, createProblem);
router.get('/problems', protect, getMyProblems);

router.post('/template', protect, createTemplate);
router.get('/templates', protect, getMyTemplates);

router.put('/template/:id', protect, updateTemplate);
router.delete('/template/:id', protect, deleteTemplate);

module.exports = router;