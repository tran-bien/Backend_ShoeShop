const mongoose = require("mongoose");

/**
 * Áp dụng middleware cho Coupon Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Xác thực dữ liệu trước khi lưu
  schema.pre("save", function (next) {
    try {
      // Kiểm tra giá trị giảm giá phù hợp với loại
      if (this.discountType === "percent" && this.discountValue > 100) {
        throw new Error("Giá trị % giảm giá không được vượt quá 100%");
      }

      // Kiểm tra thời hạn hợp lệ
      if (this.endDate <= this.startDate) {
        throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
      }

      // Kiểm tra giảm giá tối đa cho mã phần trăm
      if (this.discountType === "percent" && !this.maxDiscountAmount) {
        // Mặc định là 1,000,000 VND nếu không thiết lập
        this.maxDiscountAmount = 1000000;
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý khi cập nhật coupon
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();
      if (!update) return next();

      // Xử lý khi đặt lại deletedAt (khôi phục)
      if (update.$set && update.$set.deletedAt === null) {
        const doc = await this.model.findOne(this.getQuery(), {
          includeDeleted: true,
        });

        if (doc) {
          // Kiểm tra trùng mã khi khôi phục
          const duplicate = await this.model.findOne({
            code: doc.code,
            _id: { $ne: doc._id },
            deletedAt: null,
          });

          if (duplicate) {
            // Tạo mã mới nếu bị trùng
            update.$set.code = `${doc.code}_${Date.now().toString().slice(-6)}`;
          }

          // Mặc định đặt isActive = false khi khôi phục
          if (update.$set.isActive === undefined) {
            update.$set.isActive = false;
          }
        }
      }

      // Kiểm tra giá trị giảm giá khi cập nhật
      if (
        update.discountType === "percent" ||
        (update.$set && update.$set.discountType === "percent")
      ) {
        const discountValue =
          update.discountValue || (update.$set && update.$set.discountValue);

        if (discountValue !== undefined && discountValue > 100) {
          return next(new Error("Giá trị % giảm giá không được vượt quá 100%"));
        }
      }

      // Kiểm tra thời hạn khi cập nhật
      const startDate =
        update.startDate || (update.$set && update.$set.startDate);
      const endDate = update.endDate || (update.$set && update.$set.endDate);

      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        return next(new Error("Ngày kết thúc phải sau ngày bắt đầu"));
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Cập nhật usedCount khi sử dụng coupon
  schema.methods.use = async function () {
    try {
      // Tăng số lần sử dụng
      this.usedCount += 1;
      await this.save();
      return true;
    } catch (error) {
      throw error;
    }
  };

  // Kiểm tra người dùng có thu thập mã giảm giá chưa
  schema.methods.isCollectedBy = function (userId) {
    return this.users.some((user) => user.toString() === userId.toString());
  };

  // Thu thập mã giảm giá
  schema.methods.collectByUser = async function (userId) {
    try {
      if (this.isCollectedBy(userId)) {
        throw new Error("Bạn đã thu thập mã giảm giá này rồi");
      }

      this.users.push(userId);
      await this.save();

      return true;
    } catch (error) {
      throw error;
    }
  };
};

module.exports = { applyMiddlewares };
