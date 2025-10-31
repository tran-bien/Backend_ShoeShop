const cloudinary = require("cloudinary").v2;
const { Product, Variant, Brand, User, Banner } = require("@models");
const SizeGuide = require("../models/sizeGuide");
const ApiError = require("@utils/ApiError");

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
    // Tìm user
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
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
    // Tìm user
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
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
    // Tìm brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new ApiError(404, "Không tìm thấy thương hiệu");
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
    // Tìm brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new ApiError(404, "Không tìm thấy thương hiệu");
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
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Tìm giá trị displayOrder lớn nhất trong mảng hiện tại
    let maxDisplayOrder = -1;
    if (product.images && product.images.length > 0) {
      maxDisplayOrder = Math.max(
        ...product.images.map((img) => img.displayOrder)
      );
    }

    // Cập nhật displayOrder cho các ảnh mới bắt đầu từ (maxDisplayOrder + 1)
    images.forEach((img, index) => {
      img.displayOrder = maxDisplayOrder + 1 + index;
    });

    // Nếu chưa có ảnh chính, đặt ảnh đầu tiên của ảnh mới làm ảnh chính
    const hasMainImage = product.images.some((img) => img.isMain);
    if (!hasMainImage && images.length > 0) {
      images[0].isMain = true;
    } else {
      // Đảm bảo các ảnh mới không được đánh dấu là ảnh chính nếu đã có ảnh chính
      images.forEach((img) => {
        img.isMain = false;
      });
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
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Lọc ra những ảnh cần xóa
    const imagesToDelete = product.images.filter((img) =>
      imageIds.includes(img._id.toString())
    );

    if (imagesToDelete.length === 0) {
      throw new ApiError(404, "Không tìm thấy ảnh cần xóa");
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

    // Đánh lại thứ tự hiển thị cho các ảnh còn lại
    product.images.sort((a, b) => a.displayOrder - b.displayOrder);
    product.images.forEach((img, index) => {
      img.displayOrder = index;
    });

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
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể");
    }

    // Tìm giá trị displayOrder lớn nhất trong mảng hiện tại
    let maxDisplayOrder = -1;
    if (variant.imagesvariant && variant.imagesvariant.length > 0) {
      maxDisplayOrder = Math.max(
        ...variant.imagesvariant.map((img) => img.displayOrder)
      );
    }

    // Cập nhật displayOrder cho các ảnh mới bắt đầu từ (maxDisplayOrder + 1)
    images.forEach((img, index) => {
      img.displayOrder = maxDisplayOrder + 1 + index;
    });

    // Kiểm tra nếu ảnh đầu tiên có isMain và không có ảnh chính nào trước đó
    const hasMainImage = variant.imagesvariant.some((img) => img.isMain);
    if (!hasMainImage && images.length > 0) {
      images[0].isMain = true;
    } else {
      // Đảm bảo các ảnh mới không được đánh dấu là ảnh chính nếu đã có ảnh chính
      images.forEach((img) => {
        img.isMain = false;
      });
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
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể");
    }

    // Lọc ra những ảnh cần xóa
    const imagesToDelete = variant.imagesvariant.filter((img) =>
      imageIds.includes(img._id.toString())
    );

    if (imagesToDelete.length === 0) {
      throw new ApiError(404, "Không tìm thấy ảnh cần xóa");
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

    // Đánh lại thứ tự hiển thị cho các ảnh còn lại
    variant.imagesvariant.sort((a, b) => a.displayOrder - b.displayOrder);
    variant.imagesvariant.forEach((img, index) => {
      img.displayOrder = index;
    });

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
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
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
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể");
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
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Bỏ đánh dấu ảnh chính cũ
    product.images.forEach((image) => {
      image.isMain = false;
    });

    // Đánh dấu ảnh mới làm ảnh chính
    const mainImage = product.images.id(imageId);
    if (!mainImage) {
      throw new ApiError(404, "Không tìm thấy ảnh cần đặt làm ảnh chính");
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
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể");
    }

    // Bỏ đánh dấu ảnh chính cũ
    variant.imagesvariant.forEach((image) => {
      image.isMain = false;
    });

    // Đánh dấu ảnh mới làm ảnh chính
    const mainImage = variant.imagesvariant.id(imageId);
    if (!mainImage) {
      throw new ApiError(404, "Không tìm thấy ảnh cần đặt làm ảnh chính");
    }

    mainImage.isMain = true;

    await variant.save();

    return {
      success: true,
      message: "Đã cập nhật ảnh chính biến thể",
      images: variant.imagesvariant,
    };
  },

  // ======================== BANNER IMAGE OPERATIONS ========================

  /**
   * Upload ảnh banner mới
   * @param {Object} imageData - Dữ liệu ảnh { url, public_id }
   * @param {Object} bannerData - Dữ liệu banner { title, displayOrder, link, isActive }
   * @returns {Promise<Object>} - Banner mới được tạo
   */
  uploadBannerImage: async (imageData, bannerData) => {
    const { Banner } = require("@models");

    // Kiểm tra displayOrder có hợp lệ không
    if (bannerData.displayOrder < 1 || bannerData.displayOrder > 5) {
      throw new ApiError(400, "Vị trí hiển thị phải từ 1 đến 5");
    }

    // Kiểm tra xem vị trí đã được sử dụng chưa
    const existingBanner = await Banner.findOne({
      displayOrder: bannerData.displayOrder,
      isActive: true,
      deletedAt: null,
    });

    if (existingBanner) {
      throw new ApiError(
        409,
        `Vị trí ${bannerData.displayOrder} đã được sử dụng`
      );
    }

    // Tạo banner mới
    const banner = new Banner({
      title: bannerData.title,
      image: {
        url: imageData.url,
        public_id: imageData.public_id,
      },
      displayOrder: bannerData.displayOrder,
      isActive: bannerData.isActive !== undefined ? bannerData.isActive : true,
      link: bannerData.link || "",
    });

    await banner.save();

    return {
      success: true,
      message: "Upload ảnh banner thành công",
      banner,
    };
  },

  /**
   * Cập nhật ảnh banner
   * @param {String} bannerId - ID banner
   * @param {Object} imageData - Dữ liệu ảnh mới { url, public_id }
   * @returns {Promise<Object>} - Banner đã cập nhật
   */
  updateBannerImage: async (bannerId, imageData) => {
    const { Banner } = require("@models");

    const banner = await Banner.findById(bannerId);
    if (!banner) {
      throw new ApiError(404, "Không tìm thấy banner");
    }

    // Xóa ảnh cũ từ Cloudinary
    if (banner.image && banner.image.public_id) {
      try {
        await cloudinary.uploader.destroy(banner.image.public_id);
      } catch (err) {
        console.error("Không thể xóa ảnh banner cũ:", err);
      }
    }

    // Cập nhật ảnh mới
    banner.image = {
      url: imageData.url,
      public_id: imageData.public_id,
    };

    await banner.save();

    return {
      success: true,
      message: "Cập nhật ảnh banner thành công",
      banner,
    };
  },

  /**
   * Xóa banner và ảnh của nó
   * @param {String} bannerId - ID banner
   * @param {String} userId - ID người xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  deleteBannerImage: async (bannerId, userId) => {
    const { Banner } = require("@models");

    const banner = await Banner.findById(bannerId);
    if (!banner) {
      throw new ApiError(404, "Không tìm thấy banner");
    }

    const displayOrder = banner.displayOrder;

    // Xóa ảnh từ Cloudinary
    if (banner.image && banner.image.public_id) {
      try {
        await cloudinary.uploader.destroy(banner.image.public_id);
      } catch (err) {
        console.error("Không thể xóa ảnh banner từ Cloudinary:", err);
      }
    }

    // Xóa mềm banner
    banner.deletedAt = new Date();
    banner.deletedBy = userId;
    banner.isActive = false;
    await banner.save();

    // Điều chỉnh displayOrder của các banner khác
    await Banner.updateMany(
      {
        displayOrder: { $gt: displayOrder },
        isActive: true,
        deletedAt: null,
      },
      { $inc: { displayOrder: -1 } }
    );

    return {
      success: true,
      message: "Xóa banner thành công",
    };
  },

  /**
   * Sắp xếp lại thứ tự banner
   * @param {Array} bannerOrders - Mảng { bannerId, newOrder }
   * @returns {Promise<Object>} - Kết quả sắp xếp
   */
  reorderBanners: async (bannerOrders) => {
    const { Banner } = require("@models");

    // Validate dữ liệu đầu vào
    if (!Array.isArray(bannerOrders) || bannerOrders.length === 0) {
      throw new ApiError(400, "Dữ liệu sắp xếp không hợp lệ");
    }

    // Kiểm tra tất cả orders phải từ 1-5 và không trùng lặp
    const orders = bannerOrders.map((item) => item.newOrder);
    const uniqueOrders = [...new Set(orders)];

    if (uniqueOrders.length !== bannerOrders.length) {
      throw new ApiError(400, "Vị trí hiển thị không được trùng lặp");
    }

    if (orders.some((order) => order < 1 || order > 5)) {
      throw new ApiError(400, "Vị trí hiển thị phải từ 1 đến 5");
    }

    // Cập nhật từng banner
    const updatePromises = bannerOrders.map(async ({ bannerId, newOrder }) => {
      const banner = await Banner.findById(bannerId);
      if (!banner) {
        throw new ApiError(404, `Không tìm thấy banner ${bannerId}`);
      }

      banner.displayOrder = newOrder;
      return await banner.save();
    });

    await Promise.all(updatePromises);

    return {
      success: true,
      message: "Sắp xếp banner thành công",
    };
  },

  /**
   * Cập nhật ảnh size chart cho size guide
   * @param {String} sizeGuideId - ID size guide
   * @param {Object} imageData - Dữ liệu ảnh mới { url, public_id }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateSizeChartImage: async (sizeGuideId, imageData) => {
    const sizeGuide = await SizeGuide.findById(sizeGuideId);
    if (!sizeGuide) {
      throw new ApiError(404, "Không tìm thấy size guide");
    }

    // Xóa ảnh cũ trên Cloudinary nếu có
    if (sizeGuide.sizeChart?.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(sizeGuide.sizeChart.image.public_id);
      } catch (err) {
        console.error("Không thể xóa ảnh size chart cũ:", err);
      }
    }

    // Cập nhật ảnh mới
    sizeGuide.sizeChart.image = {
      url: imageData.url,
      public_id: imageData.public_id,
    };

    await sizeGuide.save();

    return {
      success: true,
      message: "Cập nhật ảnh size chart thành công",
      sizeGuide,
    };
  },

  /**
   * Cập nhật ảnh measurement guide cho size guide
   * @param {String} sizeGuideId - ID size guide
   * @param {Object} imageData - Dữ liệu ảnh mới { url, public_id }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateMeasurementGuideImage: async (sizeGuideId, imageData) => {
    const sizeGuide = await SizeGuide.findById(sizeGuideId);
    if (!sizeGuide) {
      throw new ApiError(404, "Không tìm thấy size guide");
    }

    // Xóa ảnh cũ trên Cloudinary nếu có
    if (sizeGuide.measurementGuide?.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(
          sizeGuide.measurementGuide.image.public_id
        );
      } catch (err) {
        console.error("Không thể xóa ảnh measurement guide cũ:", err);
      }
    }

    // Cập nhật ảnh mới
    sizeGuide.measurementGuide.image = {
      url: imageData.url,
      public_id: imageData.public_id,
    };

    await sizeGuide.save();

    return {
      success: true,
      message: "Cập nhật ảnh hướng dẫn đo chân thành công",
      sizeGuide,
    };
  },

  // ======================== BLOG IMAGE OPERATIONS ========================

  /**
   * Cập nhật thumbnail cho blog post
   * @param {String} blogPostId - ID blog post
   * @param {Object} imageData - Dữ liệu ảnh { url, public_id }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateBlogThumbnail: async (blogPostId, imageData) => {
    const { BlogPost } = require("@models");

    const blogPost = await BlogPost.findById(blogPostId);
    if (!blogPost) {
      throw new ApiError(404, "Không tìm thấy blog post");
    }

    // Xóa thumbnail cũ trên Cloudinary nếu có
    if (blogPost.thumbnail?.public_id) {
      try {
        await cloudinary.uploader.destroy(blogPost.thumbnail.public_id);
      } catch (err) {
        console.error("Không thể xóa thumbnail cũ:", err);
      }
    }

    // Cập nhật thumbnail mới
    blogPost.thumbnail = {
      url: imageData.url,
      public_id: imageData.public_id,
    };

    await blogPost.save();

    return {
      success: true,
      message: "Cập nhật thumbnail blog thành công",
      blogPost,
    };
  },

  /**
   * Cập nhật featured image cho blog post
   * @param {String} blogPostId - ID blog post
   * @param {Object} imageData - Dữ liệu ảnh { url, public_id, caption, alt }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateBlogFeaturedImage: async (blogPostId, imageData) => {
    const { BlogPost } = require("@models");

    const blogPost = await BlogPost.findById(blogPostId);
    if (!blogPost) {
      throw new ApiError(404, "Không tìm thấy blog post");
    }

    // Xóa featured image cũ trên Cloudinary nếu có
    if (blogPost.featuredImage?.public_id) {
      try {
        await cloudinary.uploader.destroy(blogPost.featuredImage.public_id);
      } catch (err) {
        console.error("Không thể xóa featured image cũ:", err);
      }
    }

    // Cập nhật featured image mới
    blogPost.featuredImage = {
      url: imageData.url,
      public_id: imageData.public_id,
      caption: imageData.caption || "",
      alt: imageData.alt || "",
    };

    await blogPost.save();

    return {
      success: true,
      message: "Cập nhật featured image blog thành công",
      blogPost,
    };
  },

  /**
   * Thêm content image vào blog post
   * @param {String} blogPostId - ID blog post
   * @param {Object} imageData - Dữ liệu ảnh { url, public_id, caption, alt }
   * @param {Number} order - Thứ tự của image block
   * @returns {Promise<Object>} - Kết quả thêm ảnh
   */
  addBlogContentImage: async (blogPostId, imageData, order) => {
    const { BlogPost } = require("@models");

    const blogPost = await BlogPost.findById(blogPostId);
    if (!blogPost) {
      throw new ApiError(404, "Không tìm thấy blog post");
    }

    // Thêm image block vào contentBlocks
    const imageBlock = {
      type: "IMAGE",
      order: order || blogPost.contentBlocks.length,
      image: {
        url: imageData.url,
        public_id: imageData.public_id,
        caption: imageData.caption || "",
        alt: imageData.alt || "",
      },
    };

    blogPost.contentBlocks.push(imageBlock);

    // Sắp xếp lại theo order
    blogPost.contentBlocks.sort((a, b) => a.order - b.order);

    await blogPost.save();

    return {
      success: true,
      message: "Thêm content image thành công",
      blogPost,
    };
  },

  /**
   * Xóa content image từ blog post
   * @param {String} blogPostId - ID blog post
   * @param {String} blockId - ID của content block cần xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeBlogContentImage: async (blogPostId, blockId) => {
    const { BlogPost } = require("@models");

    const blogPost = await BlogPost.findById(blogPostId);
    if (!blogPost) {
      throw new ApiError(404, "Không tìm thấy blog post");
    }

    // Tìm image block cần xóa
    const imageBlock = blogPost.contentBlocks.id(blockId);
    if (!imageBlock || imageBlock.type !== "IMAGE") {
      throw new ApiError(404, "Không tìm thấy image block");
    }

    // Xóa ảnh từ Cloudinary
    if (imageBlock.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(imageBlock.image.public_id);
      } catch (err) {
        console.error("Không thể xóa content image từ Cloudinary:", err);
      }
    }

    // Xóa block khỏi mảng
    blogPost.contentBlocks.pull(blockId);

    await blogPost.save();

    return {
      success: true,
      message: "Xóa content image thành công",
      blogPost,
    };
  },
};

module.exports = imageService;
