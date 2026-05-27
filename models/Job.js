const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: '',
    },
    rate: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const photoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const workDaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    hours: {
      type: Number,
      min: 0,
      max: 24,
      default: 0,
    },
    laborCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    materialCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const checklistItemSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    workBrief: {
      type: String,
      trim: true,
      default: '',
    },
    siteReport: {
      type: String,
      trim: true,
      default: '',
    },
    contractValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    plannedStartDate: {
      type: Date,
      default: null,
    },
    plannedFinishDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    photos: {
      type: [photoSchema],
      default: [],
    },
    materialsUsed: {
      type: [materialSchema],
      default: [],
    },
    materialsLeftOnSite: {
      type: [materialSchema],
      default: [],
    },
    workDays: {
      type: [workDaySchema],
      default: [],
    },
    checklistItems: {
      type: [checklistItemSchema],
      default: [],
    },
    checklistTemplateName: {
      type: String,
      trim: true,
      default: '',
    },
    signoff: {
      signedBy: {
        type: String,
        trim: true,
        default: '',
      },
      signedAt: {
        type: Date,
        default: null,
      },
      signatureDataUrl: {
        type: String,
        default: '',
      },
    },
    workers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Job', jobSchema);
