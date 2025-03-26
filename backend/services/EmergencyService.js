const Emergency = require('../models/Emergency');
const ErrorResponse = require('../utils/errorResponse');
const geocoder = require('../utils/geocoder');
const { matchResourcesToEmergency } = require('../utils/matchingAlgorithm');
const BaseService = require('./BaseService');

class EmergencyService extends BaseService {
  constructor() {
    super(Emergency);
  }

  async getEmergencies(query) {
    let emergencies = Emergency.find(query).populate('user', 'name email');
    return emergencies;
  }

  async getEmergency(id) {
    const emergency = await Emergency.findById(id).populate('user', 'name email');
    if (!emergency) {
      throw new ErrorResponse('Emergency not found', 404);
    }
    return emergency;
  }

  async createEmergency(emergencyData, userId) {
    // Handle address geocoding if address is provided
    if (emergencyData.address) {
      const location = await this._geocodeAddress(emergencyData.address);
      emergencyData.location = location;
    }

    emergencyData.user = userId;
    const emergency = await Emergency.create(emergencyData);

    // Find matching resources
    const matchedResources = await matchResourcesToEmergency(emergency);
    emergency.matchedResources = matchedResources;
    await emergency.save();

    return emergency;
  }

  async updateEmergency(id, updateData, userId) {
    // Check if user owns the emergency or is an admin
    const emergency = await this.getById(id);
    
    // Check if userId is a string (normal user ID) or an object (user object with role)
    if (typeof userId === 'string') {
      if (emergency.user.toString() !== userId) {
        throw new ErrorResponse('Not authorized to update this emergency', 403);
      }
    } else if (userId && userId.role !== 'admin') {
      if (emergency.user.toString() !== userId.id) {
        throw new ErrorResponse('Not authorized to update this emergency', 403);
      }
    }

    // Handle address geocoding if address is provided
    if (updateData.address) {
      const location = await this._geocodeAddress(updateData.address);
      updateData.location = location;
    }

    const updatedEmergency = await this.update(id, updateData);

    // Update matched resources if relevant fields changed
    if (updateData.resourcesNeeded || updateData.location) {
      const matchedResources = await matchResourcesToEmergency(updatedEmergency);
      updatedEmergency.matchedResources = matchedResources;
      await updatedEmergency.save();
    }

    return updatedEmergency;
  }

  async deleteEmergency(id) {
    const emergency = await Emergency.findById(id);
    if (!emergency) {
      throw new ErrorResponse('Emergency not found', 404);
    }

    await emergency.remove();
    return { success: true };
  }

  async getNearbyEmergencies(coords, distance) {
    // Earth's radius in kilometers
    const earthRadius = 6378.1;

    const emergencies = await Emergency.find({
      location: {
        $geoWithin: {
          $centerSphere: [coords, distance / earthRadius]
        }
      }
    }).populate('user', 'name email');

    return emergencies;
  }

  async updateEmergencyStatus(id, status) {
    const emergency = await this.update(id, { status });
    return emergency;
  }

  async updateResourceMatch(emergencyId, resourceId, status) {
    const emergency = await this.getById(emergencyId);
    
    // Find the resource match
    const matchIndex = emergency.matchedResources.findIndex(
      match => match.resource.toString() === resourceId
    );
    
    if (matchIndex === -1) {
      throw new ErrorResponse('Resource match not found', 404);
    }
    
    // Update the status
    emergency.matchedResources[matchIndex].status = status;
    await emergency.save();
    
    return emergency;
  }

  async getMyEmergencies(userId) {
    const emergencies = await Emergency.find({ user: userId }).populate('user', 'name email');
    return emergencies;
  }

  // Helper method (private by convention with underscore prefix)
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

module.exports = new EmergencyService(); 