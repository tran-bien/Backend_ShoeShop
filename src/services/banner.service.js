const { Banner } = require("@models");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const ApiError = require("@utils/ApiError");

// Hàm hỗ trợ xử lý các case sắp xếp
const getSortOption = (sortParam) => {
  let sortOption = { displayOrder: 1 }; // Mặc định sắp xếp theo displayOrder
  if (sortParam) {
    switch (sortParam) {
      case "created_at_asc":
        sortOption = { createdAt: 1 };
        break;
      case "created_at_desc":
        sortOption = { createdAt: -1 };
        break;
      case "title_asc":
        sortOption = { title: 1 };
        break;
      case "title_desc":
        sortOption = { title: -1 };
        break;
      case "display_order_asc":
        sortOption = { displayOrder: 1 };
        break;
      case "display_order_desc":
        sortOption = { displayOrder: -1 };
        break;
      default:
        try {
          sortOption = JSON.parse(sortParam);
        } catch (err) {
          sortOption = { displayOrder: 1 };
        }
        break;
    }
  }
  return sortOption;
};

const bannerService = {
  /**
   * Lấy tất cả banner cho public (chỉ active và không bị xóa)
   */
  getPublicBanners: async () => {
    const banners = await Banner.find({
      isActive: true,
      deletedAt: null,
    })
      .sort({ displayOrder: 1 })
      .select("title image displayOrder link");

    return banners;
  },

  /**
   * Lấy tất cả banner cho admin (có phân trang và filter)
   */
  getAllBanners: async (options = {}) => {
    const {
      page = 1,
      limit = 10,
      sort = "display_order_asc",
      search = "",
      isActive,
      includeDeleted = false,
    } = options;

    // Build query conditions
    const queryConditions = {};

    // Search by title
    if (search) {
      queryConditions.title = { $regex: search, $options: "i" };
    }

    // Filter by active status
    if (isActive !== undefined) {
      queryConditions.isActive = isActive;
    }

    // Include/exclude deleted items
    if (!includeDeleted) {
      queryConditions.deletedAt = null;
    }

    const sortOption = getSortOption(sort);

    if (includeDeleted) {
      // Sử dụng paginateDeleted cho danh sách có item đã xóa
      return await paginateDeleted(
        Banner,
        queryConditions,
        { page, limit },
        sortOption
      );
    } else {
      // Sử dụng paginate thông thường
      return await paginate(
        Banner,
        queryConditions,
        { page, limit },
        sortOption
      );
    }
  },

  /**
   * Lấy banner theo ID
   */
  getBannerById: async (bannerId) => {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      throw new ApiError(404, `Không tìm thấy banner id: ${bannerId}`);
    }

    return banner;
  },

  /**
   * Tạo banner mới
   */
  createBanner: async (bannerData) => {
    // Kiểm tra số lượng banner hiện tại (tối đa 5 banners)
    const activeBannerCount = await Banner.countDocuments({
      deletedAt: null,
    });

    if (activeBannerCount >= 5) {
      throw new ApiError(
        400,
        "Hệ thống chỉ cho phép tối đa 5 banner. Vui lòng xóa banner cũ trước khi thêm mới."
      );
    }

    // Đảm bảo isActive mặc định là true nếu không được cung cấp
    if (bannerData.isActive === undefined) {
      bannerData.isActive = true;
    }

    // Kiểm tra displayOrder có hợp lệ không (1-5)
    if (bannerData.displayOrder < 1 || bannerData.displayOrder > 5) {
      throw new ApiError(400, "Vị trí hiển thị phải từ 1 đến 5");
    }

    // Kiểm tra xem vị trí đã được sử dụng chưa (nếu banner là active)
    if (bannerData.isActive) {
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
    }

    const banner = new Banner(bannerData);
    await banner.save();

    return {
      success: true,
      message: "Tạo banner thành công",
      banner,
    };
  },

  /**
   * Cập nhật banner
   */
  updateBanner: async (bannerId, updateData) => {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      throw new ApiError(404, `Không tìm thấy banner id: ${bannerId}`);
    }

    // Kiểm tra displayOrder nếu có thay đổi
    if (updateData.displayOrder !== undefined) {
      if (updateData.displayOrder < 1 || updateData.displayOrder > 4) {
        throw new ApiError(400, "Vị trí hiển thị phải từ 1 đến 4");
      }

      // Kiểm tra xung đột vị trí nếu banner active hoặc sẽ active
      const willBeActive =
        updateData.isActive !== undefined
          ? updateData.isActive
          : banner.isActive;

      if (willBeActive && updateData.displayOrder !== banner.displayOrder) {
        const existingBanner = await Banner.findOne({
          displayOrder: updateData.displayOrder,
          isActive: true,
          deletedAt: null,
          _id: { $ne: bannerId },
        });

        if (existingBanner) {
          throw new ApiError(
            409,
            `Vị trí ${updateData.displayOrder} đã được sử dụng`
          );
        }
      }
    }

    // Cập nhật các trường
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        banner[key] = updateData[key];
      }
    });

    await banner.save();

    return {
      success: true,
      message: `Cập nhật banner ${banner.title} thành công`,
      banner,
    };
  },

  /**
   * Xóa mềm banner
   */
  deleteBanner: async (bannerId, userId) => {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      throw new ApiError(404, `Không tìm thấy banner id: ${bannerId}`);
    }

    const displayOrder = banner.displayOrder;

    // Xóa mềm
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
      message: `Xóa banner ${banner.title} thành công`,
    };
  },

  /**
   * Khôi phục banner đã xóa
   */
  restoreBanner: async (bannerId, newDisplayOrder = null) => {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      throw new ApiError(404, `Không tìm thấy banner id: ${bannerId}`);
    }

    if (!banner.deletedAt) {
      throw new ApiError(400, "Banner này chưa bị xóa");
    }

    // Xác định vị trí mới
    let targetOrder = newDisplayOrder;
    if (!targetOrder) {
      // Tìm vị trí trống đầu tiên
      const occupiedOrders = await Banner.find({
        isActive: true,
        deletedAt: null,
      }).distinct("displayOrder");

      for (let i = 1; i <= 4; i++) {
        if (!occupiedOrders.includes(i)) {
          targetOrder = i;
          break;
        }
      }

      if (!targetOrder) {
        throw new ApiError(400, "Không còn vị trí trống để khôi phục banner");
      }
    }

    // Kiểm tra vị trí có bị trùng không
    const existingBanner = await Banner.findOne({
      displayOrder: targetOrder,
      isActive: true,
      deletedAt: null,
    });

    if (existingBanner) {
      throw new ApiError(409, `Vị trí ${targetOrder} đã được sử dụng`);
    }

    // Khôi phục banner
    banner.deletedAt = null;
    banner.deletedBy = null;
    banner.isActive = true;
    banner.displayOrder = targetOrder;

    await banner.save();

    return {
      success: true,
      message: `Khôi phục banner ${banner.title} thành công`,
      banner,
    };
  },

  /**
   * Toggle trạng thái active của banner
   */
  toggleBannerStatus: async (bannerId) => {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      throw new ApiError(404, `Không tìm thấy banner id: ${bannerId}`);
    }

    const newStatus = !banner.isActive;

    // Nếu đang bật active, kiểm tra xung đột vị trí
    if (newStatus) {
      const existingBanner = await Banner.findOne({
        displayOrder: banner.displayOrder,
        isActive: true,
        deletedAt: null,
        _id: { $ne: bannerId },
      });

      if (existingBanner) {
        throw new ApiError(
          409,
          `Vị trí ${banner.displayOrder} đã được sử dụng bởi banner khác`
        );
      }
    }

    banner.isActive = newStatus;
    await banner.save();

    return {
      success: true,
      message: `${newStatus ? "Kích hoạt" : "Vô hiệu hóa"} banner thành công`,
      banner,
    };
  },
};

module.exports = bannerService;
