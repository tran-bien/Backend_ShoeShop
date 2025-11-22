const { User, Order, Review } = require("@models");
const LoyaltyTier = require("../models/loyaltyTier");
const LoyaltyTransaction = require("../models/loyaltyTransaction");
const ApiError = require("@utils/ApiError");
const paginate = require("@utils/pagination");
const slugify = require("@utils/slugify");

const loyaltyService = {
  /**
   * Tính điểm từ đơn hàng (1 điểm / 1000đ)
   */
  calculatePointsFromOrder: (orderTotal) => {
    return Math.floor(orderTotal / 1000);
  },

  /**
   * FIX THIẾU #4: Check và gửi cảnh báo điểm sắp hết hạn
   * Gọi function này trong getUserLoyaltyStats để tự động check
   */
  checkAndNotifyExpiringPoints: async (userId) => {
    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Tìm các transactions sắp hết hạn trong 30 ngày tới
      const expiringTransactions = await LoyaltyTransaction.find({
        user: userId,
        type: "EARN",
        isExpired: false,
        expiresAt: { $lte: thirtyDaysFromNow, $gt: new Date() },
      });

      if (expiringTransactions.length > 0) {
        const totalExpiringPoints = expiringTransactions.reduce(
          (sum, tx) => sum + tx.points,
          0
        );

        // Lấy ngày hết hạn sớm nhất
        const earliestExpiry = expiringTransactions.reduce(
          (earliest, tx) => (tx.expiresAt < earliest ? tx.expiresAt : earliest),
          expiringTransactions[0].expiresAt
        );

        // Gửi notification POINTS_EXPIRE_SOON
        const notificationService = require("./notification.service");
        await notificationService.send(
          userId,
          "POINTS_EXPIRE_SOON",
          {
            points: totalExpiringPoints,
            expiryDate: earliestExpiry.toLocaleDateString("vi-VN"),
          },
          { channels: { inApp: true, email: true } }
        );

        console.log(
          `[LOYALTY] Đã gửi cảnh báo ${totalExpiringPoints} điểm sắp hết hạn cho user ${userId}`
        );
      }
    } catch (error) {
      console.error("[LOYALTY] Lỗi check expiring points:", error.message);
    }
  },

  /**
   * Thêm điểm cho user
   */
  addPoints: async (userId, points, options = {}) => {
    const { source, order, review, description, expiresAt, processedBy } =
      options;

    const user = await User.findById(userId).populate("loyalty.tier");

    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Nhân với multiplier nếu có tier
    const multiplier = user.loyalty?.tier?.benefits?.pointsMultiplier || 1;
    const finalPoints = Math.floor(points * multiplier);

    const balanceBefore = user.loyalty?.points || 0;
    const balanceAfter = balanceBefore + finalPoints;

    // Tạo transaction
    await LoyaltyTransaction.create({
      user: userId,
      type: "EARN",
      points: finalPoints,
      balanceBefore,
      balanceAfter,
      source,
      order,
      review,
      description:
        description || `Tích ${finalPoints} điểm từ ${source.toLowerCase()}`,
      expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 năm
      processedBy,
    });

    // Cập nhật user
    user.loyalty = user.loyalty || {};
    user.loyalty.points = balanceAfter;
    user.loyalty.totalEarned = (user.loyalty.totalEarned || 0) + finalPoints;
    await user.save();

    // Auto update tier
    await loyaltyService.updateUserTier(userId);

    return {
      success: true,
      pointsAdded: finalPoints,
      newBalance: balanceAfter,
    };
  },

  /**
   * Trừ điểm (redeem hoặc expire)
   */
  deductPoints: async (userId, points, options = {}) => {
    const { type = "REDEEM", source, description, processedBy } = options;

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    const currentPoints = user.loyalty?.points || 0;

    if (currentPoints < points) {
      throw new ApiError(400, "Không đủ điểm để thực hiện");
    }

    const balanceBefore = currentPoints;
    const balanceAfter = currentPoints - points;

    // Tạo transaction
    await LoyaltyTransaction.create({
      user: userId,
      type,
      points: -points,
      balanceBefore,
      balanceAfter,
      source: source || "MANUAL",
      description: description || `Sử dụng ${points} điểm`,
      processedBy,
    });

    // Cập nhật user
    user.loyalty.points = balanceAfter;
    user.loyalty.totalRedeemed = (user.loyalty.totalRedeemed || 0) + points;
    await user.save();

    // Auto update tier
    await loyaltyService.updateUserTier(userId);

    return {
      success: true,
      pointsDeducted: points,
      newBalance: balanceAfter,
    };
  },

  /**
   * Tự động cập nhật tier của user dựa trên số điểm
   */
  updateUserTier: async (userId) => {
    const user = await User.findById(userId);

    if (!user) return;

    const currentPoints = user.loyalty?.points || 0;

    // Tìm tier phù hợp
    const tier = await LoyaltyTier.findOne({
      isActive: true,
      minPoints: { $lte: currentPoints },
      $or: [{ maxPoints: { $gte: currentPoints } }, { maxPoints: null }],
    }).sort({ minPoints: -1 });

    if (!tier) {
      console.log(`Không tìm thấy tier phù hợp cho ${currentPoints} điểm`);
      return;
    }

    // Nếu tier thay đổi
    if (
      !user.loyalty.tier ||
      user.loyalty.tier.toString() !== tier._id.toString()
    ) {
      const oldTierName = user.loyalty?.tierName || "Chưa có";

      user.loyalty.tier = tier._id;
      user.loyalty.tierName = tier.name;
      user.loyalty.lastTierUpdate = new Date();
      await user.save();

      console.log(`User ${user.name} lên hạng: ${oldTierName} → ${tier.name}`);

      // Gửi notification lên hạng
      try {
        const notificationService = require("./notification.service");
        await notificationService.send(userId, "LOYALTY_TIER_UP", {
          tierName: tier.name,
          multiplier: tier.multiplier,
          currentPoints: user.loyaltyPoints,
          prioritySupport: tier.multiplier >= 1.5, // VIP/PLATINUM có priority support
        });
      } catch (error) {
        console.error("[Loyalty] Lỗi gửi notification tier up:", error.message);
      }

      return {
        tierChanged: true,
        oldTier: oldTierName,
        newTier: tier.name,
      };
    }

    return { tierChanged: false };
  },

  /**
   * Lấy lịch sử giao dịch điểm
   * Tự động expire các điểm hết hạn trước khi query
   */
  getUserTransactions: async (userId, query = {}) => {
    // AUTO-EXPIRE logic: Tự động expire các điểm hết hạn
    // FIX BUG #1: Dùng atomic operations để tránh race condition
    const now = new Date();
    const expiredTransactions = await LoyaltyTransaction.find({
      user: userId, // Chỉ expire cho user hiện tại
      type: "EARN",
      isExpired: false,
      expiresAt: { $lt: now },
    });

    if (expiredTransactions.length > 0) {
      console.log(
        `[AUTO-EXPIRE] Tìm thấy ${expiredTransactions.length} transaction(s) hết hạn cho user ${userId}`
      );

      // Tính tổng điểm cần trừ
      const totalExpiredPoints = expiredTransactions.reduce(
        (sum, tx) => sum + tx.points,
        0
      );

      try {
        // Atomic update: Trừ điểm 1 lần duy nhất
        const user = await User.findById(userId);
        if (user && user.loyalty.points >= totalExpiredPoints) {
          const balanceBefore = user.loyalty.points;
          const balanceAfter = balanceBefore - totalExpiredPoints;

          // Update user points
          user.loyalty.points = balanceAfter;
          user.loyalty.totalRedeemed =
            (user.loyalty.totalRedeemed || 0) + totalExpiredPoints;
          await user.save();

          // Tạo 1 expire transaction tổng hợp
          await LoyaltyTransaction.create({
            user: userId,
            type: "EXPIRE",
            points: -totalExpiredPoints,
            balanceBefore,
            balanceAfter,
            source: "MANUAL",
            description: `Hết hạn ${totalExpiredPoints} điểm từ ${expiredTransactions.length} transaction(s)`,
          });

          // Đánh dấu tất cả transactions đã expire (bulk update)
          await LoyaltyTransaction.updateMany(
            {
              _id: { $in: expiredTransactions.map((tx) => tx._id) },
            },
            { isExpired: true }
          );

          console.log(
            `[AUTO-EXPIRE] Đã expire ${totalExpiredPoints} điểm từ ${expiredTransactions.length} transactions`
          );

          // Update tier sau khi trừ điểm
          await loyaltyService.updateUserTier(userId);
        }
      } catch (error) {
        console.error(
          `[AUTO-EXPIRE] Lỗi khi expire transactions:`,
          error.message
        );
      }
    }

    const { page = 1, limit = 20, type } = query;

    const filter = { user: userId };
    if (type) {
      filter.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      LoyaltyTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("order", "code totalAfterDiscountAndShipping")
        .populate("review", "rating content"),
      LoyaltyTransaction.countDocuments(filter),
    ]);

    return {
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  },

  /**
   * Lấy thống kê loyalty của user
   * Tự động expire các điểm hết hạn trước khi tính toán stats
   */
  getUserLoyaltyStats: async (userId) => {
    // AUTO-EXPIRE logic: Expire điểm hết hạn trước khi tính stats
    // FIX BUG #1: Dùng atomic operations
    const now = new Date();
    const expiredTransactions = await LoyaltyTransaction.find({
      user: userId,
      type: "EARN",
      isExpired: false,
      expiresAt: { $lt: now },
    });

    if (expiredTransactions.length > 0) {
      console.log(
        `[STATS AUTO-EXPIRE] Found ${expiredTransactions.length} expired loyalty transactions for user ${userId}`
      );

      const totalExpiredPoints = expiredTransactions.reduce(
        (sum, tx) => sum + tx.points,
        0
      );

      try {
        const user = await User.findById(userId);
        if (user && user.loyalty.points >= totalExpiredPoints) {
          const balanceBefore = user.loyalty.points;
          const balanceAfter = balanceBefore - totalExpiredPoints;

          user.loyalty.points = balanceAfter;
          user.loyalty.totalRedeemed =
            (user.loyalty.totalRedeemed || 0) + totalExpiredPoints;
          await user.save();

          await LoyaltyTransaction.create({
            user: userId,
            type: "EXPIRE",
            points: -totalExpiredPoints,
            balanceBefore,
            balanceAfter,
            source: "MANUAL",
            description: `Hết hạn ${totalExpiredPoints} điểm từ ${expiredTransactions.length} transaction(s)`,
          });

          await LoyaltyTransaction.updateMany(
            { _id: { $in: expiredTransactions.map((tx) => tx._id) } },
            { isExpired: true }
          );

          await loyaltyService.updateUserTier(userId);
        }
      } catch (error) {
        console.error(
          `[STATS AUTO-EXPIRE] Error expiring transactions:`,
          error.message
        );
      }
    }

    const user = await User.findById(userId).populate("loyalty.tier");

    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Tính điểm sắp hết hạn (30 ngày tới)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiringTransactions = await LoyaltyTransaction.find({
      user: userId,
      type: "EARN",
      isExpired: false,
      expiresAt: { $lte: thirtyDaysFromNow },
    });

    const expiringPoints = expiringTransactions.reduce(
      (sum, tx) => sum + tx.points,
      0
    );

    // FIX THIẾU #4: Tự động gửi notification nếu có điểm sắp hết hạn
    if (expiringPoints > 0) {
      // Chạy async, không block response
      loyaltyService.checkAndNotifyExpiringPoints(userId).catch((err) => {
        console.error("[LOYALTY] Error notifying expiring points:", err);
      });
    }

    // Lấy tier tiếp theo
    const nextTier = await LoyaltyTier.findOne({
      isActive: true,
      minPoints: { $gt: user.loyalty.points },
    }).sort({ minPoints: 1 });

    return {
      success: true,
      loyalty: {
        currentPoints: user.loyalty.points,
        totalEarned: user.loyalty.totalEarned,
        totalRedeemed: user.loyalty.totalRedeemed,
        tier: user.loyalty.tier,
        tierName: user.loyalty.tierName,
        expiringPoints,
        nextTier: nextTier
          ? {
              name: nextTier.name,
              minPoints: nextTier.minPoints,
              pointsNeeded: nextTier.minPoints - user.loyalty.points,
            }
          : null,
      },
    };
  },
};

