const { validationResult } = require('express-validator');

const Job = require('../models/Job');
const Worker = require('../models/Worker');
const MaterialTemplate = require('../models/MaterialTemplate');
const ChecklistTemplate = require('../models/ChecklistTemplate');
const { parseMaterialLines, materialListToText } = require('../utils/materialsParser');
const { compressUploadedImages, deleteUploadedFiles } = require('../utils/imageProcessor');

function normalizeWorkers(workerInput) {
  if (!workerInput) {
    return [];
  }

  return Array.isArray(workerInput) ? workerInput : [workerInput];
}

function normalizeArrayInput(value) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizePhotoNotesFromBody(body = {}) {
  return normalizeArrayInput(body.photoNotes).map((note) => String(note || '').trim());
}

function normalizeExistingPhotoNotesFromBody(body = {}) {
  return normalizeArrayInput(body.existingPhotoNote).map((note) => String(note || '').trim());
}

function normalizeExistingPhotoDatesFromBody(body = {}) {
  return normalizeArrayInput(body.existingPhotoDate).map((value) => String(value || '').trim());
}

function normalizeExistingPhotoUrlsFromBody(body = {}) {
  return normalizeArrayInput(body.existingPhotoUrl).map((url) => String(url || '').trim());
}

function normalizePhotoDatesFromBody(body = {}) {
  return normalizeArrayInput(body.photoDates).map((value) => String(value || '').trim());
}

function parseDateTimeInput(dateText, fallbackToNow = false) {
  if (!dateText) {
    return fallbackToNow ? new Date() : null;
  }

  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackToNow ? new Date() : null;
  }

  return parsed;
}

function parsePhotoDateInput(dateText) {
  return parseDateTimeInput(dateText, true);
}

function normalizeExistingPhotosFromBody(body = {}, fallbackPhotos = []) {
  const urls = normalizeExistingPhotoUrlsFromBody(body);
  const notes = normalizeExistingPhotoNotesFromBody(body);
  const dates = normalizeExistingPhotoDatesFromBody(body);
  const removeSet = new Set(normalizeArrayInput(body.removePhotoUrls).map((url) => String(url || '').trim()).filter(Boolean));

  if (!urls.length) {
    return normalizeExistingPhotos(fallbackPhotos).filter((photo) => !removeSet.has(photo.url));
  }

  const photos = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    if (!url || removeSet.has(url)) {
      continue;
    }

    photos.push({
      url,
      note: notes[index] || '',
      uploadedAt: parsePhotoDateInput(dates[index]),
    });
  }

  return photos;
}

