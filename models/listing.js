const mongoose = require("mongoose");
const { mediaSchema } = require("./media");
const { reviewSchema } = require("./review");

const listingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0
  },
  location: {
    type: String,
    required: [true, "Location is required"],
    trim: true
  },
  country: {
    type: String,
    required: [true, "Country is required"],
    trim: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  media: [mediaSchema],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Owner is required"]
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  reviews: [reviewSchema],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewsCount: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
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

// ============================================
// DELETE EVERY OTHER MIDDLEWARE AND USE ONLY THIS ONE
// ============================================

listingSchema.pre('save', function(next) {
  // 1. Update timestamps
  this.updatedAt = new Date();
  
  // 2. Update likes count
  if (Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }
  
  // 3. Update reviews stats
  if (Array.isArray(this.reviews) && this.reviews.length > 0) {
    let total = 0;
    let validReviews = 0;
    
    for (let review of this.reviews) {
      if (review.rating && !isNaN(review.rating)) {
        total += review.rating;
        validReviews++;
      }
    }
    
    if (validReviews > 0) {
      this.averageRating = parseFloat((total / validReviews).toFixed(1));
      this.reviewsCount = validReviews;
    } else {
      this.averageRating = 0;
      this.reviewsCount = 0;
    }
  } else {
    this.averageRating = 0;
    this.reviewsCount = 0;
  }
  
  // 4. ALWAYS CALL next() - THIS FIXES THE ERROR
  if (typeof next === 'function') {
    next();
  }
});

// ============================================
// END OF MIDDLEWARE - NO OTHER MIDDLEWARE BELOW
// ============================================

// Optional: Add this method if you need manual calculation
listingSchema.methods.calculateAverageRating = function() {
  if (this.reviews && this.reviews.length > 0) {
    const total = this.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    this.averageRating = parseFloat((total / this.reviews.length).toFixed(1));
    this.reviewsCount = this.reviews.length;
    return this.averageRating;
  }
  this.averageRating = 0;
  this.reviewsCount = 0;
  return 0;
};

// Create indexes
listingSchema.index({ coordinates: "2dsphere" });
listingSchema.index({ owner: 1 });
listingSchema.index({ country: 1 });
listingSchema.index({ price: 1 });
listingSchema.index({ averageRating: -1 });
listingSchema.index({ likesCount: -1 });
listingSchema.index({ "reviews.user": 1 });

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;