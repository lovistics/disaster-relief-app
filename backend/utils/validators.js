const { check, validationResult } = require('express-validator');

// Register validation
const registerValidation = [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
];

// Login validation
const loginValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

// Profile update validation
const profileUpdateValidation = [
  check('name', 'Name is required').optional(),
  check('email', 'Please include a valid email').optional().isEmail(),
  check('phone', 'Phone number is not valid').optional().isMobilePhone(),
  check('address', 'Address is too long').optional().isLength({ max: 200 })
];

// Emergency validation
const emergencyValidation = [
  check('title', 'Title is required').not().isEmpty(),
  check('title', 'Title cannot exceed 100 characters').isLength({ max: 100 }),
  check('description', 'Description is required').not().isEmpty(),
  check('description', 'Description cannot exceed 500 characters').isLength({ max: 500 }),
  check('type', 'Emergency type is required').not().isEmpty(),
  check('type', 'Invalid emergency type').isIn([
    'medical',
    'fire',
    'flood',
    'earthquake',
    'hurricane',
    'tornado',
    'tsunami',
    'landslide',
    'other'
  ]),
  check('urgency', 'Invalid urgency level').optional().isIn(['low', 'medium', 'high', 'critical']),
  check('peopleAffected', 'People affected must be a number').optional().isNumeric(),
  check('address', 'Address is required').not().isEmpty()
];

// Resource validation
const resourceValidation = [
  check('name', 'Name is required').not().isEmpty(),
  check('name', 'Name cannot exceed 100 characters').isLength({ max: 100 }),
  check('description', 'Description is required').not().isEmpty(),
  check('description', 'Description cannot exceed 500 characters').isLength({ max: 500 }),
  check('type', 'Resource type is required').not().isEmpty(),
  check('type', 'Invalid resource type').isIn([
    'water',
    'food',
    'medical',
    'shelter',
    'clothing',
    'transport',
    'volunteers',
    'other'
  ]),
  check('quantity', 'Quantity is required').not().isEmpty(),
  check('quantity', 'Quantity must be a number greater than 0').isInt({ min: 1 }),
  check('address', 'Address is required').not().isEmpty()
];

// Location validation
const locationValidation = [
  check('latitude', 'Latitude is required').not().isEmpty(),
  check('latitude', 'Latitude must be a valid decimal between -90 and 90')
    .isFloat({ min: -90, max: 90 }),
  check('longitude', 'Longitude is required').not().isEmpty(),
  check('longitude', 'Longitude must be a valid decimal between -180 and 180')
    .isFloat({ min: -180, max: 180 })
];

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  profileUpdateValidation,
  emergencyValidation,
  resourceValidation,
  locationValidation,
  validate
};