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
   * Gửi email khuyến mãi
   */
  sendPromotionEmail: async (userEmails, promotionData) => {
    const { subject, title, message, couponCode, imageUrl, ctaUrl } =
      promotionData;

    const mailOptions = {
      from: `"Shoe Shop Khuyến Mãi" <${process.env.EMAIL_USER}>`,
      bcc: userEmails,
      subject: subject || "Khuyến mãi đặc biệt từ Shoe Shop",
      html: emailTemplates.promotionEmailTemplate(
        title,
        message,
        couponCode,
        imageUrl,
        ctaUrl,
        process.env.FRONTEND_URL
      ),
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, sentCount: userEmails.length };
    } catch (error) {
      console.error("Lỗi gửi email khuyến mãi:", error);
      throw new ApiError(500, "Không thể gửi email khuyến mãi");
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
