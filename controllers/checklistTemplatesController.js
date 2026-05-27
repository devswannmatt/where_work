const { validationResult } = require('express-validator');

const ChecklistTemplate = require('../models/ChecklistTemplate');

function parseItems(input = '') {
  return input
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

exports.listTemplates = async (_req, res, next) => {
  try {
    const templates = await ChecklistTemplate.find().sort({ name: 1 }).lean();
    res.render('checklists/templates', {
      title: 'Checklist Templates',
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
    const templates = await ChecklistTemplate.find().sort({ name: 1 }).lean();

    const form = {
      name: req.body.name || '',
      itemsInput: req.body.itemsInput || '',
    };

    if (!errors.isEmpty()) {
      res.status(400).render('checklists/templates', {
        title: 'Checklist Templates',
        templates,
        form,
        errors: errors.array(),
      });
      return;
    }

    await ChecklistTemplate.create({
      name: form.name,
      items: parseItems(form.itemsInput),
    });

    res.redirect('/checklists/templates');
  } catch (error) {
    next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    await ChecklistTemplate.findByIdAndDelete(req.params.id);
    res.redirect('/checklists/templates');
  } catch (error) {
    next(error);
  }
};
