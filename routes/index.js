const express = require('express');
const { requiresAuth } = require('express-openid-connect');

const jobsRoutes = require('./jobs');
const workersRoutes = require('./workers');
const materialsRoutes = require('./materials');
const checklistsRoutes = require('./checklists');
const adminRoutes = require('./admin');
const jobsController = require('../controllers/jobsController');
const { requireRole } = require('../middleware/authorization');

const router = express.Router();

router.get('/', (_req, res) => {
  res.render('home', {
    title: 'Where Work - Construction Tracker',
  });
});

router.get('/account', requiresAuth(), (req, res) => {
  res.render('account', {
    title: 'Account',
    user: req.oidc.user,
  });
});

router.use('/admin', adminRoutes);
router.use('/jobs', requiresAuth(), requireRole(['Admin', 'Supervisor']), jobsRoutes);
router.use('/workers', requiresAuth(), requireRole(['Admin', 'Supervisor']), workersRoutes);
router.use('/materials', requiresAuth(), requireRole(['Admin', 'Supervisor']), materialsRoutes);
router.use('/checklists', requiresAuth(), requireRole(['Admin', 'Supervisor']), checklistsRoutes);
router.get('/calendar', requiresAuth(), requireRole(['Admin', 'Supervisor']), jobsController.calendarView);

module.exports = router;
