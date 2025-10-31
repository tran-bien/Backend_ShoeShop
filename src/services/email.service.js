const nodemailer = require("nodemailer");
const { User } = require("@models");
const ApiError = require("@utils/ApiError");
const emailTemplates = require("@utils/email");

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
      html: emailTemplates.notificationEmailTemplate(
        notification.title,
        notification.message,
        notification.actionUrl
          ? `${process.env.FRONTEND_URL}${notification.actionUrl}`
          : null,
        notification.actionText
      ),
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

    if (!user || !user.email) {
      throw new ApiError(404, "Không tìm thấy email người dùng");
    }

    const mailOptions = {
      from: `"Shoe Shop" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Xác nhận đơn hàng ${order.code}`,
      html: emailTemplates.orderConfirmationEmailTemplate(
        user.name,
        order,
        process.env.FRONTEND_URL
      ),
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
   * Gửi email thông báo yêu cầu đổi/trả hàng
   */
  sendReturnRequestEmail: async (userId, returnRequest) => {
    const User = require("@models/user");
    const user = await User.findById(userId).select("name email preferences");

    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Check user preferences
    const emailEnabled =
      user.preferences?.emailNotifications?.orderUpdates !== false;

    if (!emailEnabled) {
      console.log(
        `[EMAIL] User ${user.email} đã tắt email notification, skip email đổi/trả hàng`
      );
      return { success: false, reason: "User disabled email notifications" };
    }

    const mailOptions = {
      from: `"Shoe Shop - Đổi/Trả Hàng" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `[Shoe Shop] Cập nhật yêu cầu đổi/trả hàng #${returnRequest.code}`,
      html: emailTemplates.returnRequestEmailTemplate(
        user.name,
        returnRequest,
        process.env.FRONTEND_URL
      ),
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(
        `[EMAIL] Đã gửi email đổi/trả hàng cho ${user.email} - Mã: ${returnRequest.code}`
      );
      return { success: true };
    } catch (error) {
      console.error("Lỗi gửi email đổi/trả hàng:", error);
      throw new ApiError(500, "Không thể gửi email đổi/trả hàng");
    }
  },

  /**
   * Gửi newsletter đến người dùng đã đăng ký
   */
  sendNewsletterEmail: async (userEmails, newsletterData) => {
    const {
      subject,
      title,
      heroImageUrl,
      sections = [],
      featuredProducts = [],
      ctaText,
      ctaUrl,
    } = newsletterData;

    const mailOptions = {
      from: `"Shoe Shop Newsletter" <${process.env.EMAIL_USER}>`,
      bcc: userEmails,
      subject: subject || "Newsletter từ Shoe Shop",
      html: emailTemplates.newsletterEmailTemplate(
        title,
        heroImageUrl,
        sections,
        featuredProducts,
        ctaText,
        ctaUrl,
        process.env.FRONTEND_URL
      ),
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, sentCount: userEmails.length };
    } catch (error) {
      console.error("Lỗi gửi newsletter:", error);
      throw new ApiError(500, "Không thể gửi newsletter");
    }
  },
};

module.exports = emailService;
