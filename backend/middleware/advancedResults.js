const advancedResults = (model, populate) => async (req, res, next) => {
    let query;
  
    // Copy req.query
    const reqQuery = { ...req.query };
  
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit', 'radius', 'lng', 'lat'];
  
    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);
  
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
  
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
  
    // Parse the query string
    let parsedQuery = JSON.parse(queryStr);
  
    // Handle geospatial queries
    if (req.query.lng && req.query.lat) {
      const radius = parseFloat(req.query.radius) || 10; // Default 10km radius
      
      // Convert radius from km to meters (required by MongoDB)
      const radiusInMeters = radius * 1000;
  
      parsedQuery.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
          },
          $maxDistance: radiusInMeters
        }
      };
    }
  
    // Handle notification filtering
    if (model.collection.collectionName === 'notifications') {
      // Filter by read status if specified
      if (req.query.read !== undefined) {
        parsedQuery.read = req.query.read === 'true';
      }
  
      // Filter by notification type if specified
      if (req.query.type) {
        parsedQuery.type = req.query.type;
      }
  
      // Filter by priority if specified
      if (req.query.priority) {
        parsedQuery.priority = req.query.priority;
      }
  
      // Filter by date range if specified
      if (req.query.startDate || req.query.endDate) {
        parsedQuery.createdAt = {};
        if (req.query.startDate) {
          parsedQuery.createdAt.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
          parsedQuery.createdAt.$lte = new Date(req.query.endDate);
        }
      }
    }
  
    // Handle resource filtering
    if (model.collection.collectionName === 'resources') {
      // Filter by availability status
      if (req.query.available === 'true') {
        parsedQuery.status = 'available';
      }
  
      // Filter by delivery capability
      if (req.query.canDeliver === 'true') {
        parsedQuery['deliveryCapability.canDeliver'] = true;
      }
  
      // Filter by quantity range
      if (req.query.minQuantity || req.query.maxQuantity) {
        parsedQuery.quantity = {};
        if (req.query.minQuantity) {
          parsedQuery.quantity.$gte = parseFloat(req.query.minQuantity);
        }
        if (req.query.maxQuantity) {
          parsedQuery.quantity.$lte = parseFloat(req.query.maxQuantity);
        }
      }
    }
  
    // Finding resource
    query = model.find(parsedQuery);
  
    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }
  
    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }
  
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await model.countDocuments(parsedQuery);
  
    query = query.skip(startIndex).limit(limit);
  
    // Handle population
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(pop => {
          query = query.populate(pop);
        });
      } else {
        query = query.populate(populate);
      }
    }
  
    // Executing query
    const results = await query;
  
    // Pagination result
    const pagination = {};
  
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
  
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
  
    // Add metadata
    const metadata = {
      total,
      count: results.length,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  
    res.advancedResults = {
      success: true,
      metadata,
      pagination,
      data: results
    };
  
    next();
  };
  
  module.exports = advancedResults;