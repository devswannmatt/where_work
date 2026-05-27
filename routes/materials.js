const express = require('express');
const { body } = require('express-validator');

const materialsController = require('../controllers/materialsController');

const router = express.Router();

const templateValidation = [
  body('name').trim().notEmpty().withMessage('Material name is required.'),
  body('unit').trim(),
  body('defaultRate').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Default rate must be 0 or more.'),
];

router.get('/', materialsController.listTemplates);
router.post('/', templateValidation, materialsController.createTemplate);
router.delete('/:id', materialsController.deleteTemplate);

module.exports = router;
