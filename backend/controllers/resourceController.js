const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('express-async-handler');
const Resource = require('../models/Resource');
const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { matchEmergenciesToResource } = require('../utils/matchingAlgorithm');
const geocoder = require('../utils/geocoder');
const { body } = require('express-validator');
const { validate, resourceValidationSchemas } = require('../middleware/validate');
const ResourceService = require('../services/ResourceService');

// Validation rules
const resourceValidation = resourceValidationSchemas.create;

// @desc    Get all resources
// @route   GET /api/v1/resources
// @access  Public
const getResources = asyncHandler(async (req, res) => {
  const { page, limit, sort, type, status } = req.query;
  
  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;

  const result = await ResourceService.getAll(query, {
    page,
    limit,
    sort,
    populate: { path: 'user', select: 'name email' }
  });

  res.json({
    success: true,
    ...result
  });
});

// @desc    Get nearby resources
// @route   GET /api/v1/resources/nearby
// @access  Public
const getNearbyResources = asyncHandler(async (req, res) => {
  const { lat, lng, distance = 10000, type } = req.query;

  if (!lat || !lng) {
    throw new AppError('Please provide latitude and longitude', 400);
  }

  const filters = {};
  if (type) filters.type = type;

  const resources = await ResourceService.getNearbyResources(
    [parseFloat(lng), parseFloat(lat)],
    parseFloat(distance),
    filters
  );

  res.json({
    success: true,
    count: resources.length,
    data: resources
  });
});

// @desc    Get single resource
// @route   GET /api/v1/resources/:id
// @access  Public
const getResource = asyncHandler(async (req, res) => {
  const resource = await ResourceService.getById(req.params.id, {
    populate: { path: 'user', select: 'name email' }
  });

  res.json({
    success: true,
    data: resource
  });
});

// @desc    Create new resource
// @route   POST /api/v1/resources
// @access  Private
const createResource = [
  validate(resourceValidation),
  asyncHandler(async (req, res) => {
    const resource = await ResourceService.createResource(req.body, req.user.id);

    res.status(201).json({
      success: true,
      data: resource
    });
  })
];

// @desc    Update resource
// @route   PUT /api/v1/resources/:id
// @access  Private
const updateResource = [
  validate([
    body('title').optional().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ min: 10, max: 500 }),
    body('type').optional().isIn(['water', 'food', 'medical', 'shelter', 'clothing', 'transport', 'volunteers', 'other']),
    body('quantity').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['available', 'reserved', 'deployed', 'unavailable'])
  ]),
  asyncHandler(async (req, res) => {
    const resource = await ResourceService.updateResource(
      req.params.id,
      req.body,
      req.user.id
    );

    res.json({
      success: true,
      data: resource
    });
  })
];

// @desc    Delete resource
// @route   DELETE /api/v1/resources/:id
// @access  Private
const deleteResource = asyncHandler(async (req, res) => {
  const resource = await ResourceService.getById(req.params.id);

  // Check if user owns the resource
  if (resource.user.toString() !== req.user.id) {
    throw new AppError('Not authorized to delete this resource', 403);
  }

  await ResourceService.delete(req.params.id);

  res.json({
    success: true,
    data: {}
  });
});

// @desc    Update resource status
// @route   PUT /api/v1/resources/:id/status
// @access  Private
const updateResourceStatus = [
  validate([
    body('status')
      .isIn(['available', 'reserved', 'deployed', 'unavailable'])
      .withMessage('Invalid status')
  ]),
  asyncHandler(async (req, res) => {
    const resource = await ResourceService.updateResourceStatus(
      req.params.id,
      req.body.status,
      req.user.id
    );

    res.json({
      success: true,
      data: resource
    });
  })
];

// @desc    Get resources within radius
// @route   GET /api/v1/resources/radius/:zipcode/:distance
// @access  Private
const getResourcesInRadius = asyncHandler(async (req, res, next) => {
  const { zipcode, distance } = req.params;

  // Get lat/lng from geocoder
  const loc = await geocoder.geocode(zipcode);
  const lat = loc[0].latitude;
  const lng = loc[0].longitude;

  // Calc radius using radians
  // Divide dist by radius of Earth
  // Earth Radius = 6,378 km
  const radius = distance / 6378;

  const resources = await Resource.find({
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
  });

  res.status(200).json({
    success: true,
    count: resources.length,
    data: resources
  });
});

