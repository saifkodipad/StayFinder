const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
    trim: true
  },
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
  },
  phone: {
    type: String,
    trim: true,
    default: ""
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"]
  },
  profilePhoto: {
    url: String,
    filename: String,
    fileId: String
  },
  likedListings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing"
  }],
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review"
  }],
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// **ULTRA-SIMPLE MIDDLEWARE - NO DUPLICATES**
userSchema.pre("save", async function() {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return;
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    console.error('Error hashing password:', err);
    throw err;
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
userSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for first letter of name (for profile icon)
userSchema.virtual("firstLetter").get(function() {
  return this.firstName ? this.firstName.charAt(0).toUpperCase() : 'U';
});

// Virtual for formatted username with @
userSchema.virtual("formattedUsername").get(function() {
  return `@${this.username}`;
});

// Method to get user statistics
userSchema.methods.getStatistics = async function() {
  const user = this;
  
  try {
    const [
      totalListingsHosted,
      totalListingsLiked,
      totalLikesReceived
    ] = await Promise.all([
      // 1. Total listings hosted by this user
      mongoose.model("Listing").countDocuments({ owner: user._id }),
      
      // 2. Total listings this user has liked
      mongoose.model("Listing").countDocuments({ likes: user._id }),
      
      // 3. Total likes received on user's listings
      mongoose.model("Listing").aggregate([
        { $match: { owner: user._id } },
        { $group: { 
          _id: null, 
          totalLikes: { $sum: { $size: "$likes" } } 
        }}
      ])
    ]);
    
    return {
      totalListingsHosted: totalListingsHosted || 0,
      totalListingsLiked: totalListingsLiked || 0,
      totalLikesReceived: totalLikesReceived[0]?.totalLikes || 0
    };
  } catch (err) {
    console.error("Error fetching user statistics:", err);
    return {
      totalListingsHosted: 0,
      totalListingsLiked: 0,
      totalLikesReceived: 0
    };
  }
};

// Virtual for formatted account creation date
userSchema.virtual("formattedCreatedAt").get(function() {
  return this.createdAt ? this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'N/A';
});

// Virtual for formatted last login date
userSchema.virtual("formattedLastLogin").get(function() {
  if (!this.lastLogin) return 'Never';
  
  const now = new Date();
  const lastLogin = new Date(this.lastLogin);
  const diffMs = now - lastLogin;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 24) {
    return `Today at ${lastLogin.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${lastLogin.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return lastLogin.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
});

module.exports = mongoose.model("User", userSchema);