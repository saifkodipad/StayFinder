const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const multer = require('multer');
const fs = require('fs');

// Import models
const User = require('./models/user');
const Listing = require('./models/listing');
const Review = require('./models/review');
const Media = require('./models/media');

// Import middleware
const { isLoggedIn, isAdmin } = require('./middleware/auth');

// Initialize app
const app = express();

// Load environment variables
require('dotenv').config();

// ==================== DATABASE CONNECTION ====================
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/StayFinder';
mongoose.connect(mongoURI)
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
    console.log('❌ MongoDB Connection Error:', err.message);
    console.log('💡 Tip: Make sure MongoDB is running (run "mongod" in terminal)');
});

// ==================== 7-DAY SESSION CONFIGURATION ====================
app.use(cookieParser());

// FALLBACK SESSION CONFIGURATION - Will work 100%
let sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-for-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
};

// Try to use MongoDB store, fallback to memory store if it fails
try {
    const MongoStore = require('connect-mongo');
    sessionConfig.store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/StayFinder',
        ttl: 7 * 24 * 60 * 60
    });
    console.log('✅ Sessions stored in MongoDB');
} catch (err) {
    console.log('⚠️  Using memory store for sessions (not recommended for production)');
    // Memory store (temporary - will lose sessions on server restart)
}

app.use(session(sessionConfig));

// ==================== MULTER CONFIGURATION ====================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/';
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('📁 Created uploads directory:', uploadDir);
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// ==================== PASSPORT CONFIGURATION ====================
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = await User.findOne({ 
                $or: [{ username: username }, { email: username }] 
            });
            
            if (!user) {
                return done(null, false, { message: 'Incorrect username or email' });
            }
            
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password' });
            }
            
            return done(null, user);
        } catch (err) {
            console.error('Passport authentication error:', err);
            return done(err);
        }
    }
));

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// View engine setup with layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/boilerplate');

// ==================== GLOBAL MIDDLEWARE ====================
app.use((req, res, next) => {
    res.locals.title = 'StayFinder';
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.warning = req.flash('warning');
    next();
});

// ==================== ROUTES ====================

// Home route
app.get('/', async (req, res) => {
    try {
        const listings = await Listing.find({}).limit(6).populate('owner');
        res.render('listings/landing', { 
            title: 'Home - StayFinder',
            allListings: listings
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading homepage');
        res.render('listings/landing', { 
            title: 'Home - StayFinder',
            allListings: []
        });
    }
});

// ==================== AUTH ROUTES ====================

// Register - GET
app.get('/register', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.render('users/register', { 
        title: 'Register - StayFinder',
        error: '',
        success: ''
    });
});

// Register - POST - SIMPLIFIED
app.post('/register', async (req, res) => {
    try {
        console.log('Registration attempt:', req.body);
        
        const { firstName, lastName, username, email, password, phone } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email: email }, { username: username.toLowerCase() }] 
        });
        
        if (existingUser) {
            return res.render('users/register', { 
                title: 'Register - StayFinder',
                error: 'Username or email already exists',
                success: ''
            });
        }
        
        // Clean phone number
        let cleanedPhone = '';
        if (phone && phone.trim()) {
            cleanedPhone = phone.replace(/\D/g, '');
        }
        
        // Create new user
        const newUser = new User({
            firstName,
            lastName,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password,
            phone: cleanedPhone,
            role: 'user'
        });
        
        console.log('Saving new user...');
        await newUser.save();
        console.log('User saved successfully!');
        
        // Auto login after registration
        req.login(newUser, (err) => {
            if (err) {
                console.error('Auto login error:', err);
                req.flash('success', 'Registration successful! Please login.');
                return res.redirect('/login');
            }
            req.flash('success', `Welcome to StayFinder, ${newUser.firstName}!`);
            res.redirect('/');
        });
        
    } catch (err) {
        console.error('Registration error:', err);
        res.render('users/register', { 
            title: 'Register - StayFinder',
            error: 'Registration failed. ' + err.message,
            success: ''
        });
    }
});

// Login - GET
app.get('/login', (req, res) => { 
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.render('users/login', { 
        title: 'Login - StayFinder',
        error: '',
        success: ''
    });
});

