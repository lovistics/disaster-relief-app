const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('express-async-handler');
const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Resource = require('../models/Resource');
const Notification = require('../models/Notification');
const { matchResourcesToEmergency } = require('../utils/matchingAlgorithm');
const geocoder = require('../utils/geocoder');
const { body } = require('express-validator');
const { validate, emergencyValidationSchemas } = require('../middleware/validate');
const EmergencyService = require('../services/EmergencyService');
const AppError = require('../utils/AppError');

// Validation rules
const createEmergencyValidation = emergencyValidationSchemas.create;

// @desc    Get all emergencies
// @route   GET /api/v1/emergencies
// @access  Public
const getEmergencies = asyncHandler(async (req, res) => {
  const { page, limit, sort, type, status, urgency } = req.query;
  
  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (urgency) query.urgency = urgency;

  const result = await EmergencyService.getAll(query, {
    page,
    limit,
    sort,
    populate: [
      { path: 'user', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { 
        path: 'matchedResources.resource',
        select: 'title type quantity location'
      }
    ]
  });

  res.json({
    success: true,
    ...result
  });
});

// @desc    Get nearby emergencies
// @route   GET /api/v1/emergencies/nearby
// @access  Public
const getNearbyEmergencies = asyncHandler(async (req, res) => {
  const { lat, lng, distance = 10000 } = req.query;

  if (!lat || !lng) {
    throw new AppError('Please provide latitude and longitude', 400);
  }

  const emergencies = await EmergencyService.getNearbyEmergencies(
    [parseFloat(lng), parseFloat(lat)],
    parseFloat(distance)
  );

  res.json({
    success: true,
    count: emergencies.length,
    data: emergencies
  });
});

// @desc    Get single emergency
// @route   GET /api/v1/emergencies/:id
// @access  Public
const getEmergency = asyncHandler(async (req, res) => {
  const emergency = await EmergencyService.getById(req.params.id, {
    populate: [
      { path: 'user', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { 
        path: 'matchedResources.resource',
        select: 'title type quantity location'
      }
    ]
  });

  res.json({
    success: true,
    data: emergency
  });
});

// @desc    Create new emergency
// @route   POST /api/v1/emergencies
// @access  Private
const createEmergency = [
  validate(createEmergencyValidation),
  asyncHandler(async (req, res) => {
    const emergency = await EmergencyService.createEmergency(req.body, req.user.id);

    res.status(201).json({
      success: true,
      data: emergency
    });
  })
];

// @desc    Update emergency
// @route   PUT /api/v1/emergencies/:id
// @access  Private
const updateEmergency = [
  validate([
    body('title').optional().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ min: 10, max: 500 }),
    body('type').optional().isIn(['medical', 'fire', 'flood', 'earthquake', 'hurricane', 'tornado', 'tsunami', 'landslide', 'other']),
    body('status').optional().isIn(['pending', 'active', 'resolved', 'cancelled']),
    body('urgency').optional().isIn(['low', 'medium', 'high', 'critical'])
  ]),
  asyncHandler(async (req, res) => {
    const emergency = await EmergencyService.updateEmergency(
      req.params.id,
      req.body,
      req.user.id
    );

    res.json({
      success: true,
      data: emergency
    });
  })
];

// @desc    Delete emergency
// @route   DELETE /api/v1/emergencies/:id
// @access  Private
const deleteEmergency = asyncHandler(async (req, res) => {
  const emergency = await EmergencyService.getById(req.params.id);

  // Check if user owns the emergency
  if (emergency.user.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this emergency', 403);
  }

  await EmergencyService.delete(req.params.id);

  res.json({
    success: true,
    data: {}
  });
});

// @desc    Update resource match status
// @route   PUT /api/v1/emergencies/:id/resources/:resourceId
// @access  Private
const updateResourceMatch = [
  validate([
    body('status')
      .isIn(['pending', 'accepted', 'rejected', 'delivered'])
      .withMessage('Invalid status')
  ]),
  asyncHandler(async (req, res) => {
    const emergency = await EmergencyService.updateResourceMatch(
      req.params.id,
      req.params.resourceId,
      req.body.status
    );

    res.json({
      success: true,
      data: emergency
    });
  })
];

// @desc    Get emergencies within radius
// @route   GET /api/v1/emergencies/radius/:zipcode/:distance
// @access  Private
const getEmergenciesInRadius = asyncHandler(async (req, res, next) => {
  const { zipcode, distance } = req.params;

  // Get lat/lng from geocoder
  const loc = await geocoder.geocode(zipcode);
  const lat = loc[0].latitude;
  const lng = loc[0].longitude;

  // Calc radius using radians
  // Divide dist by radius of Earth
  // Earth Radius = 6,378 km
  const radius = distance / 6378;

  const emergencies = await Emergency.find({
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
  });

  res.status(200).json({
    success: true,
    count: emergencies.length,
    data: emergencies
  });
});

