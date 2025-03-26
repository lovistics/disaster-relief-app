/**
 * Custom error response class to standardize error handling
 * @extends Error
 */
class AppError extends Error {
    /**
     * Create an ErrorResponse
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {Array} [errors] - Validation errors array
     */
    constructor(message, statusCode, errors = []) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
      this.errors = errors;

      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = AppError;