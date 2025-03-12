const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

dotenv.config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Tải ảnh lên Cloudinary
exports.uploadImage = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: folder,
      resource_type: "auto",
    });
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Không thể tải ảnh lên. Vui lòng thử lại!");
  }
};

// Xóa ảnh khỏi Cloudinary
exports.deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw new Error("Không thể xóa ảnh. Vui lòng thử lại!");
  }
};

// Tải nhiều ảnh lên Cloudinary
exports.uploadMultipleImages = async (files, folder) => {
  try {
    const uploadPromises = files.map((file) =>
      cloudinary.uploader.upload(file, {
        folder: folder,
        resource_type: "auto",
      })
    );

    const results = await Promise.all(uploadPromises);

    return results.map((result) => ({
      url: result.secure_url,
      public_id: result.public_id,
    }));
  } catch (error) {
    console.error("Error uploading multiple images to Cloudinary:", error);
    throw new Error("Không thể tải ảnh lên. Vui lòng thử lại!");
  }
};
