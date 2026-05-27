const { validationResult } = require('express-validator');

const Worker = require('../models/Worker');

exports.listWorkers = async (_req, res, next) => {
  try {
    const workers = await Worker.find().sort({ fullName: 1 }).lean();
    res.render('workers/index', {
      title: 'Workers',
      workers,
      errors: [],
      form: {},
    });
  } catch (error) {
    next(error);
  }
};

exports.createWorker = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const workers = await Worker.find().sort({ fullName: 1 }).lean();

    const form = {
      fullName: req.body.fullName || '',
      role: req.body.role || '',
      phone: req.body.phone || '',
    };

    if (!errors.isEmpty()) {
      res.status(400).render('workers/index', {
        title: 'Workers',
        workers,
        errors: errors.array(),
        form,
      });
      return;
    }

    await Worker.create(form);
    res.redirect('/workers');
  } catch (error) {
    next(error);
  }
};

exports.deleteWorker = async (req, res, next) => {
  try {
    await Worker.findByIdAndDelete(req.params.id);
    res.redirect('/workers');
  } catch (error) {
    next(error);
  }
};
