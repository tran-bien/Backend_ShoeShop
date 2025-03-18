const mongoose = require('mongoose');
const SizeSchema = require('./schema');
const { applyMiddlewares } = require('./middlewares');

// Áp dụng middlewares
applyMiddlewares(SizeSchema);

// Tạo model
const Size = mongoose.model('Size', SizeSchema);

module.exports = Size;