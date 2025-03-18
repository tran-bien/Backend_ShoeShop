const cloudinary = require("@config/cloudinary");

const uploadFileOneOrMultiple = async (files, folder) => {
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
      publicId: result.public_id,
    }));
  } catch (error) {
    console.error("Error uploading multiple images:", error);
    throw new Error("Không thể tải ảnh lên. Vui lòng thử lại!");
  }
};

const deleteFileOneOrMultiple = async (publicIds) => {
  try {
    const deletePromises = publicIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId)
    );
    const results = await Promise.all(deletePromises);
    return results;
  } catch (error) {
    console.error("Error deleting images from Cloudinary:", error);
    throw new Error("Không thể xóa ảnh. Vui lòng thử lại!");
  }
};

module.exports = {
  uploadFileOneOrMultiple,
  deleteFileOneOrMultiple,
};