// Login - POST
app.post('/login', (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) {
            console.error('Passport authentication error:', err);
            return res.render('users/login', { 
                title: 'Login - StayFinder',
                error: 'Authentication error occurred',
                success: ''
            });
        }
        
        if (!user) {
            return res.render('users/login', { 
                title: 'Login - StayFinder',
                error: info.message || 'Invalid credentials',
                success: ''
            });
        }
        
        req.login(user, async (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return res.render('users/login', { 
                    title: 'Login - StayFinder',
                    error: 'Login failed',
                    success: ''
                });
            }
            
            try {
                // Update lastLogin
                await User.findByIdAndUpdate(
                    user._id,
                    { lastLogin: new Date() },
                    { new: true }
                );
                
                req.flash('success', `Welcome back, ${user.firstName}!`);
                return res.redirect('/');
            } catch (updateErr) {
                console.error('Error updating last login:', updateErr);
                req.flash('success', `Welcome back, ${user.firstName}!`);
                return res.redirect('/');
            }
        });
    })(req, res, next);
});

// Logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            req.flash('error', 'Logout failed');
            return res.redirect('/');
        }
        req.flash('success', 'Logged out successfully');
        res.redirect('/');
    });
});

// ==================== ADMIN ROUTES ====================

// Admin Dashboard
app.get('/admin/dashboard', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const allUsers = await User.find({});
        const allListings = await Listing.find({}).populate('owner');
        
        res.render('admin/dashboard', {
            allUsers,
            allListings,
            currentUser: req.user,
            title: 'Admin Dashboard - StayFinder'
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
});

// Make user admin
app.post('/admin/users/:id/make-admin', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/dashboard');
        }
        
        user.role = 'admin';
        await user.save();
        
        req.flash('success', `User ${user.username} promoted to admin`);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error promoting user');
        res.redirect('/admin/dashboard');
    }
});

// Remove admin role
app.post('/admin/users/:id/remove-admin', isLoggedIn, isAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            req.flash('error', 'You cannot remove admin role from yourself');
            return res.redirect('/admin/dashboard');
        }
        
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/dashboard');
        }
        
        user.role = 'user';
        await user.save();
        
        req.flash('success', `Admin role removed from ${user.username}`);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error removing admin role');
        res.redirect('/admin/dashboard');
    }
});

// Delete user (admin only)
app.delete('/admin/users/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            req.flash('error', 'You cannot delete yourself');
            return res.redirect('/admin/dashboard');
        }
        
        await User.findByIdAndDelete(req.params.id);
        req.flash('success', 'User deleted successfully');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting user');
        res.redirect('/admin/dashboard');
    }
});

// Delete listing (admin only)
app.delete('/admin/listings/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        await Listing.findByIdAndDelete(req.params.id);
        req.flash('success', 'Listing deleted successfully');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting listing');
        res.redirect('/admin/dashboard');
    }
});

// ==================== OTHER ROUTES ====================

// Listings page
app.get('/listings', async (req, res) => {
    try {
        let queryObj = {};
        
        // Handle filter queries
        if (req.query.country) {
            queryObj.country = new RegExp(req.query.country, 'i');
        }
        
        if (req.query.minPrice || req.query.maxPrice) {
            queryObj.price = {};
            if (req.query.minPrice) {
                queryObj.price.$gte = parseInt(req.query.minPrice);
            }
            if (req.query.maxPrice) {
                queryObj.price.$lte = parseInt(req.query.maxPrice);
            }
        }
        
        const listings = await Listing.find(queryObj).populate('owner');
        
        console.log(`📊 Found ${listings.length} listings in database`);
        
        res.render('listings/listings', { 
            allListings: listings,
            title: 'Browse Listings - StayFinder',
            query: req.query
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading listings');
        res.redirect('/');
    }
});

// Create listing page
app.get('/listings/new', isLoggedIn, (req, res) => {
    res.render('listings/new', { title: 'Create Listing - StayFinder' });
});

// Create listing - POST - SIMPLIFIED
app.post('/listings', isLoggedIn, upload.array('media', 12), async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Files:', req.files);
        
        const { title, description, price, location, country } = req.body;
        
        const newListing = new Listing({
            title,
            description,
            price: Number(price),
            location,
            country: country || 'India',
            owner: req.user._id,
            isAvailable: true
        });
        
        // Handle uploaded files
        if (req.files && req.files.length > 0) {
            const mediaFiles = req.files.map(file => ({
                url: `/uploads/${file.filename}`,
                mediaType: file.mimetype.startsWith('image/') ? 'image' : 'video',
                filename: file.originalname,
                uploadedAt: new Date()
            }));
            
            newListing.media = mediaFiles;
        }
        
        await newListing.save();
        
        const totalListings = await Listing.countDocuments();
        console.log(`✅ Listing created! Total listings now: ${totalListings}`);
        
        req.flash('success', 'Listing created successfully!');
        res.redirect(`/listings/${newListing._id}`);
    } catch (err) {
        console.error('Error creating listing:', err);
        req.flash('error', 'Error creating listing: ' + err.message);
        res.redirect('/listings/new');
    }
});

