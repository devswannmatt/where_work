const { validationResult } = require('express-validator');

const MaterialTemplate = require('../models/MaterialTemplate');

exports.listTemplates = async (_req, res, next) => {
  try {
    const templates = await MaterialTemplate.find().sort({ name: 1 }).lean();
    res.render('materials/index', {
      title: 'Material Catalog',
      templates,
      form: {},
      errors: [],
    });
  } catch (error) {
    next(error);
  }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const templates = await MaterialTemplate.find().sort({ name: 1 }).lean();

    const form = {
      name: req.body.name || '',
      unit: req.body.unit || '',
      defaultRate: req.body.defaultRate || '',
    };

    if (!errors.isEmpty()) {
      res.status(400).render('materials/index', {
        title: 'Material Catalog',
        templates,
        form,
        errors: errors.array(),
      });
      return;
    }

    await MaterialTemplate.create({
      name: form.name,
      unit: form.unit,
      defaultRate: Number(form.defaultRate) || 0,
    });

    res.redirect('/materials');
  } catch (error) {
    next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    await MaterialTemplate.findByIdAndDelete(req.params.id);
    res.redirect('/materials');
  } catch (error) {
    next(error);
  }
};
