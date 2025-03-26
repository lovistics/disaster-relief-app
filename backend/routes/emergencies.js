const express = require('express');
const {
  getEmergencies,
  getEmergency,
  createEmergency,
  updateEmergency,
  deleteEmergency,
  getNearbyEmergencies,
  updateResourceMatch
} = require('../controllers/emergencyController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getEmergencies);
router.get('/nearby', getNearbyEmergencies);
router.get('/:id', getEmergency);

// Protected routes
router.use(protect);

router.post('/', createEmergency);
router.put('/:id', updateEmergency);
router.delete('/:id', deleteEmergency);
router.put('/:id/resources/:resourceId', updateResourceMatch);

module.exports = router;