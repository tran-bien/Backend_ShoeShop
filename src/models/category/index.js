const mongoose = require('mongoose');
const CategorySchema = require('./schema');
const { applyMiddlewares } = require('./middlewares');

// Áp dụng middlewares
applyMiddlewares(CategorySchema);

// Tạo model
const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;