// Show listing
app.get('/listings/:id', async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id)
            .populate('owner')
            .populate({
                path: 'reviews.user',
                select: 'username firstName lastName'
            });
        
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        res.render('listings/show', { 
            listing,
            title: `${listing.title} - StayFinder`,
            layout: false
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading listing');
        res.redirect('/listings');
    }
});

// Edit listing page
app.get('/listings/:id/edit', isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        // Check if user owns the listing or is admin
        if (!listing.owner.equals(req.user._id) && req.user.role !== 'admin') {
            req.flash('error', 'You do not have permission to edit this listing');
            return res.redirect(`/listings/${listing._id}`);
        }
        
        res.render('listings/edit', { 
            listing,
            title: `Edit ${listing.title} - StayFinder`
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading edit page');
        res.redirect('/listings');
    }
});

// Update listing - SIMPLIFIED
app.put('/listings/:id', isLoggedIn, upload.array('media', 12), async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        // Check if user owns the listing or is admin
        if (!listing.owner.equals(req.user._id) && req.user.role !== 'admin') {
            req.flash('error', 'You do not have permission to edit this listing');
            return res.redirect(`/listings/${listing._id}`);
        }
        
        const { title, description, price, location, country } = req.body;
        
        // Check which existing media to keep
        const keepMedia = req.body.keepMedia || [];
        
        // Update text fields
        listing.title = title;
        listing.description = description;
        listing.price = Number(price);
        listing.location = location;
        if (country) listing.country = country;
        
        // Handle existing media - filter out the ones marked for deletion
        if (keepMedia.length > 0 && listing.media && listing.media.length > 0) {
            listing.media = listing.media.filter(item => {
                return keepMedia.includes(item._id ? item._id.toString() : item._id);
            });
        } else if (keepMedia.length === 0 && listing.media) {
            listing.media = listing.media;
        }
        
        // Handle new uploaded files
        if (req.files && req.files.length > 0) {
            const newMediaFiles = req.files.map(file => ({
                url: `/uploads/${file.filename}`,
                mediaType: file.mimetype.startsWith('image/') ? 'image' : 'video',
                filename: file.originalname,
                uploadedAt: new Date()
            }));
            
            listing.media = [...listing.media, ...newMediaFiles];
        }
        
        await listing.save();
        
        req.flash('success', 'Listing updated successfully!');
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        console.error('Error updating listing:', err);
        req.flash('error', 'Error updating listing: ' + err.message);
        res.redirect(`/listings/${req.params.id}/edit`);
    }
});

// Delete listing
app.delete('/listings/:id', isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        // Check if user owns the listing or is admin
        if (!listing.owner.equals(req.user._id) && req.user.role !== 'admin') {
            req.flash('error', 'You do not have permission to delete this listing');
            return res.redirect(`/listings/${listing._id}`);
        }
        
        await listing.deleteOne();
        req.flash('success', 'Listing deleted successfully!');
        res.redirect('/listings');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting listing');
        res.redirect(`/listings/${req.params.id}`);
    }
});

