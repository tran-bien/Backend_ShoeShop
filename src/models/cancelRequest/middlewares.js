const mongoose = require("mongoose");

const applyMiddlewares = (schema) => {
  // Lưu trạng thái trước khi cập nhật để so sánh sau khi lưu
  schema.pre("save", async function (next) {
    // Nếu không phải document mới và field "status" được thay đổi
    if (!this.isNew && this.isModified("status")) {
      try {
        // Truy vấn lấy trạng thái cũ từ database
        const existingRequest = await this.constructor.findById(this._id);
        if (existingRequest) {
          this._previousStatus = existingRequest.status;
        }
      } catch (err) {
        console.error("Lỗi lấy trạng thái cũ của yêu cầu hủy:", err);
      }
    }
    next();
  });

  // Sau khi lưu, xử lý cập nhật đơn hàng tùy theo trạng thái của yêu cầu hủy
  schema.post("save", async function () {
    try {
      const currentStatus = this.status;
      const previousStatus = this._previousStatus;

      // Chỉ xử lý nếu có previousStatus (đã tồn tại trong db) và trạng thái đã thay đổi
      if (previousStatus && currentStatus !== previousStatus) {
        const Order = mongoose.model("Order");

        // Nếu yêu cầu hủy được chấp nhận, cập nhật trạng thái đơn hàng thành "cancelled" và thêm lý do
        if (currentStatus === "approved") {
          const order = await Order.findById(this.order);
          if (order && typeof order.updateStatus === "function") {
            await order.updateStatus("cancelled", this.reason);
          }
        }

        // Nếu trạng thái là "approved" hoặc "rejected", cập nhật thời gian xử lý (resolvedAt)
        if (["approved", "rejected"].includes(currentStatus)) {
          await this.constructor.updateOne(
            { _id: this._id },
            { resolvedAt: new Date() }
          );
        }
      }
    } catch (error) {
      console.error("Lỗi khi xử lý yêu cầu hủy đơn:", error);
    }
  });
};

module.exports = { applyMiddlewares };
