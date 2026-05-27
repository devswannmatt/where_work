const express = require('express');
const { body } = require('express-validator');

const checklistTemplatesController = require('../controllers/checklistTemplatesController');

const router = express.Router();

const templateValidation = [
  body('name').trim().notEmpty().withMessage('Template name is required.'),
  body('itemsInput').trim().notEmpty().withMessage('Add at least one checklist line.'),
];

router.get('/templates', checklistTemplatesController.listTemplates);
router.post('/templates', templateValidation, checklistTemplatesController.createTemplate);
router.delete('/templates/:id', checklistTemplatesController.deleteTemplate);

module.exports = router;