// User's listings
app.get('/users/listings', isLoggedIn, async (req, res) => {
    try {
        const userListings = await Listing.find({ owner: req.user._id });
        res.render('listings/user-listings', {
            userListings,
            title: 'My Listings - StayFinder'
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading your listings');
        res.redirect('/users/profile');
    }
});

// ==================== REVIEW ROUTES ====================

// POST route for submitting reviews
app.post('/listings/:id/reviews', isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        // Create new review object
        const newReview = {
            user: req.user._id,
            rating: parseInt(req.body.review.rating),
            comment: req.body.review.comment,
            createdAt: new Date()
        };
        
        // Add review to listing's reviews array
        listing.reviews.push(newReview);
        
        // Save the listing
        await listing.save();
        
        req.flash('success', 'Review submitted successfully!');
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        console.error('Error submitting review:', err);
        req.flash('error', 'Error submitting review: ' + err.message);
        res.redirect(`/listings/${req.params.id}`);
    }
});

// DELETE route for deleting a specific review
app.delete('/listings/:listingId/reviews/:reviewId', isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.listingId);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        // Find the review index
        const reviewIndex = listing.reviews.findIndex(review => 
            review._id.toString() === req.params.reviewId
        );
        
        if (reviewIndex === -1) {
            req.flash('error', 'Review not found');
            return res.redirect(`/listings/${listing._id}`);
        }
        
        // Check if user owns the review or is admin
        const review = listing.reviews[reviewIndex];
        const isReviewOwner = review.user.toString() === req.user._id.toString();
        const isAdminUser = req.user.role === 'admin';
        
        if (!isReviewOwner && !isAdminUser) {
            req.flash('error', 'You do not have permission to delete this review');
            return res.redirect(`/listings/${listing._id}`);
        }
        
        // Remove the review
        listing.reviews.splice(reviewIndex, 1);
        
        // Save the listing
        await listing.save();
        
        req.flash('success', 'Review deleted successfully!');
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        console.error('Error deleting review:', err);
        req.flash('error', 'Error deleting review: ' + err.message);
        res.redirect(`/listings/${req.params.listingId}`);
    }
});

