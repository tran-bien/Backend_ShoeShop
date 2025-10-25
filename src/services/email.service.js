const nodemailer = require("nodemailer");
const { User, Order } = require("@models");
const ApiError = require("@utils/ApiError");

// Khởi tạo transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const emailService = {
  /**
   * Gửi email notification chung
   */
  sendNotificationEmail: async (userId, notification) => {
    const user = await User.findById(userId);

    if (!user || !user.email) {
      throw new ApiError(404, "Không tìm thấy email người dùng");
    }

    const mailOptions = {
      from: `"Shoe Shop" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">${notification.title}</h2>
          <p style="font-size: 16px; line-height: 1.6;">${notification.message}</p>
          ${
            notification.actionUrl
              ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.FRONTEND_URL}${notification.actionUrl}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              ${notification.actionText || "Xem chi tiết"}
            </a>
          </div>
          `
              : ""
          }
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            Trân trọng,<br>
            Đội ngũ Shoe Shop
          </p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Lỗi gửi email:", error);
      throw new ApiError(500, "Không thể gửi email");
    }
  },

  /**
   * Gửi email xác nhận đơn hàng
   */
  sendOrderConfirmationEmail: async (userId, order) => {
    const user = await User.findById(userId);

    const orderItemsHtml = order.orderItems
      .map(
        (item) => `
      <tr>
        <td>${item.productName}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${item.price.toLocaleString("vi-VN")}đ</td>
      </tr>
    `
      )
      .join("");

    const mailOptions = {
      from: `"Shoe Shop" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Xác nhận đơn hàng ${order.code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Đơn hàng ${order.code} đã được xác nhận</h2>
          <p>Xin chào ${user.name},</p>
          <p>Cảm ơn bạn đã đặt hàng tại Shoe Shop. Đơn hàng của bạn đang được chuẩn bị.</p>
          
          <h3 style="color: #555;">Thông tin đơn hàng:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Sản phẩm</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">SL</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
            <p style="margin: 5px 0;"><strong>Tổng tiền hàng:</strong> ${order.subTotal.toLocaleString("vi-VN")}đ</p>
            <p style="margin: 5px 0;"><strong>Giảm giá:</strong> -${order.discount.toLocaleString("vi-VN")}đ</p>
            <p style="margin: 5px 0;"><strong>Phí vận chuyển:</strong> ${order.shippingFee.toLocaleString("vi-VN")}đ</p>
            <p style="margin: 10px 0 5px 0; font-size: 18px; color: #4CAF50;"><strong>Tổng thanh toán:</strong> ${order.totalAfterDiscountAndShipping.toLocaleString("vi-VN")}đ</p>
          </div>
          
          <h3 style="color: #555; margin-top: 20px;">Địa chỉ giao hàng:</h3>
          <p style="margin: 5px 0;">${order.shippingAddress.name} - ${order.shippingAddress.phone}</p>
          <p style="margin: 5px 0;">${order.shippingAddress.detail}, ${order.shippingAddress.ward}, ${order.shippingAddress.district}, ${order.shippingAddress.province}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/orders/${order._id}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Xem đơn hàng
            </a>
          </div>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            Nếu bạn có câu hỏi, vui lòng liên hệ: ${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}
          </p>
          <p style="color: #666; font-size: 14px;">
            Trân trọng,<br>
            Đội ngũ Shoe Shop
          </p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Lỗi gửi email xác nhận đơn hàng:", error);
      throw new ApiError(500, "Không thể gửi email");
    }
  },

  /**
   * Gửi email khuyến mãi
   */
  sendPromotionEmail: async (userEmails, promotionData) => {
    const { subject, title, message, couponCode, imageUrl, ctaUrl } =
      promotionData;

    const mailOptions = {
      from: `"Shoe Shop Khuyến Mãi" <${process.env.EMAIL_USER}>`,
      bcc: userEmails, // BCC để gửi hàng loạt
      subject: subject || "Khuyến mãi đặc biệt từ Shoe Shop",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          ${imageUrl ? `<img src="${imageUrl}" alt="Promotion" style="width: 100%; border-radius: 5px; margin-bottom: 20px;">` : ""}
          
          <h2 style="color: #333; text-align: center;">${title}</h2>
          <p style="font-size: 16px; line-height: 1.6; text-align: center;">${message}</p>
          
          ${
            couponCode
              ? `
          <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
            <p style="margin: 0; font-size: 14px;">Mã giảm giá:</p>
            <p style="margin: 10px 0; font-size: 24px; font-weight: bold; color: #d9534f;">${couponCode}</p>
          </div>
          `
              : ""
          }
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${ctaUrl || process.env.FRONTEND_URL}" 
               style="background-color: #d9534f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">
              Mua ngay
            </a>
          </div>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            Bạn nhận được email này vì đã đăng ký nhận thông báo từ Shoe Shop.<br>
            <a href="${process.env.FRONTEND_URL}/unsubscribe" style="color: #666;">Hủy đăng ký</a>
          </p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, sentCount: userEmails.length };
    } catch (error) {
      console.error("Lỗi gửi email khuyến mãi:", error);
      throw new ApiError(500, "Không thể gửi email khuyến mãi");
    }
  },
};

module.exports = emailService;

