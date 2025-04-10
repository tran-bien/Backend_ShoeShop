const mongoose = require("mongoose");

/**
 * Áp dụng middleware cho CancelRequest Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Kiểm tra tính hợp lệ của yêu cầu hủy trước khi tạo mới
  schema.pre("save", async function (next) {
    try {
      if (this.isNew) {
        const Order = mongoose.model("Order");
        const order = await Order.findById(this.order);

        // Kiểm tra đơn có tồn tại không
        if (!order) {
          throw new Error("Không tìm thấy đơn hàng");
        }

        // Kiểm tra đơn có thuộc về người dùng không
        if (order.user.toString() !== this.user.toString()) {
          throw new Error("Đơn hàng không thuộc về bạn");
        }

        // Kiểm tra trạng thái đơn hàng có cho phép hủy không
        if (!["pending", "confirmed"].includes(order.status)) {
          throw new Error(
            "Chỉ có thể hủy đơn hàng ở trạng thái chờ xác nhận hoặc đã xác nhận"
          );
        }

        // Kiểm tra đã có yêu cầu hủy đang chờ xử lý cho đơn hàng này chưa
        const CancelRequest = this.constructor;
        const existingRequest = await CancelRequest.findOne({
          order: this.order,
          status: "pending",
        });

        if (existingRequest) {
          throw new Error("Đã có yêu cầu hủy cho đơn hàng này đang chờ xử lý");
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

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

        // Nếu yêu cầu hủy được chấp nhận, cập nhật trạng thái đơn hàng thành "cancelled"
        if (currentStatus === "approved") {
          await Order.findByIdAndUpdate(this.order, {
            status: "cancelled",
            cancelRequestId: this._id,
            $push: {
              statusHistory: {
                status: "cancelled",
                updatedAt: new Date(),
                updatedBy: this.processedBy,
                note: `Đơn hàng bị hủy theo yêu cầu. Lý do: ${this.reason}`,
              },
            },
          });

          // Tạo thông báo cho người dùng - hiện tại comment lại
          /*
          const createNotification = require("../services/notification.service").createNotification;
          await createNotification(this.user, {
            type: "cancel_request",
            title: "Yêu cầu hủy đơn được chấp nhận",
            content: `Yêu cầu hủy đơn hàng của bạn đã được chấp nhận.`,
            refId: this.order,
            refModel: "Order"
          });
          */
        }

        // Nếu yêu cầu hủy bị từ chối, tạo thông báo
        if (currentStatus === "rejected") {
          // Tạo thông báo cho người dùng - hiện tại comment lại
          /*
          const createNotification = require("../services/notification.service").createNotification;
          await createNotification(this.user, {
            type: "cancel_request",
            title: "Yêu cầu hủy đơn bị từ chối",
            content: `Yêu cầu hủy đơn hàng của bạn đã bị từ chối. ${this.adminResponse || ''}`,
            refId: this.order,
            refModel: "Order"
          });
          */
        }

        // Nếu trạng thái là "approved" hoặc "rejected", cập nhật thời gian xử lý
        if (
          ["approved", "rejected"].includes(currentStatus) &&
          !this.resolvedAt
        ) {
          this.resolvedAt = new Date();
          await this.save();
        }
      }
    } catch (error) {
      console.error("Lỗi khi xử lý yêu cầu hủy đơn:", error);
    }
  });

  // Xử lý khi cập nhật thông qua findOneAndUpdate
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();

      // Lưu thông tin để sử dụng sau update
      if (update.$set && update.$set.status) {
        const doc = await this.model.findOne(this.getQuery());
        this._oldStatus = doc ? doc.status : null;
        this._requestId = doc ? doc._id : null;
        this._orderId = doc ? doc.order : null;
        this._userId = doc ? doc.user : null;
      }

      // Nếu đang chuyển trạng thái sang approved/rejected, tự động cập nhật resolvedAt
      if (
        update.$set &&
        ["approved", "rejected"].includes(update.$set.status) &&
        !update.$set.resolvedAt
      ) {
        update.$set.resolvedAt = new Date();
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý sau khi cập nhật bằng findOneAndUpdate
  schema.post("findOneAndUpdate", async function (doc) {
    try {
      if (doc && this._oldStatus && doc.status !== this._oldStatus) {
        const Order = mongoose.model("Order");

        // Nếu yêu cầu được chấp nhận
        if (doc.status === "approved" && this._oldStatus !== "approved") {
          await Order.findByIdAndUpdate(doc.order, {
            status: "cancelled",
            cancelRequestId: doc._id,
            $push: {
              statusHistory: {
                status: "cancelled",
                updatedAt: new Date(),
                updatedBy: doc.processedBy || null,
                note: `Đơn hàng bị hủy theo yêu cầu. Lý do: ${doc.reason}`,
              },
            },
          });

          // Tạo thông báo - hiện tại comment lại
          /*
          const createNotification = require("../services/notification.service").createNotification;
          await createNotification(doc.user, {
            type: "cancel_request",
            title: "Yêu cầu hủy đơn được chấp nhận",
            content: `Yêu cầu hủy đơn hàng của bạn đã được chấp nhận.`,
            refId: doc.order,
            refModel: "Order"
          });
          */
        }

        // Nếu yêu cầu bị từ chối
        if (doc.status === "rejected" && this._oldStatus !== "rejected") {
          // Tạo thông báo - hiện tại comment lại
          /*
          const createNotification = require("../services/notification.service").createNotification;
          await createNotification(doc.user, {
            type: "cancel_request",
            title: "Yêu cầu hủy đơn bị từ chối",
            content: `Yêu cầu hủy đơn hàng của bạn đã bị từ chối. ${doc.adminResponse || ''}`,
            refId: doc.order,
            refModel: "Order"
          });
          */
        }
      }
    } catch (error) {
      console.error("Lỗi xử lý sau khi cập nhật yêu cầu hủy:", error);
    }
  });
};

module.exports = { applyMiddlewares };
