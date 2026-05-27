const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const morgan = require('morgan');
const { engine } = require('express-handlebars');
const { auth } = require('express-openid-connect');
const { getAccessFlagsFromUser, getRoleNames } = require('./utils/authRoles');
const { getUserAccessFlags } = require('./utils/auth0Management');

const indexRoutes = require('./routes/index');

const app = express();

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatCrumbLabel(segment, previousSegment) {
  const labels = {
    jobs: 'Construction Jobs',
    new: 'New',
    edit: 'Edit',
    calendar: 'Calendar',
    workers: 'Workers',
    materials: 'Materials',
    checklists: 'Checklists',
    templates: 'Templates',
  };

  if (labels[segment]) {
    return labels[segment];
  }

  if (/^[0-9a-f]{24}$/i.test(segment)) {
    if (previousSegment === 'jobs') {
      return 'Job';
    }

    return 'Details';
  }

  return titleCase(segment.replace(/[-_]+/g, ' '));
}

function buildBreadcrumbs(pathname) {
  const crumbs = [{ label: 'Home', href: '/' }];
  const segments = String(pathname || '')
    .split('/')
    .filter(Boolean);

  if (!segments.length) {
    return crumbs;
  }

  let cumulativePath = '';
  for (let index = 0; index < segments.length; index += 1) {
    const segment = decodeURIComponent(segments[index]);
    const previousSegment = index > 0 ? segments[index - 1] : '';
    cumulativePath += `/${segments[index]}`;

    crumbs.push({
      label: formatCrumbLabel(segment, previousSegment),
      href: index === segments.length - 1 ? null : cumulativePath,
    });
  }

  return crumbs;
}

function getUkDateParts(dateValue) {
  const date = new Date(dateValue);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
  };
}

function getUkDateTimeParts(dateValue) {
  const date = new Date(dateValue);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
  };
}

function firstLineAddress(address) {
  const text = String(address || '').trim();
  if (!text) {
    return '';
  }

  const commaSplit = text.split(',')[0].trim();
  if (commaSplit) {
    return commaSplit;
  }

  return text.split(/\r?\n/)[0].trim();
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasValue);
  }

  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'number') {
    return !Number.isNaN(value) && value !== 0;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    return Object.values(value).some(hasValue);
  }

  return String(value).trim() !== '';
}

function sectionIsEmpty(sectionName, form = {}, job = null) {
  switch (sectionName) {
    case 'job-details':
      return !hasValue(form.workBrief) && !hasValue(form.contractValue) && !hasValue(form.contractBudget) && !hasValue(form.plannedStartDate) && !hasValue(form.plannedFinishDate);
    case 'location':
      return !hasValue(form.address) && !hasValue(form.lat) && !hasValue(form.lng);
    case 'materials':
      return !hasValue(form.materialsUsedInput) && !hasValue(form.materialsLeftInput);
    case 'work-days':
      return !(form.workDays || []).some((day) => hasValue(day.date) || hasValue(day.hours) || hasValue(day.laborCost) || hasValue(day.materialCost) || hasValue(day.note));
    case 'checklist':
      return !(form.checklistItems || []).some((item) => hasValue(item.label));
    case 'workers':
      return !hasValue(form.workers);
    case 'signoff':
      return !hasValue(form.siteReport) && !hasValue(form.signoffSignedBy) && !hasValue(form.completedAt) && !hasValue(form.signoffSignatureDataUrl);
    case 'photos':
      return !((job && job.photos && job.photos.length) || false);
    default:
      return false;
  }
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatHours(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function workDayHasValue(day = {}) {
  return hasValue(day.date) || toNumber(day.hours) > 0 || toNumber(day.laborCost) > 0 || toNumber(day.materialCost) > 0 || hasValue(day.note);
}

function getWorkDaysSummary(workDays = []) {
  const populatedDays = (workDays || []).filter(workDayHasValue);
  const dayCount = populatedDays.length;
  const totalHours = populatedDays.reduce((sum, day) => sum + toNumber(day.hours), 0);
  return `${dayCount} days / ${formatHours(totalHours)}h`;
}

function getSelectedCount(list = []) {
  return (list || []).filter((item) => hasValue(item)).length;
}

function getImageCount(job = null) {
  if (!job || !Array.isArray(job.photos)) {
    return 0;
  }

  return job.photos.length;
}

app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    helpers: {
      eq(a, b) {
        return String(a) === String(b);
      },
      contains(list, value) {
        return (list || []).map((item) => String(item)).includes(String(value));
      },
      toDateInput(dateValue) {
        if (!dateValue) {
          return '';
        }
        const parts = getUkDateParts(dateValue);
        return `${parts.year}-${parts.month}-${parts.day}`;
      },
      toDateTimeInput(dateValue) {
        if (!dateValue) {
          return '';
        }

        const parts = getUkDateTimeParts(dateValue);
        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
      },
      formatDateUK(dateValue) {
        if (!dateValue) {
          return '-';
        }

        return new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(dateValue));
      },
      formatDateTimeUK(dateValue) {
        if (!dateValue) {
          return '-';
        }

        return new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(dateValue));
      },
      formatCurrency(value) {
        const amount = Number(value) || 0;
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(amount);
      },
      formatPercent(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
          return '-';
        }

        return `${Number(value).toFixed(1)}%`;
      },
      statusClass(status) {
        if (!status) {
          return '';
        }

        return `status-${String(status).toLowerCase().replace(/\s+/g, '-')}`;
      },
      joinWorkerNames(workers) {
        return (workers || []).map((w) => w.fullName).join(', ');
      },
      json(value) {
        return JSON.stringify(value || null);
      },
      sectionIsEmpty(sectionName, form, job) {
        return sectionIsEmpty(sectionName, form, job);
      },
      workDaysSummary(workDays) {
        return getWorkDaysSummary(workDays);
      },
      selectedCount(list) {
        return getSelectedCount(list);
      },
      imageCount(job) {
        return getImageCount(job);
      },
      firstLineAddress(address) {
        return firstLineAddress(address);
      },
    },
  })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const authConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  authorizationParams: {
    response_type: 'code',
    response_mode: 'query',
  },
};

app.use(auth(authConfig));

app.use(async (req, res, next) => {
  res.locals.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  res.locals.isAuthenticated = req.oidc ? req.oidc.isAuthenticated() : false;
  res.locals.currentUser = req.oidc ? req.oidc.user : null;

  let accessFlags = { admin: false, supervisor: false };
  if (req.oidc && req.oidc.isAuthenticated()) {
    accessFlags = getAccessFlagsFromUser(req.oidc.user, process.env.AUTH0_METADATA_NAMESPACE || '');

    if (!accessFlags.admin && !accessFlags.supervisor && req.oidc.user && req.oidc.user.sub) {
      try {
        accessFlags = await getUserAccessFlags(req.oidc.user.sub);
      } catch (_error) {
        accessFlags = { admin: false, supervisor: false };
      }
    }
  }

  res.locals.currentRoles = getRoleNames(accessFlags);
  res.locals.isAdmin = accessFlags.admin;
  res.locals.isSupervisor = accessFlags.supervisor;
  const pathOnly = (req.originalUrl || req.url || '/').split('?')[0] || '/';
  res.locals.breadcrumbs = buildBreadcrumbs(pathOnly);
  next();
});

app.use('/', indexRoutes);

app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
  });
});

app.use((error, _req, res, _next) => {
  res.status(500).render('500', {
    title: 'Server Error',
    message: error.message,
  });
});

module.exports = app;