// @desc    Get my resources
// @route   GET /api/v1/resources/my
// @access  Private
const getMyResources = asyncHandler(async (req, res, next) => {
  const resources = await Resource.find({ user: req.user.id });

  res.status(200).json({
    success: true,
    count: resources.length,
    data: resources
  });
});

// @desc    Match emergencies to a resource
// @route   GET /api/v1/resources/:id/match
// @access  Private
const matchEmergenciesForResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(
      new ErrorResponse(`Resource not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is resource owner, assigned volunteer, or admin
  if (
    resource.user.toString() !== req.user.id &&
    (!resource.assignedTo || resource.assignedTo.toString() !== req.user.id) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to match emergencies for this resource`,
        401
      )
    );
  }

  // Get active emergencies
  const activeEmergencies = await Emergency.find({ status: 'active' });

  // Match emergencies
  const matches = matchEmergenciesToResource(resource, activeEmergencies);

  // Update resource with matched emergencies
  resource.matchedEmergencies = matches.map(match => ({
    emergency: match.emergency,
    matchScore: match.matchScore,
    status: 'pending'
  }));

  await resource.save();

  res.status(200).json({
    success: true,
    count: matches.length,
    data: matches
  });
});

// @desc    Mark resource as delivered
// @route   PUT /api/v1/resources/:id/deliver/:emergencyId
// @access  Private
const markResourceDelivered = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(
      new ErrorResponse(`Resource not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is resource owner, assigned volunteer, or admin
  if (
    resource.user.toString() !== req.user.id &&
    (!resource.assignedTo || resource.assignedTo.toString() !== req.user.id) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this resource`,
        401
      )
    );
  }

  // Find matching emergency
  const emergencyMatch = resource.matchedEmergencies.find(
    match => match.emergency.toString() === req.params.emergencyId
  );

  if (!emergencyMatch || emergencyMatch.status !== 'accepted') {
    return next(
      new ErrorResponse(
        `Emergency ${req.params.emergencyId} is not matched or accepted with this resource`,
        404
      )
    );
  }

  // Update resource status
  resource.status = 'delivered';
  emergencyMatch.status = 'delivered';
  await resource.save();

  // Update emergency resource match as well
  const emergency = await Emergency.findById(req.params.emergencyId);
  const resourceMatch = emergency.matchedResources.find(
    match => match.resource.toString() === req.params.id
  );
  
  if (resourceMatch) {
    resourceMatch.status = 'delivered';
    
    // Check if this fulfills a needed resource
    const neededResourceIndex = emergency.resourcesNeeded.findIndex(
      need => need.type === resource.type && !need.fulfilled
    );
    
    if (neededResourceIndex >= 0) {
      emergency.resourcesNeeded[neededResourceIndex].fulfilled = true;
    }
    
    await emergency.save();
  }

  // Create notifications
  await Notification.create({
    type: 'resource_delivered',
    title: 'Resource Delivered',
    message: `Resource "${resource.name}" has been delivered to emergency "${emergency.title}"`,
    user: emergency.user,
    emergency: emergency._id,
    resource: resource._id
  });

  res.status(200).json({
    success: true,
    data: resource
  });
});

// @desc    Assign a volunteer to a resource
// @route   PUT /api/v1/resources/:id/assign/:userId
// @access  Private/Admin
const assignVolunteer = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(
      new ErrorResponse(`Resource not found with id of ${req.params.id}`, 404)
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
  resource.assignedTo = volunteer._id;
  await resource.save();

  // Create notification for volunteer
  await Notification.create({
    type: 'assignment',
    title: 'Resource Assignment',
    message: `You have been assigned to resource "${resource.name}"`,
    user: volunteer._id,
    resource: resource._id
  });

  res.status(200).json({
    success: true,
    data: resource
  });
});

module.exports = {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getResourcesInRadius,
  getMyResources,
  matchEmergenciesForResource,
  markResourceDelivered,
  assignVolunteer,
  getNearbyResources,
  updateResourceStatus
};