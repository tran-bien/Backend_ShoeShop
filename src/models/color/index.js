const mongoose = require('mongoose');
const ColorSchema = require('./schema');
const { applyMiddlewares } = require('./middlewares');

// Áp dụng middlewares
applyMiddlewares(ColorSchema);

// Tạo model
const Color = mongoose.model('Color', ColorSchema);

module.exports = Color;