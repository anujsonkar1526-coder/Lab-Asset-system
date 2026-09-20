const mongoose = require('mongoose');

// Asset Schema Definition
const assetSchema = new mongoose.Schema(
  {
    assetTag: {
      type: String,
      required: [true, 'Asset Tag is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Asset Name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    lab: {
      type: String,
      required: [true, 'Lab name/location is required'],
      trim: true,
    },
    condition: {
      type: String,
      enum: {
        values: ['OK', 'Damaged', 'Lost', 'Maintenance'],
        message: '{VALUE} is not a valid condition',
      },
      default: 'OK',
    },
    totalQuantity: {
      type: Number,
      required: [true, 'Total Quantity is required'],
      min: [0, 'Total quantity cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      required: [true, 'Available Quantity is required'],
      min: [0, 'Available quantity cannot be negative'],
      validate: {
        validator: function (val) {
          // 'this.totalQuantity' refers to the totalQuantity field
          if (this.totalQuantity !== undefined && this.totalQuantity !== null) {
            return val <= this.totalQuantity;
          }
          return true;
        },
        message: 'Available quantity cannot be greater than total quantity',
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Asset', assetSchema);