// POST route for liking/unliking listings
app.post('/listings/:id/like', isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        
        const userId = req.user._id;
        const userLiked = listing.likes && listing.likes.includes(userId);
        
        if (userLiked) {
            // Unlike - remove user from likes array
            listing.likes = listing.likes.filter(id => !id.equals(userId));
        } else {
            // Like - add user to likes array
            if (!listing.likes) {
                listing.likes = [];
            }
            listing.likes.push(userId);
        }
        
        await listing.save();
        
        res.json({
            liked: !userLiked,
            likesCount: listing.likesCount || 0
        });
    } catch (err) {
        console.error('Error toggling like:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Test route to check all listings
app.get('/debug/listings', async (req, res) => {
    try {
        const listings = await Listing.find({}).populate('owner');
        res.json({
            success: true,
            count: listings.length,
            listings: listings.map(l => ({
                id: l._id,
                title: l.title,
                location: l.location,
                country: l.country,
                price: l.price,
                owner: l.owner ? l.owner.username : 'No owner',
                mediaCount: l.media ? l.media.length : 0,
                createdAt: l.createdAt
            }))
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// Test route
app.get('/test-db', async (req, res) => {
    try {
        const users = await User.countDocuments();
        const listings = await Listing.countDocuments();
        const admins = await User.countDocuments({ role: 'admin' });
        
        res.json({
            success: true,
            users,
            listings,
            admins
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// ==================== CREATE FIRST ADMIN USER ====================

const createFirstAdmin = async () => {
    try {
        const adminCount = await User.countDocuments({ role: 'admin' });
        
        if (adminCount === 0) {
            const existingAdmin = await User.findOne({ 
                $or: [{ username: 'admin' }, { email: 'admin@stayfinder.com' }] 
            });
            
            if (!existingAdmin) {
                // Create admin without triggering password middleware
                const adminUser = new User({
                    firstName: 'Admin',
                    lastName: 'User',
                    username: 'admin',
                    email: 'admin@stayfinder.com',
                    phone: '1234567890',
                    role: 'admin'
                });
                
                // Hash password manually to avoid middleware issues
                const salt = await bcrypt.genSalt(12);
                adminUser.password = await bcrypt.hash('admin123', salt);
                
                await adminUser.save();
                console.log('\n✅ FIRST ADMIN USER CREATED!');
                console.log('==============================');
                console.log('👤 Username: admin');
                console.log('🔑 Password: admin123');
                console.log('📧 Email: admin@stayfinder.com');
                console.log('👑 Role: admin');
                console.log('==============================\n');
            } else {
                console.log('ℹ️  Admin user already exists');
            }
        } else {
            console.log(`ℹ️  Found ${adminCount} admin users in database`);
        }
    } catch (err) {
        console.error('❌ Error creating admin user:', err.message);
    }
};

// ==================== CREATE SAMPLE DATA ====================

const createSampleData = async () => {
    try {
        const listingCount = await Listing.countDocuments();
        
        if (listingCount === 0) {
            console.log('📊 Creating sample listings...');
            
            // Get admin user to be owner
            const admin = await User.findOne({ username: 'admin' });
            
            if (admin) {
                const sampleListings = [
                    {
                        title: 'Luxury Villa in Tuscany with Vineyard Views',
                        description: 'Stunning 5-bedroom villa with private pool, vineyard tours, and panoramic Tuscan hills views. Perfect for wine enthusiasts and luxury seekers.',
                        price: 45000,
                        location: 'Chianti, Tuscany',
                        country: 'Italy',
                        isAvailable: true,
                        coordinates: {
                            type: 'Point',
                            coordinates: [11.2566, 43.5486]
                        },
                        owner: admin._id,
                        media: [
                            {
                                url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&h=800&fit=crop&crop=entropy&q=80',
                                mediaType: 'image',
                                filename: 'tuscany-villa-1.jpg',
                                uploadedAt: new Date()
                            },
                            {
                                url: 'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=1200&h=800&fit=crop&crop=entropy&q=80',
                                mediaType: 'image',
                                filename: 'tuscany-villa-2.jpg',
                                uploadedAt: new Date()
                            },
                            {
                                url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&h=800&fit=crop&crop=entropy&q=80',
                                mediaType: 'image',
                                filename: 'tuscany-villa-3.jpg',
                                uploadedAt: new Date()
                            }
                        ],
                        reviews: [],
                        likes: [],
                        likesCount: 0
                    },
                    {
                        title: 'Modern Alpine Chalet in Swiss Alps',
                        description: 'Contemporary 4-bedroom chalet with floor-to-ceiling windows offering breathtaking mountain views. Features a private sauna, heated floors, and ski-in/ski-out access.',
                        price: 52000,
                        location: 'Zermatt, Switzerland',
                        country: 'Switzerland',
                        isAvailable: true,
                        coordinates: {
                            type: 'Point',
                            coordinates: [7.7486, 46.0207]
                        },
                        owner: admin._id,
                        media: [
                            {
                                url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&h-800&fit=crop&crop=entropy&q=80',
                                mediaType: 'image',
                                filename: 'swiss-chalet-1.jpg',
                                uploadedAt: new Date()
                            },
                            {
                                url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h-800&fit=crop&crop=entropy&q=80',
                                mediaType: 'image',
                                filename: 'swiss-chalet-2.jpg',
                                uploadedAt: new Date()
                            }
                        ],
                        reviews: [],
                        likes: [],
                        likesCount: 0
                    }
                ];
                
                await Listing.insertMany(sampleListings);
                console.log(`✅ Created ${sampleListings.length} sample listings`);
            } else {
                console.log('❌ Admin user not found. Please create admin user first.');
            }
        } else {
            console.log(`ℹ️  Found ${listingCount} existing listings`);
        }
    } catch (err) {
        console.error('❌ Error creating sample data:', err.message);
    }
};

// Run after database connection
mongoose.connection.once('open', async () => {
    console.log('📊 Initializing database...');
    await createFirstAdmin();
    await createSampleData();
});

// ==================== USER PROFILE ROUTES ====================

// User profile - GET (for current user)
app.get('/users/profile', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/');
    }
    
    // Get user statistics
    const stats = await user.getStatistics();
    
    // Get user's listings (hosted by user)
    const userListings = await Listing.find({ owner: user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Get listings liked by user
    const likedListings = await Listing.find({ likes: user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Log for debugging
    console.log(`Profile Loaded: ${user.username}`);
    console.log(`- My Listings: ${userListings.length} listings`);
    console.log(`- Liked Listings: ${likedListings.length} listings`);
    
    res.render('users/profile', { 
      user,
      stats,
      userListings,
      likedListings,
      isOwnProfile: true,
      title: `${user.fullName}'s Profile - StayFinder` 
    });
  } catch (err) {
    console.error('Error loading profile:', err);
    req.flash('error', 'Error loading profile');
    res.redirect('/');
  }
});

// User profile by ID - GET (for viewing other users)
app.get('/users/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/');
    }
    
    // Get user statistics
    const stats = await user.getStatistics();
    
    // Get user's listings (hosted by user)
    const userListings = await Listing.find({ owner: user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Get listings liked by user (only show if viewing own profile or public)
    let likedListings = [];
    const isOwnProfile = req.isAuthenticated() && req.user.id === user.id;
    
    if (isOwnProfile) {
      likedListings = await Listing.find({ likes: user._id })
        .sort({ createdAt: -1 })
        .limit(20);
    }
    
    res.render('users/profile', { 
      user,
      stats,
      userListings,
      likedListings,
      isOwnProfile,
      title: `${user.fullName}'s Profile - StayFinder` 
    });
  } catch (err) {
    console.error('Error loading user profile:', err);
    req.flash('error', 'Error loading user profile');
    res.redirect('/');
  }
});

// Update last login when user visits their own profile
app.get('/users/profile/update-last-login', isLoggedIn, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { lastLogin: new Date() },
      { new: true }
    );
    res.redirect('/users/profile');
  } catch (err) {
    console.error('Error updating last login:', err);
    res.redirect('/users/profile');
  }
});

// ==================== ADMIN USER MANAGEMENT ====================

// Admin - Manage Users Page
app.get('/admin/manageUsers', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .lean();
    
    res.render('admin/manageUsers', {
      users,
      currentUser: req.user,
      title: 'Manage Users - Admin Dashboard'
    });
  } catch (err) {
    console.error('Error loading manage users page:', err);
    req.flash('error', 'Error loading users');
    res.redirect('/admin/dashboard');
  }
});

// Admin - View User Profile
app.get('/admin/users/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/manageUsers');
    }
    
    // Get user statistics
    const stats = await user.getStatistics();
    
    // Get user's listings
    const userListings = await Listing.find({ owner: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.render('users/adminView', {
      user,
      stats,
      userListings,
      isAdminView: true,
      currentUser: req.user,
      title: `${user.username} - Admin View`
    });
  } catch (err) {
    console.error('Error viewing user:', err);
    req.flash('error', 'Error loading user profile');
    res.redirect('/admin/manageUsers');
  }
});

// ==================== EMAIL ROUTE ====================

// Create transporter for email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Email sending endpoint - SIMPLIFIED
app.post('/api/send-email', async (req, res) => {
    try {
        const { senderEmail, emailSubject, emailMessage } = req.body;

        // Email to yourself (admin)
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'rahamansaiif029@gmail.com', // Your email
            replyTo: senderEmail,
            subject: `StayFinder Contact: ${emailSubject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #FF385C;">New Contact Form Submission</h2>
                    <hr style="border: 1px solid #e5e7eb;">
                    <p><strong>From:</strong> ${senderEmail}</p>
                    <p><strong>Subject:</strong> ${emailSubject}</p>
                    <p><strong>Message:</strong></p>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
                        ${emailMessage.replace(/\n/g, '<br>')}
                    </div>
                    <hr style="border: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">
                        This email was sent from StayFinder contact form.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        
        res.json({ 
            success: true, 
            message: 'Message sent successfully! We will respond within 24 hours.' 
        });
        
    } catch (err) {
        console.error('Email sending error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message. Please try again.' 
        });
    }
});

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found - StayFinder',
        layout: 'layouts/boilerplate' 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('🔥 Error:', err.message);
    res.status(err.status || 500).render('error', { 
        message: err.message,
        error: process.env.NODE_ENV === 'development' ? err : {},
        title: 'Error - StayFinder',
        layout: 'layouts/boilerplate'
    });
});

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔍 Visit http://localhost:${PORT}/debug/listings to see all listings`);
});