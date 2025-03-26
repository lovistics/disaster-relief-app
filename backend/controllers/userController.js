const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const config = require('config');

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private/Admin
const getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Create user
// @route   POST /api/v1/users
// @access  Private/Admin
const createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
});

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.id}`, 404)
    );
  }

  // Updated from remove() to deleteOne()
  await User.deleteOne({ _id: req.params.id });

  res.status(200).json({
    success: true,
    data: {}
  });
});


// @desc    Update user availability
// @route   PUT /api/v1/users/availability
// @access  Private/Volunteer
const updateAvailability = asyncHandler(async (req, res, next) => {
  const { status, note } = req.body;

  // Check if valid status
  if (!['available', 'unavailable', 'busy'].includes(status)) {
    return next(new ErrorResponse(`Status ${status} is not valid`, 400));
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      availability: {
        status,
        note: note || ''
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user skills
// @route   PUT /api/v1/users/skills
// @access  Private/Volunteer
const updateSkills = asyncHandler(async (req, res, next) => {
  const { skills } = req.body;

  // Validate skills array
  if (!skills || !Array.isArray(skills)) {
    return next(new ErrorResponse('Skills must be provided as an array', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { skills },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Get volunteers by location and skills
// @route   GET /api/v1/users/volunteers
// @access  Private
const getVolunteers = asyncHandler(async (req, res, next) => {
  const { lat, lng, distance = 10, skills } = req.query;

  // Check if location is provided
  if (!lat || !lng) {
    return next(
      new ErrorResponse('Please provide latitude and longitude', 400)
    );
  }

  // Calculate radius using radians
  // Divide distance by radius of Earth (6,378 km)
  const radius = distance / 6378;

  // Find volunteers
  const volunteers = await User.find({
    role: 'volunteer',
    'availability.status': 'available',
    location: {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius]
      }
    },
    ...(skills && { skills: { $in: skills.split(',') } })
  });

  res.status(200).json({
    success: true,
    count: volunteers.length,
    data: volunteers
  });
});

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateAvailability,
  updateSkills,
  getVolunteers
};