/**
 * Export các models để sử dụng trong toàn bộ ứng dụng
 * Sử dụng lazy loading để tránh circular dependency
 */
const path = require("path");

// Cache cho các models đã load
const modelCache = {};

// Hàm helper để lazy load các models khi cần
function getModel(modelName) {
  if (!modelCache[modelName]) {
    try {
      modelCache[modelName] = require(path.join(
        __dirname,
        modelName.toLowerCase()
      ));
    } catch (error) {
      console.error(`Error loading model ${modelName}:`, error);
      return null;
    }
  }
  return modelCache[modelName];
}

// Export một proxy thay vì trực tiếp export các models
module.exports = new Proxy(
  {},
  {
    get(target, prop) {
      return getModel(prop);
    },
  }
);
