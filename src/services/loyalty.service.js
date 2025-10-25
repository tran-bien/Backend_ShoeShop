const { User, Order, Review } = require("@models");
const LoyaltyTier = require("../models/loyaltyTier");
const LoyaltyTransaction = require("../models/loyaltyTransaction");
const ApiError = require("@utils/ApiError");

const loyaltyService = {
  /**
   * Tính điểm từ đơn hàng (1 điểm / 1000đ)
   */
  calculatePointsFromOrder: (orderTotal) => {
    return Math.floor(orderTotal / 1000);
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
    const multiplier =
      user.loyalty?.tier?.benefits?.pointsMultiplier || 1;
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
        description ||
        `Tích ${finalPoints} điểm từ ${source.toLowerCase()}`,
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
    if (!user.loyalty.tier || user.loyalty.tier.toString() !== tier._id.toString()) {
      const oldTierName = user.loyalty?.tierName || "Chưa có";

      user.loyalty.tier = tier._id;
      user.loyalty.tierName = tier.name;
      user.loyalty.lastTierUpdate = new Date();
      await user.save();

      console.log(
        `User ${user.name} lên hạng: ${oldTierName} → ${tier.name}`
      );

      // TODO: Gửi notification
      // await notificationService.send(userId, "LOYALTY_TIER_UP", { tierName: tier.name });

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
   */
  getUserTransactions: async (userId, query = {}) => {
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
   */
  getUserLoyaltyStats: async (userId) => {
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

module.exports = loyaltyService;

