/**
 * Áp dụng middleware cho Coupon Schema
 * Kiểm tra coupon có thể sử dụng (isValid) dựa trên các điều kiện:
 *  - isActive phải là true (admin cho phép sử dụng coupon)
 *  - Ngày hiện tại nằm trong khoảng từ startDate đến expiryDate
 *  - Nếu có usageLimit, thì usageCount phải nhỏ hơn usageLimit
 *
 * Khi thỏa mãn các điều kiện trên, trường isValid được cập nhật thành true, ngược lại là false.
 */
const applyMiddlewares = (schema) => {
  // Trước khi lưu coupon
  schema.pre("save", function (next) {
    const now = new Date();
    const active = this.isActive;
    const validByDate = this.startDate <= now && now <= this.expiryDate;
    let validUsage = true;
    if (this.usageLimit != null) {
      validUsage = this.usageCount < this.usageLimit;
    }
    // Cập nhật trường isValid dựa trên các điều kiện
    this.isValid = active && validByDate && validUsage;
    next();
  });

  // Trước khi cập nhật coupon qua findOneAndUpdate (hoặc updateOne)
  // Nếu bất kỳ trường nào liên quan đến tính hợp lệ bị thay đổi thì tính lại isValid.
  schema.pre("findOneAndUpdate", async function (next) {
    let update = this.getUpdate();
    if (!update) return next();

    const keysToCheck = [
      "isActive",
      "startDate",
      "expiryDate",
      "usageCount",
      "usageLimit",
    ];
    let shouldRecalc = keysToCheck.some(
      (key) =>
        update[key] !== undefined ||
        (update.$set && update.$set[key] !== undefined)
    );

    if (shouldRecalc) {
      // Lấy document hiện tại từ database
      const docToUpdate = await this.model.findOne(this.getQuery());
      if (docToUpdate) {
        // Gộp các giá trị cập nhật với thông tin hiện tại của document
        const updated = {
          ...docToUpdate.toObject(),
          ...(update.$set || update),
        };
        const now = new Date();
        const active = updated.isActive;
        const validByDate =
          updated.startDate <= now && now <= updated.expiryDate;
        let validUsage = true;
        if (updated.usageLimit != null) {
          validUsage = updated.usageCount < updated.usageLimit;
        }
        const newIsValid = active && validByDate && validUsage;
        if (update.$set) {
          update.$set.isValid = newIsValid;
        } else {
          update.isValid = newIsValid;
        }
        this.setUpdate(update);
      }
    }
    next();
  });
};

module.exports = { applyMiddlewares };