function startOfDay(dateValue) {
  const date = new Date(dateValue);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(dateValue) {
  const day = startOfDay(dateValue);
  return day.toISOString().slice(0, 10);
}

function normalizeWorkDaysFromBody(body = {}, options = {}) {
  const canEditCosts = options.canEditCosts !== false;
  const existingWorkDays = Array.isArray(options.existingWorkDays) ? options.existingWorkDays : [];
  const existingCostsById = new Map(
    existingWorkDays
      .filter((workDay) => workDay && workDay._id)
      .map((workDay) => [String(workDay._id), {
        laborCost: Number(workDay.laborCost) || 0,
        materialCost: Number(workDay.materialCost) || 0,
      }])
  );

  const ids = normalizeArrayInput(body.workDayId);
  const dates = normalizeArrayInput(body.workDayDate);
  const hours = normalizeArrayInput(body.workDayHours);
  const laborCosts = normalizeArrayInput(body.workDayLaborCost);
  const materialCosts = normalizeArrayInput(body.workDayMaterialCost);
  const notes = normalizeArrayInput(body.workDayNote);
  const rowCount = Math.max(ids.length, dates.length, hours.length, laborCosts.length, materialCosts.length, notes.length);
  const workDays = [];

  for (let index = 0; index < rowCount; index += 1) {
    const id = String(ids[index] || '').trim();
    const dateText = String(dates[index] || '').trim();
    const date = parseDateTimeInput(dateText, false);
    const hoursValue = Number.parseFloat(String(hours[index] || '').trim());
    const labourCostValue = Number.parseFloat(String(laborCosts[index] || '').trim());
    const materialCostValue = Number.parseFloat(String(materialCosts[index] || '').trim());
    const note = String(notes[index] || '').trim();
    const existingCosts = id ? existingCostsById.get(id) : null;

    if (!dateText && !note && !String(hours[index] || '').trim()) {
      continue;
    }

    if (!date) {
      continue;
    }

    const workDay = {
      date,
      hours: Number.isFinite(hoursValue) && hoursValue >= 0 ? hoursValue : 0,
      laborCost: canEditCosts
        ? (Number.isFinite(labourCostValue) && labourCostValue >= 0 ? labourCostValue : 0)
        : (existingCosts ? existingCosts.laborCost : 0),
      materialCost: canEditCosts
        ? (Number.isFinite(materialCostValue) && materialCostValue >= 0 ? materialCostValue : 0)
        : (existingCosts ? existingCosts.materialCost : 0),
      note,
    };

    if (id) {
      workDay._id = id;
    }

    workDays.push(workDay);
  }

  return workDays.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function workDaysToFormRows(workDays = []) {
  if (!workDays.length) {
    return [
      {
        _id: '',
        date: '',
        hours: '',
        laborCost: '',
        materialCost: '',
        note: '',
      },
    ];
  }

  return workDays
    .map((workDay) => ({
      _id: workDay._id ? String(workDay._id) : '',
      date: workDay.date,
      hours: workDay.hours ?? '',
      laborCost: workDay.laborCost ?? '',
      materialCost: workDay.materialCost ?? '',
      note: workDay.note || '',
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function normalizeChecklistFromBody(body = {}) {
  const labels = normalizeArrayInput(body.checklistLabel);
  const states = normalizeArrayInput(body.checklistState);
  const rowCount = Math.max(labels.length, states.length);
  const checklistItems = [];

  for (let index = 0; index < rowCount; index += 1) {
    const label = String(labels[index] || '').trim();
    const state = String(states[index] || '').trim();

    if (!label) {
      continue;
    }

    checklistItems.push({
      label,
      completed: state === '1' || state.toLowerCase() === 'true',
    });
  }

  return checklistItems;
}

function checklistToFormRows(checklistItems = []) {
  if (!checklistItems.length) {
    return [
      {
        label: '',
        completed: false,
      },
    ];
  }

  return checklistItems.map((item) => ({
    label: item.label || '',
    completed: !!item.completed,
  }));
}

function normalizeExistingPhotos(photos = []) {
  return photos.map((photo) => {
    if (typeof photo === 'string') {
      return {
        url: photo,
        note: '',
        uploadedAt: null,
      };
    }

    return {
      url: photo.url,
      note: photo.note || '',
      uploadedAt: photo.uploadedAt || null,
    };
  });
}

function calculateCostSummary(job) {
  const workDays = job.workDays || [];
  const totalHours = workDays.reduce((sum, day) => sum + (Number(day.hours) || 0), 0);
  const laborCost = workDays.reduce((sum, day) => sum + (Number(day.laborCost) || 0), 0);
  const materialCost = workDays.reduce((sum, day) => sum + (Number(day.materialCost) || 0), 0);
  const totalCost = laborCost + materialCost;
  const contractValue = Number(job.contractValue) || 0;
  const contractBudget = Number(job.contractBudget) || 0;
  const marginAmount = contractValue - totalCost;
  const marginPercent = contractValue > 0 ? (marginAmount / contractValue) * 100 : null;

  return {
    totalHours,
    laborCost,
    materialCost,
    totalCost,
    contractValue,
    contractBudget,
    marginAmount,
    marginPercent,
  };
}

function getFirstWorkDay(job) {
  const sorted = (job.workDays || []).filter((day) => day.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted[0] || null;
}

function getLastWorkDay(job) {
  const sorted = (job.workDays || []).filter((day) => day.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted[sorted.length - 1] || null;
}

function getJobStatus(job) {
  if (job.completedAt) {
    return 'Completed';
  }

  const firstWorkDay = getFirstWorkDay(job);

  if (!firstWorkDay) {
    return 'Not Started';
  }

  const today = startOfDay(new Date());
  const firstDate = startOfDay(firstWorkDay.date);

  if (today < firstDate) {
    return 'Booked In';
  }

  return 'In Progress';
}

function buildTimeline(job) {
  const events = [];

  for (const day of job.workDays || []) {
    events.push({
      type: 'workday',
      date: day.date,
      title: 'Work Day',
      detail: `${day.hours || 0}h | Labour ${day.laborCost || 0} | Material ${day.materialCost || 0}`,
      note: day.note || '',
    });
  }

  for (const photo of job.photos || []) {
    events.push({
      type: 'photo',
      date: photo.uploadedAt || job.createdAt,
      title: 'Photo Uploaded',
      detail: photo.url,
      note: photo.note || '',
    });
  }

  if ((job.materialsUsed || []).length || (job.materialsLeftOnSite || []).length) {
    events.push({
      type: 'materials',
      date: job.createdAt,
      title: 'Materials Updated',
      detail: `${(job.materialsUsed || []).length} used, ${(job.materialsLeftOnSite || []).length} left on site`,
      note: '',
    });
  }

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildAlerts(jobs) {
  const alerts = [];
  const today = startOfDay(new Date());
  const soonThreshold = new Date(today);
  soonThreshold.setDate(soonThreshold.getDate() + 3);

  for (const job of jobs) {
    const status = getJobStatus(job);
    const firstWorkDay = getFirstWorkDay(job);
    const lastWorkDay = getLastWorkDay(job);

    if (status === 'Booked In' && firstWorkDay) {
      const firstDate = startOfDay(firstWorkDay.date);
      if (firstDate <= soonThreshold) {
        alerts.push({
          type: 'booked',
          message: `${job.address} starts on ${toDateKey(firstDate)}.`,
          jobId: String(job._id),
        });
      }
    }

    if (!job.completedAt && lastWorkDay) {
      const lastDate = startOfDay(lastWorkDay.date);
      if (lastDate < today) {
        alerts.push({
          type: 'overdue',
          message: `${job.address} is overdue. Last work day was ${toDateKey(lastDate)}.`,
          jobId: String(job._id),
        });
        alerts.push({
          type: 'missing-complete',
          message: `${job.address} is missing a completed date.`,
          jobId: String(job._id),
        });
      }
    }
  }

  return alerts;
}

async function buildFormDependencies() {
  const workers = await Worker.find().sort({ fullName: 1 }).lean();
  const materialTemplates = await MaterialTemplate.find().sort({ name: 1 }).lean();
  const checklistTemplates = await ChecklistTemplate.find().sort({ name: 1 }).lean();

  return {
    workers,
    materialTemplates,
    checklistTemplates,
  };
}

async function renderJobForm(res, viewName, payload) {
  const dependencies = await buildFormDependencies();

  return res.render(viewName, {
    title: payload.title,
    workers: dependencies.workers,
    materialTemplates: dependencies.materialTemplates,
    checklistTemplates: dependencies.checklistTemplates,
    form: payload.form,
    errors: payload.errors || [],
    successMessage: payload.successMessage || '',
    job: payload.job,
    canEditFinancials: payload.canEditFinancials !== false,
  });
}

exports.listJobs = async (_req, res, next) => {
  try {
    const jobs = await Job.find().populate('workers').sort({ createdAt: -1 }).lean();
    const normalizedJobs = jobs.map((job) => {
      const normalized = {
        ...job,
        photos: normalizeExistingPhotos(job.photos),
      };

      return {
        ...normalized,
        status: getJobStatus(normalized),
        costSummary: calculateCostSummary(normalized),
      };
    });

    res.render('jobs/index', {
      title: 'Construction Jobs',
      jobs: normalizedJobs,
      alerts: buildAlerts(normalizedJobs),
    });
  } catch (error) {
    next(error);
  }
};

exports.newJobForm = async (req, res, next) => {
  try {
    const canEditFinancials = !!(req.userAccessFlags && req.userAccessFlags.admin);

    await renderJobForm(res, 'jobs/new', {
      title: 'Add Construction Job',
      form: {
        contractValue: '',
        contractBudget: '',
        plannedStartDate: '',
        plannedFinishDate: '',
        workDays: [
          {
            _id: '',
            date: '',
            hours: '',
            laborCost: '',
            materialCost: '',
            note: '',
          },
        ],
        checklistItems: [{ label: '', completed: false }],
        checklistTemplateName: '',
        signoffSignedBy: '',
        signoffSignatureDataUrl: '',
      },
      successMessage: req.query.saved === '1' ? 'Job saved.' : '',
      job: null,
      canEditFinancials,
    });
  } catch (error) {
    next(error);
  }
};

exports.createJob = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const canEditFinancials = !!(req.userAccessFlags && req.userAccessFlags.admin);
    const normalizedWorkDays = normalizeWorkDaysFromBody(req.body, { canEditCosts: canEditFinancials });

    const form = {
      address: req.body.address || '',
      lat: req.body.lat || '',
      lng: req.body.lng || '',
      workBrief: req.body.workBrief || '',
      siteReport: req.body.siteReport || '',
      contractValue: req.body.contractValue || '',
      contractBudget: req.body.contractBudget || '',
      plannedStartDate: req.body.plannedStartDate || '',
      plannedFinishDate: req.body.plannedFinishDate || '',
      completedAt: req.body.completedAt || '',
      materialsUsedInput: req.body.materialsUsedInput || '',
      materialsLeftInput: req.body.materialsLeftInput || '',
      workers: normalizeWorkers(req.body.workers),
      workDays: workDaysToFormRows(normalizedWorkDays),
      checklistItems: checklistToFormRows(normalizeChecklistFromBody(req.body)),
      checklistTemplateName: req.body.checklistTemplateName || '',
      signoffSignedBy: req.body.signoffSignedBy || '',
      signoffSignatureDataUrl: req.body.signoffSignatureDataUrl || '',
    };

    if (!errors.isEmpty()) {
      await deleteUploadedFiles(req.files);
      await renderJobForm(res, 'jobs/new', {
        title: 'Add Construction Job',
        form,
        errors: errors.array(),
        job: null,
        canEditFinancials,
      });
      return;
    }

    const uploadedPhotos = await compressUploadedImages(req.files);
    const photoNotes = normalizePhotoNotesFromBody(req.body);
    const photoDates = normalizePhotoDatesFromBody(req.body);
    const photoObjects = uploadedPhotos.map((url, index) => ({
      url,
      note: photoNotes[index] || '',
      uploadedAt: parsePhotoDateInput(photoDates[index]),
    }));

    const signoff = {
      signedBy: req.body.signoffSignedBy || '',
      signedAt: req.body.signoffSignedBy && req.body.signoffSignatureDataUrl ? new Date() : null,
      signatureDataUrl: req.body.signoffSignatureDataUrl || '',
    };

    await Job.create({
      address: form.address,
      location: {
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
      },
      workBrief: form.workBrief,
      siteReport: form.siteReport,
      contractValue: canEditFinancials ? (Number(form.contractValue) || 0) : 0,
      contractBudget: canEditFinancials ? (Number(form.contractBudget) || 0) : 0,
      plannedStartDate: parseDateTimeInput(form.plannedStartDate, false),
      plannedFinishDate: parseDateTimeInput(form.plannedFinishDate, false),
      completedAt: parseDateTimeInput(form.completedAt, false),
      materialsUsed: parseMaterialLines(form.materialsUsedInput),
      materialsLeftOnSite: parseMaterialLines(form.materialsLeftInput),
      workDays: normalizedWorkDays,
      checklistItems: normalizeChecklistFromBody(req.body),
      checklistTemplateName: req.body.checklistTemplateName || '',
      workers: form.workers,
      photos: photoObjects,
      signoff,
    });

    res.redirect('/jobs/new?saved=1');
  } catch (error) {
    await deleteUploadedFiles(req.files);
    const canEditFinancials = !!(req.userAccessFlags && req.userAccessFlags.admin);
    const normalizedWorkDays = normalizeWorkDaysFromBody(req.body, { canEditCosts: canEditFinancials });
    const form = {
      address: req.body.address || '',
      lat: req.body.lat || '',
      lng: req.body.lng || '',
      workBrief: req.body.workBrief || '',
      siteReport: req.body.siteReport || '',
      contractValue: req.body.contractValue || '',
      contractBudget: req.body.contractBudget || '',
      plannedStartDate: req.body.plannedStartDate || '',
      plannedFinishDate: req.body.plannedFinishDate || '',
      completedAt: req.body.completedAt || '',
      materialsUsedInput: req.body.materialsUsedInput || '',
      materialsLeftInput: req.body.materialsLeftInput || '',
      workers: normalizeWorkers(req.body.workers),
      workDays: workDaysToFormRows(normalizedWorkDays),
      checklistItems: checklistToFormRows(normalizeChecklistFromBody(req.body)),
      checklistTemplateName: req.body.checklistTemplateName || '',
      signoffSignedBy: req.body.signoffSignedBy || '',
      signoffSignatureDataUrl: req.body.signoffSignatureDataUrl || '',
    };

    await renderJobForm(res, 'jobs/new', {
      title: 'Add Construction Job',
      form,
      errors: [{ msg: error.message || 'Unable to save job.' }],
      job: null,
      canEditFinancials,
    });
  }
};

exports.showJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('workers').lean();

    if (!job) {
      res.status(404).render('404', { title: 'Job Not Found' });
      return;
    }

    const normalizedJob = {
      ...job,
      photos: normalizeExistingPhotos(job.photos),
    };

    res.render('jobs/show', {
      title: 'Job Details',
      job: normalizedJob,
      status: getJobStatus(normalizedJob),
      costSummary: calculateCostSummary(normalizedJob),
      timelineEvents: buildTimeline(normalizedJob),
    });
  } catch (error) {
    next(error);
  }
};

exports.editJobForm = async (req, res, next) => {
  try {
    const canEditFinancials = !!(req.userAccessFlags && req.userAccessFlags.admin);
    const job = await Job.findById(req.params.id).populate('workers').lean();

    if (!job) {
      res.status(404).render('404', { title: 'Job Not Found' });
      return;
    }

    const normalizedJob = {
      ...job,
      photos: normalizeExistingPhotos(job.photos),
    };

    const form = {
      address: normalizedJob.address,
      lat: normalizedJob.location?.lat ?? '',
      lng: normalizedJob.location?.lng ?? '',
      workBrief: normalizedJob.workBrief,
      siteReport: normalizedJob.siteReport || '',
      contractValue: normalizedJob.contractValue || '',
      contractBudget: normalizedJob.contractBudget || '',
      plannedStartDate: normalizedJob.plannedStartDate || '',
      plannedFinishDate: normalizedJob.plannedFinishDate || '',
      completedAt: normalizedJob.completedAt,
      materialsUsedInput: materialListToText(normalizedJob.materialsUsed),
      materialsLeftInput: materialListToText(normalizedJob.materialsLeftOnSite),
      workers: normalizedJob.workers.map((worker) => String(worker._id)),
      workDays: workDaysToFormRows(normalizedJob.workDays || []),
      checklistItems: checklistToFormRows(normalizedJob.checklistItems || []),
      checklistTemplateName: normalizedJob.checklistTemplateName || '',
      signoffSignedBy: normalizedJob.signoff?.signedBy || '',
      signoffSignatureDataUrl: normalizedJob.signoff?.signatureDataUrl || '',
    };

    await renderJobForm(res, 'jobs/edit', {
      title: 'Edit Job',
      form,
      successMessage: req.query.saved === '1' ? 'Job updated.' : '',
      job: normalizedJob,
      canEditFinancials,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateJob = async (req, res, next) => {
  let job;

  try {
    const errors = validationResult(req);
    const canEditFinancials = !!(req.userAccessFlags && req.userAccessFlags.admin);
    job = await Job.findById(req.params.id);

    if (!job) {
      res.status(404).render('404', { title: 'Job Not Found' });
      return;
    }

    const normalizedWorkDays = normalizeWorkDaysFromBody(req.body, {
      canEditCosts: canEditFinancials,
      existingWorkDays: job.workDays || [],
    });

    const form = {
      address: req.body.address || '',
      lat: req.body.lat || '',
      lng: req.body.lng || '',
      workBrief: req.body.workBrief || '',
      siteReport: req.body.siteReport || '',
      contractValue: req.body.contractValue || '',
      contractBudget: req.body.contractBudget || '',
      plannedStartDate: req.body.plannedStartDate || '',
      plannedFinishDate: req.body.plannedFinishDate || '',
      completedAt: req.body.completedAt || '',
      materialsUsedInput: req.body.materialsUsedInput || '',
      materialsLeftInput: req.body.materialsLeftInput || '',
      workers: normalizeWorkers(req.body.workers),
      workDays: workDaysToFormRows(normalizedWorkDays),
      checklistItems: checklistToFormRows(normalizeChecklistFromBody(req.body)),
      checklistTemplateName: req.body.checklistTemplateName || '',
      signoffSignedBy: req.body.signoffSignedBy || '',
      signoffSignatureDataUrl: req.body.signoffSignatureDataUrl || '',
    };

    if (!errors.isEmpty()) {
      await deleteUploadedFiles(req.files);
      const existingPhotos = normalizeExistingPhotosFromBody(req.body, job.photos || []);
      await renderJobForm(res, 'jobs/edit', {
        title: 'Edit Job',
        form,
        errors: errors.array(),
        job: {
          ...job.toObject(),
          photos: existingPhotos,
        },
        canEditFinancials,
      });
      return;
    }

    const uploadedPhotos = await compressUploadedImages(req.files);
    const photoNotes = normalizePhotoNotesFromBody(req.body);
    const photoDates = normalizePhotoDatesFromBody(req.body);
    const photoObjects = uploadedPhotos.map((url, index) => ({
      url,
      note: photoNotes[index] || '',
      uploadedAt: parsePhotoDateInput(photoDates[index]),
    }));

    job.address = form.address;
    job.location = {
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
    };
    job.workBrief = form.workBrief;
    job.siteReport = form.siteReport;
    if (canEditFinancials) {
      job.contractValue = Number(form.contractValue) || 0;
      job.contractBudget = Number(form.contractBudget) || 0;
    }
    job.plannedStartDate = parseDateTimeInput(form.plannedStartDate, false);
    job.plannedFinishDate = parseDateTimeInput(form.plannedFinishDate, false);
    job.completedAt = parseDateTimeInput(form.completedAt, false);
    job.materialsUsed = parseMaterialLines(form.materialsUsedInput);
    job.materialsLeftOnSite = parseMaterialLines(form.materialsLeftInput);
    job.workDays = normalizedWorkDays;
    job.checklistItems = normalizeChecklistFromBody(req.body);
    job.checklistTemplateName = req.body.checklistTemplateName || '';
    job.workers = form.workers;

    if (req.body.clearSignature === '1') {
      job.signoff = {
        signedBy: '',
        signedAt: null,
        signatureDataUrl: '',
      };
    } else if (req.body.signoffSignedBy && req.body.signoffSignatureDataUrl) {
      job.signoff = {
        signedBy: req.body.signoffSignedBy,
        signedAt: new Date(),
        signatureDataUrl: req.body.signoffSignatureDataUrl,
      };
    }

    const existing = normalizeExistingPhotosFromBody(req.body, job.photos || []);
    job.photos = [...existing, ...photoObjects];

    await job.save();

    res.redirect(`/jobs/${job._id}/edit?saved=1`);
  } catch (error) {
    await deleteUploadedFiles(req.files);

    const canEditFinancials = !!(req.userAccessFlags && req.userAccessFlags.admin);
    const normalizedWorkDays = normalizeWorkDaysFromBody(req.body, {
      canEditCosts: canEditFinancials,
      existingWorkDays: job && job.workDays ? job.workDays : [],
    });

    const existingPhotos = job ? normalizeExistingPhotosFromBody(req.body, job.photos || []) : [];
    const form = {
      address: req.body.address || '',
      lat: req.body.lat || '',
      lng: req.body.lng || '',
      workBrief: req.body.workBrief || '',
      siteReport: req.body.siteReport || '',
      contractValue: req.body.contractValue || '',
      contractBudget: req.body.contractBudget || '',
      plannedStartDate: req.body.plannedStartDate || '',
      plannedFinishDate: req.body.plannedFinishDate || '',
      completedAt: req.body.completedAt || '',
      materialsUsedInput: req.body.materialsUsedInput || '',
      materialsLeftInput: req.body.materialsLeftInput || '',
      workers: normalizeWorkers(req.body.workers),
      workDays: workDaysToFormRows(normalizedWorkDays),
      checklistItems: checklistToFormRows(normalizeChecklistFromBody(req.body)),
      checklistTemplateName: req.body.checklistTemplateName || '',
      signoffSignedBy: req.body.signoffSignedBy || '',
      signoffSignatureDataUrl: req.body.signoffSignatureDataUrl || '',
    };

    await renderJobForm(res, 'jobs/edit', {
      title: 'Edit Job',
      form,
      errors: [{ msg: error.message || 'Unable to update job.' }],
      job: job
        ? {
            ...job.toObject(),
            photos: existingPhotos,
          }
        : null,
      canEditFinancials,
    });
  }
};

exports.deleteJob = async (req, res, next) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.redirect('/jobs');
  } catch (error) {
    next(error);
  }
};

exports.calendarView = async (req, res, next) => {
  try {
    const mode = req.query.mode === 'week' ? 'week' : 'month';
    const requestedDate = req.query.date ? new Date(req.query.date) : new Date();
    const now = Number.isNaN(requestedDate.getTime()) ? startOfDay(new Date()) : startOfDay(requestedDate);

    let rangeStart = new Date(now);
    let rangeEnd = new Date(now);

    if (mode === 'month') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      const dayOffset = now.getDay();
      rangeStart.setDate(now.getDate() - dayOffset);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 6);
    }

    const jobs = await Job.find({
      'workDays.date': {
        $gte: rangeStart,
        $lte: rangeEnd,
      },
    })
      .select('address workDays completedAt workers')
      .populate('workers', 'fullName')
      .sort({ address: 1, _id: 1 })
      .lean();

    const jobOrder = new Map();
    jobs.forEach((job, index) => {
      jobOrder.set(String(job._id), index);
    });

    const events = [];
    for (const job of jobs) {
      for (const workDay of job.workDays || []) {
        const date = new Date(workDay.date);
        if (date < rangeStart || date > rangeEnd) {
          continue;
        }

        events.push({
          jobId: String(job._id),
          workDayId: String(workDay._id || ''),
          address: job.address,
          workers: (job.workers || []).map((worker) => worker.fullName).filter(Boolean).join(', '),
          date: toDateKey(date),
          hours: workDay.hours || 0,
          note: workDay.note || '',
          status: getJobStatus(job),
          order: jobOrder.get(String(job._id)) ?? Number.MAX_SAFE_INTEGER,
        });
      }
    }

    const days = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      const eventsForDay = events
        .filter((event) => event.date === key)
        .sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }

          return String(a.workDayId).localeCompare(String(b.workDayId));
        });

      days.push({
        key,
        label: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Europe/London' }),
        events: eventsForDay,
      });
    }

    const previous = new Date(rangeStart);
    const next = new Date(rangeStart);

    if (mode === 'month') {
      previous.setMonth(previous.getMonth() - 1);
      next.setMonth(next.getMonth() + 1);
    } else {
      previous.setDate(previous.getDate() - 7);
      next.setDate(next.getDate() + 7);
    }

    res.render('calendar/index', {
      title: 'Calendar Scheduler',
      mode,
      days,
      currentDateKey: toDateKey(now),
      previousQuery: `mode=${mode}&date=${toDateKey(previous)}`,
      nextQuery: `mode=${mode}&date=${toDateKey(next)}`,
    });
  } catch (error) {
    next(error);
  }
};

exports.rescheduleWorkDay = async (req, res, next) => {
  try {
    const { id, workDayId } = req.params;
    const { date } = req.body;

    if (!date) {
      res.status(400).json({ ok: false, message: 'Date is required.' });
      return;
    }

    const job = await Job.findById(id);
    if (!job) {
      res.status(404).json({ ok: false, message: 'Job not found.' });
      return;
    }

    const workDay = job.workDays.id(workDayId);
    if (!workDay) {
      res.status(404).json({ ok: false, message: 'Work day not found.' });
      return;
    }

    workDay.date = new Date(date);
    await job.save();

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
