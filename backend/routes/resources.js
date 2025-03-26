const express = require('express');
const {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getNearbyResources,
  updateResourceStatus,
  getMyResources
} = require('../controllers/resourceController');

const Resource = require('../models/Resource');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');
const { resourceValidation } = require('../utils/validators');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

// Public routes
router.get('/', getResources);
router.get('/nearby', getNearbyResources);
router.get('/:id', getResource);

// Protected routes
router.use(protect);

// Get resources for the logged in user
router.get('/my', getMyResources);

// Advanced results middleware for all resources (admin/volunteer)
router.get('/', 
  authorize('admin', 'volunteer'), 
  advancedResults(Resource, {
    path: 'user',
    select: 'name email'
  }),
  getResources
);

// CRUD routes
router.post('/', createResource);
router.put('/:id', updateResource);
router.delete('/:id', deleteResource);
router.put('/:id/status', updateResourceStatus);

module.exports = router;