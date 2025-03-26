const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

class BaseService {
  constructor(model) {
    this.model = model;
  }

  async getAll(query = {}, options = {}) {
    const {
      select,
      sort = '-createdAt',
      page = 1,
      limit = 10,
      populate
    } = options;

    const skip = (page - 1) * limit;
    
    let dbQuery = this.model.find(query);

    if (select) {
      dbQuery = dbQuery.select(select);
    }

    if (sort) {
      dbQuery = dbQuery.sort(sort);
    }

    if (populate) {
      dbQuery = dbQuery.populate(populate);
    }

    const [results, total] = await Promise.all([
      dbQuery.skip(skip).limit(limit),
      this.model.countDocuments(query)
    ]);

    return {
      data: results,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid ID format', 400);
    }

    const { populate } = options;
    let query = this.model.findById(id);

    if (populate) {
      query = query.populate(populate);
    }

    const doc = await query;

    if (!doc) {
      const modelName = this.model.modelName || 'Document';
      throw new AppError(`${modelName} not found`, 404);
    }

    return doc;
  }

  async create(data) {
    const doc = await this.model.create(data);
    return doc;
  }

  async update(id, data, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid ID format', 400);
    }

    const { new: returnNew = true, runValidators = true } = options;

    const doc = await this.model.findByIdAndUpdate(
      id,
      data,
      { new: returnNew, runValidators }
    );

    if (!doc) {
      const modelName = this.model.modelName || 'Document';
      throw new AppError(`${modelName} not found`, 404);
    }

    return doc;
  }

  async delete(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid ID format', 400);
    }

    const doc = await this.model.findByIdAndDelete(id);

    if (!doc) {
      const modelName = this.model.modelName || 'Document';
      throw new AppError(`${modelName} not found`, 404);
    }

    return doc;
  }

  async exists(query) {
    const count = await this.model.countDocuments(query);
    return count > 0;
  }
}

module.exports = BaseService; 