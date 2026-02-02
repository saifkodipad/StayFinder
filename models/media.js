const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, "URL is required"]
  },
  filename: {
    type: String,
    required: [true, "Filename is required"]
  },
  fileId: String,
  type: { 
    type: String, 
    enum: ["image", "video"],
    default: "image"
  },
  size: Number,
  mimetype: String,
  originalname: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Static method to create media from multer file
mediaSchema.statics.createFromMulterFile = function(file, url) {
  return {
    url: url || file.path,
    filename: file.filename,
    fileId: file.filename, // You can use cloud storage ID if using cloud
    type: file.mimetype.startsWith('image') ? 'image' : 'video',
    size: file.size,
    mimetype: file.mimetype,
    originalname: file.originalname
  };
};

// Static method for multiple files
mediaSchema.statics.createMultipleFromMulter = function(files, baseUrl = '') {
  return files.map(file => ({
    url: `${baseUrl}/${file.filename}`,
    filename: file.filename,
    fileId: file.filename,
    type: file.mimetype.startsWith('image') ? 'image' : 'video',
    size: file.size,
    mimetype: file.mimetype,
    originalname: file.originalname
  }));
};

// Export as both a model and a schema
const Media = mongoose.model("Media", mediaSchema);
module.exports = { Media, mediaSchema };