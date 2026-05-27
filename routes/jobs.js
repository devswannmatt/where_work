const express = require('express');
const { body } = require('express-validator');

const jobsController = require('../controllers/jobsController');
const upload = require('../middleware/upload');

const router = express.Router();

const jobValidation = [
  body('address').trim().notEmpty().withMessage('Address is required.'),
  body('contractValue').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Contract value must be 0 or more.'),
  body('lat')
    .optional({ values: 'falsy' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90.'),
  body('lng')
    .optional({ values: 'falsy' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180.'),
  body('plannedStartDate').optional({ values: 'falsy' }).isISO8601().withMessage('Planned start date is invalid.'),
  body('plannedFinishDate').optional({ values: 'falsy' }).isISO8601().withMessage('Planned finish date is invalid.'),
  body('completedAt').optional({ values: 'falsy' }).isISO8601().withMessage('Completed date is invalid.'),
  body('workDayDate.*').optional({ values: 'falsy' }).isISO8601().withMessage('Work day date is invalid.'),
  body('workDayHours.*')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 24 })
    .withMessage('Work day hours must be between 0 and 24.'),
  body('workDayLaborCost.*')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('Work day labor cost must be 0 or more.'),
  body('workDayMaterialCost.*')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('Work day material cost must be 0 or more.'),
  body('photoDates.*').optional({ values: 'falsy' }).isISO8601().withMessage('Photo date is invalid.'),
  body('existingPhotoDate.*').optional({ values: 'falsy' }).isISO8601().withMessage('Existing photo date is invalid.'),
  body('workBrief').trim(),
  body('siteReport').trim(),
];

router.get('/', jobsController.listJobs);
router.get('/new', jobsController.newJobForm);
router.post('/', upload.array('photos'), jobValidation, jobsController.createJob);
router.get('/:id', jobsController.showJob);
router.get('/:id/edit', jobsController.editJobForm);
router.put('/:id', upload.array('photos'), jobValidation, jobsController.updateJob);
router.put('/:id/workdays/:workDayId/reschedule', jobsController.rescheduleWorkDay);
router.delete('/:id', jobsController.deleteJob);

module.exports = router;
