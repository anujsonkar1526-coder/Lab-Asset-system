const mongoose = require('mongoose');

// Maintenance Log Schema Definition
const maintenanceSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset is required for maintenance log'],
    },
    serviceDate: {
      type: Date,
      required: [true, 'Service date is required'],
      default: Date.now,
    },
    cost: {
      type: Number,
      required: [true, 'Service cost is required'],
      min: [0, 'Cost cannot be negative'],
    },
    description: {
      type: String,
      required: [true, 'Maintenance description is required'],
      trim: true,
    },
    nextServiceDue: {
      type: Date,
      required: [true, 'Next service due date is required'],
    },
    technician: {
      type: String,
      trim: true,
      default: 'Authorized Service Center',
    },
    status: {
      type: String,
      enum: ['Completed', 'In Progress', 'Scheduled'],
      default: 'Completed',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Maintenance', maintenanceSchema);
