const express = require('express');
const { body } = require('express-validator');

const workersController = require('../controllers/workersController');

const router = express.Router();

const workerValidation = [
  body('fullName').trim().notEmpty().withMessage('Worker full name is required.'),
  body('role').trim(),
  body('phone').trim(),
];

router.get('/', workersController.listWorkers);
router.post('/', workerValidation, workersController.createWorker);
router.delete('/:id', workersController.deleteWorker);

module.exports = router;
