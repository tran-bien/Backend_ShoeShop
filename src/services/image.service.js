const cloudinary = require("cloudinary").v2;
const { Product, Variant, Brand, User } = require("@models");
const mongoose = require("mongoose");

const imageService = {
  /**
   * Xóa một hoặc nhiều ảnh từ Cloudinary
   * @param {Array} publicIds - Mảng các public_id cần xóa
   * @returns {Promise<Array>} - Kết quả xóa
   */
  deleteImages: async (publicIds) => {
    if (!Array.isArray(publicIds)) {
      publicIds = [publicIds];
    }

    const deletePromises = publicIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId)
    );

    return await Promise.all(deletePromises);
  },

  /**
   * Cập nhật ảnh đại diện cho người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} avatarData - Dữ liệu ảnh đại diện mới { url, public_id }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateUserAvatar: async (userId, avatarData) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error("ID người dùng không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    // Tìm user
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("Không tìm thấy người dùng");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Nếu người dùng đã có ảnh đại diện, xóa ảnh cũ
    if (user.avatar && user.avatar.public_id) {
      try {
        await cloudinary.uploader.destroy(user.avatar.public_id);
      } catch (err) {
        console.error("Không thể xóa ảnh đại diện cũ:", err);
        // Không throw lỗi này vì vẫn muốn tiếp tục cập nhật ảnh mới
      }
    }

    // Cập nhật ảnh đại diện mới
    user.avatar = {
      url: avatarData.url,
      public_id: avatarData.public_id,
    };

    await user.save();

    return {
      success: true,
      message: "Cập nhật ảnh đại diện thành công",
      avatar: user.avatar,
    };
  },

  /**
   * Xóa ảnh đại diện người dùng
   * @param {String} userId - ID người dùng
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeUserAvatar: async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error("ID người dùng không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    // Tìm user
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("Không tìm thấy người dùng");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Nếu người dùng có ảnh đại diện, xóa nó
    if (user.avatar && user.avatar.public_id) {
      try {
        await cloudinary.uploader.destroy(user.avatar.public_id);
      } catch (err) {
        console.error("Không thể xóa ảnh đại diện:", err);
        // Không throw lỗi này vì vẫn muốn tiếp tục reset thông tin avatar
      }
    }

    // Reset thông tin avatar
    user.avatar = {
      url: "",
      public_id: "",
    };

    await user.save();

    return {
      success: true,
      message: "Đã xóa ảnh đại diện",
    };
  },

  /**
   * Cập nhật logo cho brand
   * @param {String} brandId - ID brand
   * @param {Object} logoData - Dữ liệu logo mới { url, public_id }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateBrandLogo: async (brandId, logoData) => {
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      const error = new Error("ID thương hiệu không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    // Tìm brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Nếu brand đã có logo, xóa logo cũ
    if (brand.logo && brand.logo.public_id) {
      try {
        await cloudinary.uploader.destroy(brand.logo.public_id);
      } catch (err) {
        console.error("Không thể xóa logo cũ:", err);
        // Không throw lỗi này vì vẫn muốn tiếp tục cập nhật logo mới
      }
    }

    // Cập nhật logo mới
    brand.logo = logoData;

    await brand.save();

    return {
      success: true,
      message: "Cập nhật logo thương hiệu thành công",
      logo: brand.logo,
    };
  },

  /**
   * Xóa logo của brand
   * @param {String} brandId - ID brand
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeBrandLogo: async (brandId) => {
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      const error = new Error("ID thương hiệu không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    // Tìm brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Nếu brand có logo, xóa nó
    if (brand.logo && brand.logo.public_id) {
      try {
        await cloudinary.uploader.destroy(brand.logo.public_id);
      } catch (err) {
        console.error("Không thể xóa logo:", err);
        // Không throw lỗi này vì vẫn muốn tiếp tục reset thông tin logo
      }
    }

    // Reset thông tin logo
    brand.logo = {
      url: "",
      public_id: "",
    };

    await brand.save();

    return {
      success: true,
      message: "Đã xóa logo thương hiệu",
    };
  },

  /**
   * Thêm ảnh cho product
   * @param {String} productId - ID sản phẩm
   * @param {Array} images - Mảng các đối tượng ảnh
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  addProductImages: async (productId, images) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error("ID sản phẩm không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error("Không tìm thấy sản phẩm");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Kiểm tra nếu ảnh đầu tiên có isMain và không có ảnh chính nào trước đó
    const hasMainImage = product.images.some((img) => img.isMain);
    if (!hasMainImage && images.length > 0) {
      images[0].isMain = true;
    }

    // Thêm ảnh mới vào mảng ảnh hiện có
    product.images.push(...images);

    await product.save();

    return {
      success: true,
      message: "Thêm ảnh sản phẩm thành công",
      images: product.images,
    };
  },

  /**
   * Xóa ảnh của product
   * @param {String} productId - ID sản phẩm
   * @param {Array} imageIds - Mảng ID ảnh cần xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeProductImages: async (productId, imageIds) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error("ID sản phẩm không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error("Không tìm thấy sản phẩm");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Lọc ra những ảnh cần xóa
    const imagesToDelete = product.images.filter((img) =>
      imageIds.includes(img._id.toString())
    );

    if (imagesToDelete.length === 0) {
      const error = new Error("Không tìm thấy ảnh cần xóa");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Lấy public_id để xóa trên Cloudinary
    const publicIds = imagesToDelete.map((img) => img.public_id);

    // Xóa ảnh trên Cloudinary
    await imageService.deleteImages(publicIds);

    // Xóa ảnh khỏi model
    product.images = product.images.filter(
      (img) => !imageIds.includes(img._id.toString())
    );

    // Kiểm tra nếu đã xóa ảnh chính, đặt ảnh đầu tiên còn lại làm ảnh chính
    if (
      product.images.length > 0 &&
      !product.images.some((img) => img.isMain)
    ) {
      product.images[0].isMain = true;
    }

    await product.save();

    return {
      success: true,
      message: "Xóa ảnh sản phẩm thành công",
      images: product.images,
    };
  },

  /**
   * Thêm ảnh cho variant
   * @param {String} variantId - ID biến thể
   * @param {Array} images - Mảng các đối tượng ảnh
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  addVariantImages: async (variantId, images) => {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      const error = new Error("ID biến thể không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      const error = new Error("Không tìm thấy biến thể");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Kiểm tra nếu ảnh đầu tiên có isMain và không có ảnh chính nào trước đó
    const hasMainImage = variant.imagesvariant.some((img) => img.isMain);
    if (!hasMainImage && images.length > 0) {
      images[0].isMain = true;
    }

    // Thêm ảnh mới vào mảng ảnh hiện có
    variant.imagesvariant.push(...images);

    await variant.save();

    return {
      success: true,
      message: "Thêm ảnh biến thể thành công",
      images: variant.imagesvariant,
    };
  },

  /**
   * Xóa ảnh của variant
   * @param {String} variantId - ID biến thể
   * @param {Array} imageIds - Mảng ID ảnh cần xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeVariantImages: async (variantId, imageIds) => {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      const error = new Error("ID biến thể không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      const error = new Error("Không tìm thấy biến thể");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Lọc ra những ảnh cần xóa
    const imagesToDelete = variant.imagesvariant.filter((img) =>
      imageIds.includes(img._id.toString())
    );

    if (imagesToDelete.length === 0) {
      const error = new Error("Không tìm thấy ảnh cần xóa");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Lấy public_id để xóa trên Cloudinary
    const publicIds = imagesToDelete.map((img) => img.public_id);

    // Xóa ảnh trên Cloudinary
    await imageService.deleteImages(publicIds);

    // Xóa ảnh khỏi model
    variant.imagesvariant = variant.imagesvariant.filter(
      (img) => !imageIds.includes(img._id.toString())
    );

    // Kiểm tra nếu đã xóa ảnh chính, đặt ảnh đầu tiên còn lại làm ảnh chính
    if (
      variant.imagesvariant.length > 0 &&
      !variant.imagesvariant.some((img) => img.isMain)
    ) {
      variant.imagesvariant[0].isMain = true;
    }

    await variant.save();

    return {
      success: true,
      message: "Xóa ảnh biến thể thành công",
      images: variant.imagesvariant,
    };
  },

  /**
   * Sắp xếp ảnh của product
   * @param {String} productId - ID sản phẩm
   * @param {Array} imageOrders - Mảng { _id, displayOrder }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  reorderProductImages: async (productId, imageOrders) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error("ID sản phẩm không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error("Không tìm thấy sản phẩm");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Cập nhật thứ tự
    imageOrders.forEach((order) => {
      const image = product.images.id(order._id);
      if (image) {
        image.displayOrder = order.displayOrder;
      }
    });

    // Sắp xếp lại mảng
    product.images.sort((a, b) => a.displayOrder - b.displayOrder);

    await product.save();

    return {
      success: true,
      message: "Cập nhật thứ tự ảnh sản phẩm thành công",
      images: product.images,
    };
  },

  /**
   * Sắp xếp ảnh của variant
   * @param {String} variantId - ID biến thể
   * @param {Array} imageOrders - Mảng { _id, displayOrder }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  reorderVariantImages: async (variantId, imageOrders) => {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      const error = new Error("ID biến thể không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      const error = new Error("Không tìm thấy biến thể");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Cập nhật thứ tự
    imageOrders.forEach((order) => {
      const image = variant.imagesvariant.id(order._id);
      if (image) {
        image.displayOrder = order.displayOrder;
      }
    });

    // Sắp xếp lại mảng
    variant.imagesvariant.sort((a, b) => a.displayOrder - b.displayOrder);

    await variant.save();

    return {
      success: true,
      message: "Cập nhật thứ tự ảnh biến thể thành công",
      images: variant.imagesvariant,
    };
  },

  /**
   * Đặt ảnh chính cho product
   * @param {String} productId - ID sản phẩm
   * @param {String} imageId - ID ảnh cần đặt làm ảnh chính
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  setProductMainImage: async (productId, imageId) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error("ID sản phẩm không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error("Không tìm thấy sản phẩm");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Bỏ đánh dấu ảnh chính cũ
    product.images.forEach((image) => {
      image.isMain = false;
    });

    // Đánh dấu ảnh mới làm ảnh chính
    const mainImage = product.images.id(imageId);
    if (!mainImage) {
      const error = new Error("Không tìm thấy ảnh cần đặt làm ảnh chính");
      error.statusCode = 404; // Not Found
      throw error;
    }

    mainImage.isMain = true;

    await product.save();

    return {
      success: true,
      message: "Đã cập nhật ảnh chính sản phẩm",
      images: product.images,
    };
  },

  /**
   * Đặt ảnh chính cho variant
   * @param {String} variantId - ID biến thể
   * @param {String} imageId - ID ảnh cần đặt làm ảnh chính
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  setVariantMainImage: async (variantId, imageId) => {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      const error = new Error("ID biến thể không hợp lệ");
      error.statusCode = 400; // Bad Request
      throw error;
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      const error = new Error("Không tìm thấy biến thể");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Bỏ đánh dấu ảnh chính cũ
    variant.imagesvariant.forEach((image) => {
      image.isMain = false;
    });

    // Đánh dấu ảnh mới làm ảnh chính
    const mainImage = variant.imagesvariant.id(imageId);
    if (!mainImage) {
      const error = new Error("Không tìm thấy ảnh cần đặt làm ảnh chính");
      error.statusCode = 404; // Not Found
      throw error;
    }

    mainImage.isMain = true;

    await variant.save();

    return {
      success: true,
      message: "Đã cập nhật ảnh chính biến thể",
      images: variant.imagesvariant,
    };
  },
};

module.exports = imageService;
