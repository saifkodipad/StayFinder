const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('./models/user.js');

mongoose.connect(process.env.ATLAS_URL)
.then(() => {
    console.log('✅ Connected to MongoDB');
    createAdminUser();
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
});

async function createAdminUser() {
    try {
        // Delete existing admin if exists
        await User.deleteMany({
            $or: [
                { email: 'admin@stayfinder.com' },
                { username: 'admin' },
                { role: 'admin' }
            ]
        });
        console.log('✅ Cleared existing admin users');
        
        // Create admin with PLAIN password - middleware will hash it
        const adminUser = new User({
            firstName: 'Admin',
            lastName: 'Administrator',
            username: 'admin',
            email: 'admin@stayfinder.com',
            phone: '9898982434',
            alternatePhone: '9876548234',
            password: 'admin123', // PLAIN TEXT - middleware will hash it
            role: 'admin',
            lastLogin: new Date()
        });
        
        // Save (middleware will hash the password)
        await adminUser.save();
        console.log('✅ Admin user saved');
        
        // Verify by retrieving fresh from DB
        const freshAdmin = await User.findOne({ email: 'admin@stayfinder.com' });
        
        console.log('\n🔍 Verification:');
        console.log('Password hash stored:', freshAdmin.password.substring(0, 30) + '...');
        
        // Test the password
        const isMatch = await bcrypt.compare('admin123', freshAdmin.password);
        console.log('Password "admin123" matches:', isMatch ? '✅ YES' : '❌ NO');
        
        if (isMatch) {
            console.log('\n🎉 SUCCESS! Login with:');
            console.log('   Email: admin@stayfinder.com');
            console.log('   OR Username: admin');
            console.log('   Password: admin123');
        } else {
            console.log('\n❌ Password mismatch. The middleware might be double-hashing.');
        }
        
        mongoose.connection.close();
        process.exit(isMatch ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 11000) {
            console.error('💡 Duplicate email or username');
        }
        mongoose.connection.close();
        process.exit(1);
    }
}