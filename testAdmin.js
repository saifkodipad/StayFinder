// forceReset.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

mongoose.connect(process.env.ATLAS_URL)
.then(async () => {
    console.log('🔄 FORCE PASSWORD RESET\n');
    
    const User = require('./models/user.js');
    
    // Find admin
    const admin = await User.findOne({ email: 'admin@stayfinder.com' });
    if (!admin) {
        console.log('❌ Admin not found');
        process.exit(1);
    }
    
    console.log('📋 Current admin info:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Current password hash: ${admin.password.substring(0, 30)}...`);
    
    // Generate NEW salt and hash
    console.log('\n🔐 Generating new password hash...');
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash('admin123', salt);
    
    console.log(`   New salt: ${salt}`);
    console.log(`   New hash: ${newHash.substring(0, 30)}...`);
    
    // Update password
    admin.password = newHash;
    await admin.save();
    
    console.log('\n✅ Password updated in database');
    
    // Verify IMMEDIATELY
    const updatedAdmin = await User.findOne({ email: 'admin@stayfinder.com' });
    console.log(`   Stored hash: ${updatedAdmin.password.substring(0, 30)}...`);
    
    const isMatch = await bcrypt.compare('admin123', updatedAdmin.password);
    console.log(`\n🔍 Verification: Password "admin123" matches: ${isMatch ? '✅ YES' : '❌ NO'}`);
    
    if (isMatch) {
        console.log('\n🎉 SUCCESS! You can now login with:');
        console.log('   Email: admin@stayfinder.com');
        console.log('   OR Username: admin');
        console.log('   Password: admin123');
    } else {
        console.log('\n❌ Something went wrong. The hash comparison failed.');
        console.log('💡 This could mean:');
        console.log('   1. bcrypt is not working correctly');
        console.log('   2. The password field is being modified elsewhere');
        console.log('   3. There\'s a schema issue');
    }
    
    mongoose.connection.close();
    process.exit(isMatch ? 0 : 1);
})
.catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});