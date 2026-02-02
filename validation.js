// validation.js
const Joi = require('joi');

// Registration Validation Schema
const registerSchema = Joi.object({
    firstName: Joi.string()
        .min(3)
        .max(50)
        .required()
        .messages({
            'string.min': 'First name must be at least 3 characters',
            'string.max': 'First name cannot exceed 50 characters',
            'string.empty': 'First name is required'
        }),
    
    lastName: Joi.string()
        .min(3)
        .max(50)
        .required()
        .messages({
            'string.min': 'Last name must be at least 3 characters',
            'string.max': 'Last name cannot exceed 50 characters',
            'string.empty': 'Last name is required'
        }),
    
    username: Joi.string()
        .min(3)
        .max(30)
        .pattern(/^[a-zA-Z0-9_]+$/)
        .required()
        .messages({
            'string.min': 'Username must be at least 3 characters',
            'string.max': 'Username cannot exceed 30 characters',
            'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
            'string.empty': 'Username is required'
        }),
    
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please enter a valid email address',
            'string.empty': 'Email is required'
        }),
    
    phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .allow('')
        .messages({
            'string.pattern.base': 'Phone number must be exactly 10 digits'
        }),
    
    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters',
            'string.empty': 'Password is required'
        }),
    
    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'string.empty': 'Please confirm your password'
        })
});

// Login Validation Schema
const loginSchema = Joi.object({
    username: Joi.string()
        .required()
        .messages({
            'string.empty': 'Username or email is required'
        }),
    
    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required'
        })
});

// Create Listing Validation Schema
const createListingSchema = Joi.object({
    title: Joi.string()
        .min(5)
        .max(100)
        .required()
        .messages({
            'string.min': 'Title must be at least 5 characters',
            'string.max': 'Title cannot exceed 100 characters',
            'string.empty': 'Title is required'
        }),
    
    description: Joi.string()
        .min(20)
        .max(2000)
        .required()
        .messages({
            'string.min': 'Description must be at least 20 characters',
            'string.max': 'Description cannot exceed 2000 characters',
            'string.empty': 'Description is required'
        }),
    
    price: Joi.number()
        .min(50)
        .max(10000)
        .required()
        .messages({
            'number.min': 'Price must be at least $50',
            'number.max': 'Price cannot exceed $10,000',
            'number.base': 'Price must be a number',
            'any.required': 'Price is required'
        }),
    
    location: Joi.string()
        .min(4)
        .max(200)
        .required()
        .messages({
            'string.min': 'Location must be at least 4 characters',
            'string.max': 'Location cannot exceed 200 characters',
            'string.empty': 'Location is required'
        }),
    
    country: Joi.string()
        .min(4)
        .max(100)
        .required()
        .messages({
            'string.min': 'Country must be at least 4 characters',
            'string.max': 'Country cannot exceed 100 characters',
            'string.empty': 'Country is required'
        })
});

// Edit Listing Validation Schema
const editListingSchema = Joi.object({
    title: Joi.string()
        .min(5)
        .max(100)
        .required()
        .messages({
            'string.min': 'Title must be at least 5 characters',
            'string.max': 'Title cannot exceed 100 characters',
            'string.empty': 'Title is required'
        }),
    
    description: Joi.string()
        .min(20)
        .max(2000)
        .required()
        .messages({
            'string.min': 'Description must be at least 20 characters',
            'string.max': 'Description cannot exceed 2000 characters',
            'string.empty': 'Description is required'
        }),
    
    price: Joi.number()
        .min(50)
        .max(10000)
        .required()
        .messages({
            'number.min': 'Price must be at least $50',
            'number.max': 'Price cannot exceed $10,000',
            'number.base': 'Price must be a number',
            'any.required': 'Price is required'
        }),
    
    location: Joi.string()
        .min(4)
        .max(200)
        .required()
        .messages({
            'string.min': 'Location must be at least 4 characters',
            'string.max': 'Location cannot exceed 200 characters',
            'string.empty': 'Location is required'
        }),
    
    country: Joi.string()
        .min(4)
        .max(100)
        .required()
        .messages({
            'string.min': 'Country must be at least 4 characters',
            'string.max': 'Country cannot exceed 100 characters',
            'string.empty': 'Country is required'
        })
});

// Contact Form Validation Schema
const contactSchema = Joi.object({
    senderEmail: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please enter a valid email address',
            'string.empty': 'Email is required'
        }),
    
    emailSubject: Joi.string()
        .min(5)
        .max(200)
        .required()
        .messages({
            'string.min': 'Subject must be at least 5 characters',
            'string.max': 'Subject cannot exceed 200 characters',
            'string.empty': 'Subject is required'
        }),
    
    emailMessage: Joi.string()
        .min(10)
        .max(2000)
        .required()
        .messages({
            'string.min': 'Message must be at least 10 characters',
            'string.max': 'Message cannot exceed 2000 characters',
            'string.empty': 'Message is required'
        })
});

// UPDATED Validation Middleware with PROPER SESSION CLEARING
const validate = (schema, formContext = '') => {
    return (req, res, next) => {
        const dataToValidate = req.body;
        
        // Clean phone number if it exists
        if (dataToValidate.phone) {
            dataToValidate.phone = dataToValidate.phone.replace(/\D/g, '');
        }
        
        const { error } = schema.validate(dataToValidate, { 
            abortEarly: false,
            stripUnknown: true
        });
        
        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            
            // Store validation errors in session with timestamp
            req.session.validationErrors = {
                title: 'Validation Error',
                messages: errorMessages,
                timestamp: Date.now(),
                formContext: formContext || req.path
            };
            
            // Store form data for repopulation
            req.session.formData = dataToValidate;
            
            // Set auto-clear timeout (5 seconds)
            setTimeout(() => {
                if (req.session.validationErrors && 
                    req.session.validationErrors.timestamp === req.session.validationErrors.timestamp) {
                    delete req.session.validationErrors;
                }
                if (req.session.formData) {
                    delete req.session.formData;
                }
            }, 5000);
            
            // For AJAX contact form requests
            if (req.originalUrl.includes('/api/send-email')) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errorMessages,
                    errorSummary: 'Please fix the following errors:',
                    showPopup: true
                });
            }
            
            // Determine redirect path
            let redirectPath = req.headers.referer || '/';
            
            // Special handling for edit listing PUT requests
            if (req.method === 'PUT' && req.params.id) {
                redirectPath = `/listings/${req.params.id}/edit`;
            }
            
            return res.redirect(redirectPath);
        }
        
        // Clear session data on successful validation
        if (req.session.validationErrors) {
            delete req.session.validationErrors;
        }
        if (req.session.formData) {
            delete req.session.formData;
        }
        
        next();
    };
};

// Export all schemas and middleware
module.exports = {
    registerSchema,
    loginSchema,
    createListingSchema,
    editListingSchema,
    contactSchema,
    validateRegister: validate(registerSchema, 'register'),
    validateLogin: validate(loginSchema, 'login'),
    validateCreateListing: validate(createListingSchema, 'create-listing'),
    validateEditListing: validate(editListingSchema, 'edit-listing'),
    validateContact: validate(contactSchema, 'contact')
};