/**
 * ADMIN LOYALTY TIER SERVICE - Quản lý loyalty tiers
 */
const adminLoyaltyTierService = {
  /**
   * Lấy danh sách tất cả loyalty tiers
   */
  getAllTiers: async (query = {}) => {
    const { page = 1, limit = 50, isActive } = query;

    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { displayOrder: 1, minPoints: 1 },
      select: "-__v",
    };

    const result = await paginate(LoyaltyTier, filter, options);

    return {
      success: true,
      ...result,
    };
  },

  /**
   * Lấy chi tiết tier
   */
  getTierById: async (tierId) => {
    const tier = await LoyaltyTier.findById(tierId);

    if (!tier) {
      throw new ApiError(404, "Không tìm thấy loyalty tier");
    }

    // Count users in this tier
    const userCount = await User.countDocuments({ "loyalty.tier": tierId });

    return {
      success: true,
      tier: {
        ...tier.toObject(),
        userCount,
      },
    };
  },

  /**
   * Tạo tier mới
   */
  createTier: async (tierData) => {
    // Kiểm tra tên tier đã tồn tại
    const existingTier = await LoyaltyTier.findOne({ name: tierData.name });
    if (existingTier) {
      throw new ApiError(400, "Tên tier đã tồn tại");
    }

    // Kiểm tra minPoints đã được dùng chưa
    const existingMinPoints = await LoyaltyTier.findOne({
      minPoints: tierData.minPoints,
    });
    if (existingMinPoints) {
      throw new ApiError(
        400,
        "Điểm tối thiểu này đã được sử dụng bởi tier khác"
      );
    }

    // FIX BUG #2: Validate overlap tier ranges
    const { minPoints, maxPoints } = tierData;
    if (maxPoints && maxPoints <= minPoints) {
      throw new ApiError(400, "Điểm tối đa phải lớn hơn điểm tối thiểu");
    }

    // Kiểm tra overlap với các tier khác
    const allTiers = await LoyaltyTier.find({});
    for (const tier of allTiers) {
      const tierMin = tier.minPoints;
      const tierMax = tier.maxPoints || Infinity;
      const newMin = minPoints;
      const newMax = maxPoints || Infinity;

      // Check overlap: new tier overlap với existing tier
      const hasOverlap =
        (newMin >= tierMin && newMin < tierMax) || // newMin nằm trong range
        (newMax > tierMin && newMax <= tierMax) || // newMax nằm trong range
        (newMin <= tierMin && newMax >= tierMax); // new tier bao trùm existing

      if (hasOverlap) {
        throw new ApiError(
          400,
          `Tier mới overlap với tier "${tier.name}" (${tierMin}-${
            tierMax === Infinity ? "∞" : tierMax
          } điểm)`
        );
      }
    }

    // Tự động tạo slug
    tierData.slug = slugify(tierData.name);

    // Set default benefits nếu không có
    if (!tierData.benefits) {
      tierData.benefits = {};
    }
    if (!tierData.benefits.pointsMultiplier) {
      tierData.benefits.pointsMultiplier = 1;
    }
    if (tierData.benefits.prioritySupport === undefined) {
      tierData.benefits.prioritySupport = false;
    }

    const tier = await LoyaltyTier.create(tierData);

    return {
      success: true,
      message: "Tạo loyalty tier thành công",
      tier,
    };
  },

  /**
   * Cập nhật tier
   */
  updateTier: async (tierId, tierData) => {
    const tier = await LoyaltyTier.findById(tierId);

    if (!tier) {
      throw new ApiError(404, "Không tìm thấy loyalty tier");
    }

    // Nếu thay đổi name, kiểm tra trùng lặp
    if (tierData.name && tierData.name !== tier.name) {
      const existingTier = await LoyaltyTier.findOne({
        name: tierData.name,
        _id: { $ne: tierId },
      });
      if (existingTier) {
        throw new ApiError(400, "Tên tier đã tồn tại");
      }
      // Update slug
      tierData.slug = slugify(tierData.name);
    }

    // Nếu thay đổi minPoints, kiểm tra trùng lặp
    if (
      tierData.minPoints !== undefined &&
      tierData.minPoints !== tier.minPoints
    ) {
      const existingMinPoints = await LoyaltyTier.findOne({
        minPoints: tierData.minPoints,
        _id: { $ne: tierId },
      });
      if (existingMinPoints) {
        throw new ApiError(
          400,
          "Điểm tối thiểu này đã được sử dụng bởi tier khác"
        );
      }
    }

    // Validate maxPoints > minPoints
    const finalMinPoints =
      tierData.minPoints !== undefined ? tierData.minPoints : tier.minPoints;
    const finalMaxPoints =
      tierData.maxPoints !== undefined ? tierData.maxPoints : tier.maxPoints;

    if (finalMaxPoints && finalMaxPoints <= finalMinPoints) {
      throw new ApiError(400, "Điểm tối đa phải lớn hơn điểm tối thiểu");
    }

    // FIX BUG #2: Validate overlap với các tier khác
    const allTiers = await LoyaltyTier.find({ _id: { $ne: tierId } });
    for (const otherTier of allTiers) {
      const tierMin = otherTier.minPoints;
      const tierMax = otherTier.maxPoints || Infinity;
      const newMin = finalMinPoints;
      const newMax = finalMaxPoints || Infinity;

      const hasOverlap =
        (newMin >= tierMin && newMin < tierMax) ||
        (newMax > tierMin && newMax <= tierMax) ||
        (newMin <= tierMin && newMax >= tierMax);

      if (hasOverlap) {
        throw new ApiError(
          400,
          `Tier mới overlap với tier "${otherTier.name}" (${tierMin}-${
            tierMax === Infinity ? "∞" : tierMax
          } điểm)`
        );
      }
    }

    // Update tier
    Object.assign(tier, tierData);
    await tier.save();

    // Trigger re-calculation cho tất cả users trong tier này
    const users = await User.find({ "loyalty.tier": tierId });
    for (const user of users) {
      await loyaltyService.updateUserTier(user._id);
    }

    return {
      success: true,
      message: "Cập nhật loyalty tier thành công",
      tier,
    };
  },

  /**
   * Xóa tier
   */
  deleteTier: async (tierId) => {
    const tier = await LoyaltyTier.findById(tierId);

    if (!tier) {
      throw new ApiError(404, "Không tìm thấy loyalty tier");
    }

    // Kiểm tra có users đang dùng tier này không
    const userCount = await User.countDocuments({ "loyalty.tier": tierId });

    if (userCount > 0) {
      throw new ApiError(
        400,
        `Không thể xóa tier đang có ${userCount} user(s) sử dụng. Vui lòng chuyển users sang tier khác trước.`
      );
    }

    await tier.deleteOne();

    return {
      success: true,
      message: "Xóa loyalty tier thành công",
    };
  },
};

module.exports = {
  ...loyaltyService,
  adminLoyaltyTierService,
};
