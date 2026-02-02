const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// NO MIDDLEWARE HERE AT ALL - LET LISTING.JS HANDLE EVERYTHING
// REMOVE ALL pre('save') hooks from this file

const Review = mongoose.model("Review", reviewSchema);
module.exports = { Review, reviewSchema };