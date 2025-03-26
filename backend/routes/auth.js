const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const {
  registerValidation,
  loginValidation,
  profileUpdateValidation
} = require('../utils/validators');

const router = express.Router();

// Public routes
router.post('/register', registerValidation, validateRequest, register);
router.post('/login', loginValidation, validateRequest, login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// Protected routes
router.use(protect);

router.get('/me', getMe);
router.put('/updatedetails', profileUpdateValidation, validateRequest, updateDetails);
router.put('/updatepassword', updatePassword);
router.get('/logout', logout);

module.exports = router;