const BaseService = require('./BaseService');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ErrorResponse = require('../utils/errorResponse');
const geocoder = require('../utils/geocoder');

class UserService extends BaseService {
  constructor() {
    super(User);
  }

  async register(userData) {
    const user = await User.create(userData);
    return this._generateTokenResponse(user);
  }

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new ErrorResponse('Invalid credentials', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new ErrorResponse('Invalid credentials', 401);
    }

    return this._generateTokenResponse(user);
  }

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorResponse('User not found', 404);
    }
    return user;
  }

  async updateDetails(userId, updateData) {
    // Handle address geocoding if address is provided
    if (updateData.address) {
      const location = await this._geocodeAddress(updateData.address);
      updateData.location = location;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      throw new ErrorResponse('User not found', 404);
    }

    return user;
  }

  async updatePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new ErrorResponse('User not found', 404);
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      throw new ErrorResponse('Password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    return this._generateTokenResponse(user);
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });

    if (!user) {
      throw new ErrorResponse('User not found', 404);
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    return resetToken;
  }

  async resetPassword(resetToken, password) {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      throw new ErrorResponse('Invalid token', 400);
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return this._generateTokenResponse(user);
  }

  async getVolunteers(query = {}) {
    return this.getAll({ ...query, role: 'volunteer' });
  }

  _generateTokenResponse(user) {
    const token = user.getSignedJwtToken();

    return {
      success: true,
      token,
      data: user
    };
  }

  async _geocodeAddress(address) {
    try {
      const loc = await geocoder.geocode(address);
      return {
        type: 'Point',
        coordinates: [loc[0].longitude, loc[0].latitude],
        formattedAddress: loc[0].formattedAddress,
        street: loc[0].streetName,
        city: loc[0].city,
        state: loc[0].stateCode,
        zipcode: loc[0].zipcode,
        country: loc[0].countryCode
      };
    } catch (err) {
      throw new ErrorResponse('Geocoding failed', 400);
    }
  }
}

module.exports = new UserService(); 