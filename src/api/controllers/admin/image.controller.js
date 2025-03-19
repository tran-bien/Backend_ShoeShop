const asyncHandler = require("express-async-handler");
const imageService = require("@services/image.service");

/**
 * @desc    Upload ảnh đại diện cho một người dùng cụ thể (bởi admin)
 * @route   POST /api/admin/images/user/:userId/avatar
 * @access  Admin
 */
exports.uploadUserAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Không có file ảnh nào được tải lên",
    });
  }

  const { userId } = req.params;

  const avatarData = {
    url: req.file.path,
    public_id: req.file.filename,
  };

  const result = await imageService.updateUserAvatar(userId, avatarData);

  res.json(result);
});

/**
 * @desc    Xóa ảnh đại diện của một người dùng cụ thể (bởi admin)
 * @route   DELETE /api/admin/images/user/:userId/avatar
 * @access  Admin
 */
exports.removeUserAvatar = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const result = await imageService.removeUserAvatar(userId);

  res.json(result);
});

/**
 * @desc    Upload ảnh cho model (product, variant, brand)
 * @route   POST /api/admin/images/:modelType/:modelId
 * @access  Admin
 */
exports.uploadModelImages = asyncHandler(async (req, res) => {
  const { modelType, modelId } = req.params;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Không có file nào được tải lên",
    });
  }

  let results;
  let updateData;

  if (modelType === "brand") {
    // Brand chỉ cần một ảnh làm logo
    results = {
      url: req.files[0].path,
      public_id: req.files[0].filename,
    };
    updateData = results;
  } else {
    // Product và variant sử dụng mảng ảnh
    results = req.files.map((file, index) => ({
      url: file.path,
      public_id: file.filename,
      isMain: index === 0,
      displayOrder: index,
    }));
    updateData = results;
  }

  const updatedModel = await imageService.updateModelImages(
    modelType,
    modelId,
    updateData
  );

  res.json({
    success: true,
    message: `Cập nhật ảnh cho ${modelType} thành công`,
    data: updatedModel,
  });
});

/**
 * @desc    Xóa ảnh của model
 * @route   DELETE /api/admin/images/:modelType/:modelId
 * @access  Admin
 */
exports.removeModelImages = asyncHandler(async (req, res) => {
  const { modelType, modelId } = req.params;
  const { imageIds } = req.body;

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách ID ảnh cần xóa",
    });
  }

  const result = await imageService.removeImagesFromModel(
    modelType,
    modelId,
    imageIds
  );

  res.json(result);
});

/**
 * @desc    Thay đổi thứ tự ảnh
 * @route   PUT /api/admin/images/reorder/:modelType/:modelId
 * @access  Admin
 */
exports.reorderImages = asyncHandler(async (req, res) => {
  const { modelType, modelId } = req.params;
  const { imageOrders } = req.body;

  if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách thứ tự ảnh",
    });
  }

  const result = await imageService.reorderImages(
    modelType,
    modelId,
    imageOrders
  );

  res.json(result);
});

/**
 * @desc    Đặt ảnh chính
 * @route   PUT /api/admin/images/set-main/:modelType/:modelId
 * @access  Admin
 */
exports.setMainImage = asyncHandler(async (req, res) => {
  const { modelType, modelId } = req.params;
  const { imageId } = req.body;

  if (!imageId) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp ID ảnh cần đặt làm ảnh chính",
    });
  }

  const result = await imageService.setMainImage(modelType, modelId, imageId);

  res.json(result);
});

/**
 * @desc    Xóa ảnh trực tiếp từ Cloudinary
 * @route   DELETE /api/admin/images/cloudinary
 * @access  Admin
 */
exports.deleteFromCloudinary = asyncHandler(async (req, res) => {
  let publicIds = req.body.publicIds;

  if (!Array.isArray(publicIds)) {
    if (req.body.publicId) {
      publicIds = [req.body.publicId];
    } else {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ít nhất một publicId để xóa",
      });
    }
  }

  const results = await imageService.deleteImages(publicIds);

  res.json({
    success: true,
    message: "Xóa ảnh từ Cloudinary thành công",
    results,
  });
});
