module.exports = {
    isLoggedIn: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error', 'You need to be logged in to access that page');
        res.redirect('/login');
    },
    
    isAdmin: (req, res, next) => {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        req.flash('error', 'You need to be an admin to access that page');
        res.redirect('/');
    }
};