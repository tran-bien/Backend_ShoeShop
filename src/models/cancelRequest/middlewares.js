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
      // Không xử lý nếu document đang bị xóa mềm (có trường deletedAt)
      if (this.deletedAt) {
        return;
      }

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

  // Xử lý khi khôi phục yêu cầu hủy (đặt deletedAt thành null)
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // Nếu đang khôi phục yêu cầu hủy (đặt deletedAt thành null)
    if (update && update.$set && update.$set.deletedAt === null) {
      try {
        const doc = await this.model.findOne(this.getFilter(), {
          includeDeleted: true,
        });

        // Nếu yêu cầu hủy đã được giải quyết (approved/rejected) trước khi bị xóa
        // thì không cần xử lý gì thêm
        // Nếu yêu cầu hủy đang ở trạng thái pending, cần kiểm tra đơn hàng liên quan
        if (doc && doc.status === "pending") {
          const Order = mongoose.model("Order");
          const order = await Order.findById(doc.order);

          // Nếu đơn hàng đã bị hủy hoặc đã giao hàng thành công,
          // tự động chuyển trạng thái yêu cầu hủy thành rejected khi khôi phục
          if (
            order &&
            (order.status === "cancelled" || order.status === "delivered")
          ) {
            update.$set.status = "rejected";
            update.$set.adminResponse =
              "Yêu cầu hủy không còn hợp lệ do đơn hàng đã được xử lý.";
            update.$set.resolvedAt = new Date();
          }
        }
      } catch (error) {
        console.error("Lỗi khi khôi phục yêu cầu hủy đơn:", error);
      }
    }

    next();
  });
};

module.exports = { applyMiddlewares };
