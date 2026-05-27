const express = require('express');
const { requiresAuth } = require('express-openid-connect');

const adminController = require('../controllers/adminController');
const { requireRole } = require('../middleware/authorization');

const router = express.Router();

router.use(requiresAuth(), requireRole(['Admin']));

router.get('/users', adminController.listUsers);
router.post('/users/role', adminController.updateUserRole);

module.exports = router;
