/**
 * Request validation middleware
 * Provides a simple way to validate requests using express-validator
 */
const { validationResult } = require('express-validator');

// Validate request based on validation rules
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }
  next();
};

module.exports = { validateRequest };