// @desc    Get my emergencies
// @route   GET /api/v1/emergencies/my
// @access  Private
const getMyEmergencies = asyncHandler(async (req, res, next) => {
  const emergencies = await Emergency.find({ user: req.user.id });

  res.status(200).json({
    success: true,
    count: emergencies.length,
    data: emergencies
  });
});

// @desc    Match resources to an emergency
// @route   GET /api/v1/emergencies/:id/match
// @access  Private
const matchResourcesForEmergency = asyncHandler(async (req, res, next) => {
  const emergency = await Emergency.findById(req.params.id);

  if (!emergency) {
    return next(
      new ErrorResponse(`Emergency not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is emergency owner, assigned volunteer, or admin
  if (
    emergency.user.toString() !== req.user.id &&
    (!emergency.assignedTo || emergency.assignedTo.toString() !== req.user.id) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to match resources for this emergency`,
        401
      )
    );
  }

  // Get available resources
  const availableResources = await Resource.find({ status: 'available' });

  // Match resources
  const matches = matchResourcesToEmergency(emergency, availableResources);

  // Update emergency with matched resources
  emergency.matchedResources = matches.map(match => ({
    resource: match.resource,
    matchScore: match.matchScore,
    status: 'pending'
  }));

  await emergency.save();

  res.status(200).json({
    success: true,
    count: matches.length,
    data: matches
  });
});

// @desc    Accept/reject a matched resource
// @route   PUT /api/v1/emergencies/:id/match/:resourceId
// @access  Private
const updateMatchStatus = asyncHandler(async (req, res, next) => {
  const { action } = req.body;

  if (!action || !['accept', 'reject'].includes(action)) {
    return next(new ErrorResponse('Please provide a valid action', 400));
  }

  const emergency = await Emergency.findById(req.params.id);

  if (!emergency) {
    return next(
      new ErrorResponse(`Emergency not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is emergency owner, assigned volunteer, or admin
  if (
    emergency.user.toString() !== req.user.id &&
    (!emergency.assignedTo || emergency.assignedTo.toString() !== req.user.id) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update matches for this emergency`,
        401
      )
    );
  }

  // Find the matched resource
  const resourceMatch = emergency.matchedResources.find(
    match => match.resource.toString() === req.params.resourceId
  );

  if (!resourceMatch) {
    return next(
      new ErrorResponse(
        `Resource ${req.params.resourceId} is not matched with this emergency`,
        404
      )
    );
  }

  // Update the match status
  resourceMatch.status = action === 'accept' ? 'accepted' : 'rejected';
  await emergency.save();

  // If accepted, update the resource status as well
  if (action === 'accept') {
    const resource = await Resource.findById(req.params.resourceId);
    resource.status = 'reserved';
    resource.matchedEmergencies.push({
      emergency: emergency._id,
      status: 'accepted',
      matchScore: resourceMatch.matchScore
    });
    await resource.save();

    // Create notification for resource owner
    await Notification.create({
      type: 'match_accepted',
      title: 'Resource Match Accepted',
      message: `Your resource ${resource.name} has been accepted for emergency "${emergency.title}"`,
      user: resource.user,
      emergency: emergency._id,
      resource: resource._id
    });
  }

  res.status(200).json({
    success: true,
    data: emergency
  });
});

// @desc    Assign a volunteer to an emergency
// @route   PUT /api/v1/emergencies/:id/assign/:userId
// @access  Private/Admin
const assignVolunteer = asyncHandler(async (req, res, next) => {
  const emergency = await Emergency.findById(req.params.id);

  if (!emergency) {
    return next(
      new ErrorResponse(`Emergency not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user exists and is a volunteer
  const volunteer = await User.findById(req.params.userId);

  if (!volunteer) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.userId}`, 404)
    );
  }

  if (volunteer.role !== 'volunteer') {
    return next(
      new ErrorResponse(`User ${req.params.userId} is not a volunteer`, 400)
    );
  }

  // Assign volunteer
  emergency.assignedTo = volunteer._id;
  await emergency.save();

  // Create notification for volunteer
  await Notification.create({
    type: 'assignment',
    title: 'Emergency Assignment',
    message: `You have been assigned to emergency "${emergency.title}"`,
    user: volunteer._id,
    emergency: emergency._id,
    priority: emergency.urgency === 'critical' ? 'high' : 'normal'
  });

  res.status(200).json({
    success: true,
    data: emergency
  });
});

module.exports = {
  getEmergencies,
  getEmergency,
  createEmergency,
  updateEmergency,
  deleteEmergency,
  getEmergenciesInRadius,
  getMyEmergencies,
  matchResourcesForEmergency,
  updateMatchStatus,
  assignVolunteer,
  getNearbyEmergencies,
  updateResourceMatch
};