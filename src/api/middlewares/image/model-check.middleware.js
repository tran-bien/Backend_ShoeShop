/**
 * Đảm bảo model type không phải là review
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
exports.ensureNotReviewModel = (req, res, next) => {
  if (req.params.modelType === "review") {
    return res.status(400).json({
      success: false,
      message:
        "Vui lòng sử dụng route /api/images/review/:reviewId cho ảnh review",
    });
  }
  next();
};

/**
 * Đảm bảo model type là product hoặc variant
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
exports.ensureProductOrVariantModel = (req, res, next) => {
  const validTypes = ["product", "variant"];
  if (!validTypes.includes(req.params.modelType)) {
    return res.status(400).json({
      success: false,
      message: "Model type phải là product hoặc variant",
    });
  }
  next();
};

/**
 * Thiết lập model type là review
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
exports.setReviewModelType = (req, res, next) => {
  req.params.modelType = "review";
  next();
};
