const mongoose = require('mongoose');

// Request Schema Definition
const requestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      trim: true,
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    expectedReturnDate: {
      type: Date,
      required: [true, 'Expected return date is required'],
    },
    issueDate: {
      type: Date,
      default: null,
    },
    returnDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Issued', 'Returned', 'Overdue'],
      default: 'Pending',
    },
    returnCondition: {
      type: String,
      enum: ['OK', 'Damaged', 'Lost'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Request', requestSchema);
