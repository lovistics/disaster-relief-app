const { protect, authorize } = require('../middleware/auth');

const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateAvailability,
  updateSkills,
  getVolunteers
} = require('../controllers/userController');

const User = require('../models/User');
const advancedResults = require('../middleware/advancedResults');
const { profileUpdateValidation } = require('../utils/validators');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

// Apply protection and authorization to all routes
router.use(protect);

// Routes for volunteers
router.put('/availability', authorize('volunteer', 'admin'), updateAvailability);
router.put('/skills', authorize('volunteer', 'admin'), updateSkills);

// Get volunteers by location and skills
router.get('/volunteers', getVolunteers);

// Admin only routes
router.use(authorize('admin'));

router
  .route('/')
  .get(advancedResults(User), getUsers)
  .post(createUser);

router
  .route('/:id')
  .get(getUser)
  .put(profileUpdateValidation, validateRequest, updateUser)
  .delete(deleteUser);

module.exports = router;