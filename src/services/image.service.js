const cloudinary = require("cloudinary").v2;
const { Product, Variant, Brand, Review, User } = require("@models");
const mongoose = require("mongoose");

const imageService = {
  /**
   * Xóa một hoặc nhiều ảnh từ Cloudinary
   * @param {Array} publicIds - Mảng các public_id cần xóa
   * @returns {Promise<Array>} - Kết quả xóa
   */
  deleteImages: async (publicIds) => {
    try {
      if (!Array.isArray(publicIds)) {
        publicIds = [publicIds];
      }

      const deletePromises = publicIds.map((publicId) =>
        cloudinary.uploader.destroy(publicId)
      );

      return await Promise.all(deletePromises);
    } catch (error) {
      console.error("Lỗi khi xóa ảnh từ Cloudinary:", error);
      throw new Error("Không thể xóa ảnh. Vui lòng thử lại!");
    }
  },

  /**
   * Cập nhật ảnh cho model cụ thể
   * @param {String} modelType - Loại model (product, variant, brand, review, user)
   * @param {String} modelId - ID của model
   * @param {Object} data - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateModelImages: async (modelType, modelId, data) => {
    try {
      // Kiểm tra ID hợp lệ
      if (!mongoose.Types.ObjectId.isValid(modelId)) {
        throw new Error("ID không hợp lệ");
      }

      let model;
      let updatePath;
      let updateData = {};

      switch (modelType) {
        case "product":
          model = Product;
          updatePath = "images";
          break;
        case "variant":
          model = Variant;
          updatePath = "imagesvariant";
          break;
        case "brand":
          model = Brand;
          updatePath = "logo";
          break;
        case "review":
          model = Review;
          updatePath = "images";
          break;
        case "user":
          model = User;
          updatePath = "avatar";
          break;
        default:
          throw new Error("Loại model không hợp lệ");
      }

      // Xử lý cập nhật khác nhau tùy loại model
      if (modelType === "brand" || modelType === "user") {
        // Brand và User chỉ có một ảnh
        updateData[updatePath] = data;
      } else {
        // Các model khác có mảng ảnh
        updateData[updatePath] = data;
      }

      const updatedDoc = await model.findByIdAndUpdate(modelId, updateData, {
        new: true,
      });

      if (!updatedDoc) {
        throw new Error(`Không tìm thấy ${modelType} với ID: ${modelId}`);
      }

      return updatedDoc;
    } catch (error) {
      console.error(`Lỗi khi cập nhật ảnh cho ${modelType}:`, error);
      throw error;
    }
  },

  /**
   * Cập nhật ảnh đại diện cho người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} avatarData - Dữ liệu ảnh đại diện mới { url, public_id }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  updateUserAvatar: async (userId, avatarData) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("ID người dùng không hợp lệ");
      }

      // Tìm user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Nếu người dùng đã có ảnh đại diện, xóa ảnh cũ
      if (user.avatar && user.avatar.public_id) {
        try {
          await cloudinary.uploader.destroy(user.avatar.public_id);
        } catch (err) {
          console.error("Không thể xóa ảnh đại diện cũ:", err);
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
    } catch (error) {
      console.error("Lỗi cập nhật ảnh đại diện:", error);
      throw error;
    }
  },

  /**
   * Xóa ảnh đại diện người dùng
   * @param {String} userId - ID người dùng
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeUserAvatar: async (userId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("ID người dùng không hợp lệ");
      }

      // Tìm user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Nếu người dùng có ảnh đại diện, xóa nó
      if (user.avatar && user.avatar.public_id) {
        try {
          await cloudinary.uploader.destroy(user.avatar.public_id);
        } catch (err) {
          console.error("Không thể xóa ảnh đại diện:", err);
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
    } catch (error) {
      console.error("Lỗi xóa ảnh đại diện:", error);
      throw error;
    }
  },

  /**
   * Xóa ảnh khỏi model và Cloudinary
   * @param {String} modelType - Loại model
   * @param {String} modelId - ID của model
   * @param {Array} imageIds - ID của các ảnh trong MongoDB cần xóa (không phải public_id)
   * @returns {Promise<Object>} - Kết quả xóa
   */
  removeImagesFromModel: async (modelType, modelId, imageIds) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(modelId)) {
        throw new Error("ID không hợp lệ");
      }

      let model;
      let imagesPath;

      switch (modelType) {
        case "product":
          model = Product;
          imagesPath = "images";
          break;
        case "variant":
          model = Variant;
          imagesPath = "imagesvariant";
          break;
        case "review":
          model = Review;
          imagesPath = "images";
          break;
        case "brand":
          throw new Error(
            "Không thể xóa từng ảnh của Brand, chỉ có thể cập nhật logo"
          );
        case "user":
          throw new Error(
            "Không thể xóa từng ảnh của User, chỉ có thể cập nhật hoặc xóa avatar"
          );
        default:
          throw new Error("Loại model không hợp lệ");
      }

      // Tìm document
      const doc = await model.findById(modelId);
      if (!doc) {
        throw new Error(`Không tìm thấy ${modelType} với ID: ${modelId}`);
      }

      // Lọc ra những ảnh cần xóa
      const imagesToDelete = doc[imagesPath].filter((img) =>
        imageIds.includes(img._id.toString())
      );

      if (imagesToDelete.length === 0) {
        throw new Error("Không tìm thấy ảnh cần xóa");
      }

      // Lấy public_id để xóa trên Cloudinary
      const publicIds = imagesToDelete.map((img) => img.public_id);

      // Xóa ảnh trên Cloudinary
      await imageService.deleteImages(publicIds);

      // Xóa ảnh khỏi model
      doc[imagesPath] = doc[imagesPath].filter(
        (img) => !imageIds.includes(img._id.toString())
      );

      // Nếu là Product hoặc Variant và không còn ảnh nào là ảnh chính
      if (
        (modelType === "product" || modelType === "variant") &&
        doc[imagesPath].length > 0 &&
        !doc[imagesPath].some((img) => img.isMain)
      ) {
        doc[imagesPath][0].isMain = true;
      }

      // Lưu thay đổi
      await doc.save();

      return {
        success: true,
        message: "Xóa ảnh thành công",
        [imagesPath]: doc[imagesPath],
      };
    } catch (error) {
      console.error(`Lỗi khi xóa ảnh khỏi ${modelType}:`, error);
      throw error;
    }
  },

  /**
   * Thay đổi thứ tự ảnh
   * @param {String} modelType - Loại model
   * @param {String} modelId - ID của model
   * @param {Array} imageOrders - Mảng { _id, displayOrder }
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  reorderImages: async (modelType, modelId, imageOrders) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(modelId)) {
        throw new Error("ID không hợp lệ");
      }

      if (modelType !== "product" && modelType !== "variant") {
        throw new Error("Chỉ hỗ trợ sắp xếp ảnh cho Product và Variant");
      }

      const model = modelType === "product" ? Product : Variant;
      const imagesPath = modelType === "product" ? "images" : "imagesvariant";

      // Tìm document
      const doc = await model.findById(modelId);
      if (!doc) {
        throw new Error(`Không tìm thấy ${modelType} với ID: ${modelId}`);
      }

      // Cập nhật thứ tự
      imageOrders.forEach((order) => {
        const image = doc[imagesPath].id(order._id);
        if (image) {
          image.displayOrder = order.displayOrder;
        }
      });

      // Sắp xếp lại mảng
      doc[imagesPath].sort((a, b) => a.displayOrder - b.displayOrder);

      await doc.save();

      return {
        success: true,
        message: "Cập nhật thứ tự ảnh thành công",
        [imagesPath]: doc[imagesPath],
      };
    } catch (error) {
      console.error(`Lỗi khi sắp xếp ảnh cho ${modelType}:`, error);
      throw error;
    }
  },

  /**
   * Đặt ảnh chính
   * @param {String} modelType - Loại model
   * @param {String} modelId - ID của model
   * @param {String} imageId - ID của ảnh sẽ đặt làm ảnh chính
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  setMainImage: async (modelType, modelId, imageId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(modelId)) {
        throw new Error("ID không hợp lệ");
      }

      if (modelType !== "product" && modelType !== "variant") {
        throw new Error("Chỉ hỗ trợ đặt ảnh chính cho Product và Variant");
      }

      const model = modelType === "product" ? Product : Variant;
      const imagesPath = modelType === "product" ? "images" : "imagesvariant";

      // Tìm document
      const doc = await model.findById(modelId);
      if (!doc) {
        throw new Error(`Không tìm thấy ${modelType} với ID: ${modelId}`);
      }

      // Bỏ đánh dấu ảnh chính cũ
      doc[imagesPath].forEach((image) => {
        image.isMain = false;
      });

      // Đánh dấu ảnh mới làm ảnh chính
      const mainImage = doc[imagesPath].id(imageId);
      if (!mainImage) {
        throw new Error("Không tìm thấy ảnh cần đặt làm ảnh chính");
      }

      mainImage.isMain = true;

      await doc.save();

      return {
        success: true,
        message: "Đã cập nhật ảnh chính",
        [imagesPath]: doc[imagesPath],
      };
    } catch (error) {
      console.error(`Lỗi khi đặt ảnh chính cho ${modelType}:`, error);
      throw error;
    }
  },
};

module.exports = imageService;
