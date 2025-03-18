const mongoose = require('mongoose');
const BrandSchema = require('./schema');
const { applyMiddlewares } = require('./middlewares');

// Áp dụng middlewares
applyMiddlewares(BrandSchema);

// Tạo model
const Brand = mongoose.model('Brand', BrandSchema);

module.exports = Brand;