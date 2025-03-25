const asyncHandler = require("express-async-handler");
const imageService = require("@services/image.service");

/**
 * @desc    Upload logo cho brand
 * @route   POST /api/admin/images/brand/:brandId/logo
 * @access  Admin
 */
exports.uploadBrandLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Không có file ảnh nào được tải lên",
    });
  }

  const { brandId } = req.params;

  const logoData = {
    url: req.file.path,
    public_id: req.file.filename,
  };

  const result = await imageService.updateBrandLogo(brandId, logoData);

  res.json(result);
});

/**
 * @desc    Xóa logo của brand
 * @route   DELETE /api/admin/images/brand/:brandId/logo
 * @access  Admin
 */
exports.removeBrandLogo = asyncHandler(async (req, res) => {
  const { brandId } = req.params;

  const result = await imageService.removeBrandLogo(brandId);

  res.json(result);
});

/**
 * @desc    Upload ảnh cho product
 * @route   POST /api/admin/images/product/:productId
 * @access  Admin
 */
exports.uploadProductImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Không có file ảnh nào được tải lên",
    });
  }

  const { productId } = req.params;

  const images = req.files.map((file, index) => ({
    url: file.path,
    public_id: file.filename,
    isMain: index === 0, // Ảnh đầu tiên sẽ là ảnh chính
    displayOrder: index,
  }));

  const result = await imageService.addProductImages(productId, images);

  res.json(result);
});

/**
 * @desc    Xóa ảnh của product
 * @route   DELETE /api/admin/images/product/:productId
 * @access  Admin
 */
exports.removeProductImages = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { imageIds } = req.body;

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách ID ảnh cần xóa",
    });
  }

  const result = await imageService.removeProductImages(productId, imageIds);

  res.json(result);
});

/**
 * @desc    Upload ảnh cho variant
 * @route   POST /api/admin/images/variant/:variantId
 * @access  Admin
 */
exports.uploadVariantImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Không có file ảnh nào được tải lên",
    });
  }

  const { variantId } = req.params;

  const images = req.files.map((file, index) => ({
    url: file.path,
    public_id: file.filename,
    isMain: index === 0, // Ảnh đầu tiên sẽ là ảnh chính
    displayOrder: index,
  }));

  const result = await imageService.addVariantImages(variantId, images);

  res.json(result);
});

/**
 * @desc    Xóa ảnh của variant
 * @route   DELETE /api/admin/images/variant/:variantId
 * @access  Admin
 */
exports.removeVariantImages = asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  const { imageIds } = req.body;

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách ID ảnh cần xóa",
    });
  }

  const result = await imageService.removeVariantImages(variantId, imageIds);

  res.json(result);
});

/**
 * @desc    Sắp xếp ảnh của product
 * @route   PUT /api/admin/images/product/:productId/reorder
 * @access  Admin
 */
exports.reorderProductImages = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { imageOrders } = req.body;

  if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách thứ tự ảnh",
    });
  }

  const result = await imageService.reorderProductImages(
    productId,
    imageOrders
  );

  res.json(result);
});

/**
 * @desc    Sắp xếp ảnh của variant
 * @route   PUT /api/admin/images/variant/:variantId/reorder
 * @access  Admin
 */
exports.reorderVariantImages = asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  const { imageOrders } = req.body;

  if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách thứ tự ảnh",
    });
  }

  const result = await imageService.reorderVariantImages(
    variantId,
    imageOrders
  );

  res.json(result);
});

/**
 * @desc    Đặt ảnh chính cho product
 * @route   PUT /api/admin/images/product/:productId/set-main
 * @access  Admin
 */
exports.setProductMainImage = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { imageId } = req.body;

  if (!imageId) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp ID ảnh cần đặt làm ảnh chính",
    });
  }

  const result = await imageService.setProductMainImage(productId, imageId);

  res.json(result);
});

/**
 * @desc    Đặt ảnh chính cho variant
 * @route   PUT /api/admin/images/variant/:variantId/set-main
 * @access  Admin
 */
exports.setVariantMainImage = asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  const { imageId } = req.body;

  if (!imageId) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp ID ảnh cần đặt làm ảnh chính",
    });
  }

  const result = await imageService.setVariantMainImage(variantId, imageId);

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
