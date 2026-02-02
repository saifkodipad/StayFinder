const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Database connection - SIMPLIFIED FOR MONGOOSE 6+
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/StayFinder')
.then(() => {
    console.log('✅ Connected to MongoDB');
    createAdminUser();
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('💡 Make sure MongoDB is running:');
    console.log('   1. Open new terminal');
    console.log('   2. Run: mongod');
    console.log('   3. Then run: node createAdmin.js');
});

// ... rest of the createAdmin.js code remains the same ...