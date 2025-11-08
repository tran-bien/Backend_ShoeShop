const nodemailer = require("nodemailer");
const ApiError = require("@utils/ApiError");
const { baseStyles } = require("@utils/emailTemplates");

require("dotenv").config();

// Kiểm tra biến môi trường
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.error(
    "❌ CRITICAL: EMAIL_USER hoặc EMAIL_PASSWORD chưa được cấu hình trong .env"
  );
  throw new Error("Missing email configuration in .env file");
}

// Loại bỏ dấu ngoặc kép và khoảng trắng thừa (nếu có)
const emailPassword = process.env.EMAIL_PASSWORD.replace(/['"]/g, "").trim();
console.log("📧 Cleaned password length:", emailPassword.length);

// Khởi tạo transporter (sẽ được shared giữa utils và service)
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: emailPassword, // Sử dụng password đã được clean
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter verification failed:", error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

// Export transporter để tái sử dụng
module.exports.transporter = transporter;

// Helper: Tạo wrapper chung cho email
const createEmailWrapper = (content) => `
  <div style="${baseStyles.container}">
    <div style="${baseStyles.header}">
      <h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1>
      <p style="${baseStyles.headerSubtitle}">Premium Footwear</p>
    </div>
    ${content}
    <div style="${baseStyles.footer}">
      <p style="${
        baseStyles.footerText
      }"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${
        baseStyles.footerText
      }">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  </div>
`;

/**
 * Template 1: Email xác nhận OTP
 */
exports.verificationEmailTemplate = (name, otp) => {
  const content = `
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">Xác nhận tài khoản</h2>
      <p style="${baseStyles.text}">Xin chào <strong>${name}</strong>,</p>
      <p style="${baseStyles.text}">
        Cảm ơn bạn đã đăng ký tài khoản tại Shoe Shop. Để hoàn tất quá trình đăng ký, 
        vui lòng sử dụng mã OTP bên dưới:
      </p>
      <div style="${baseStyles.codeBox}">
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #2C2C2C; letter-spacing: 2px; text-transform: uppercase;">Mã xác nhận</p>
        <div style="${baseStyles.code}">${otp}</div>
      </div>
      <p style="${baseStyles.text}">Mã OTP này sẽ <strong>hết hạn sau 10 phút</strong>.</p>
      <p style="${baseStyles.text}">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
    </div>
  `;
  return createEmailWrapper(content);
};

/**
 * Template 2: Email đặt lại mật khẩu
 */
exports.resetPasswordEmailTemplate = (name, resetUrl) => {
  const content = `
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">Đặt lại mật khẩu</h2>
      <p style="${baseStyles.text}">Xin chào <strong>${name}</strong>,</p>
      <p style="${baseStyles.text}">
        Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản tại Shoe Shop. 
        Vui lòng nhấp vào nút bên dưới để thiết lập mật khẩu mới:
      </p>
      <div style="${baseStyles.buttonWrapper}">
        <a href="${resetUrl}" style="${baseStyles.button}">Đặt lại mật khẩu</a>
      </div>
      <p style="${baseStyles.text}">Liên kết này sẽ <strong>hết hạn sau 10 phút</strong>.</p>
      <p style="${baseStyles.text}">
        Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. 
        Mật khẩu của bạn sẽ không thay đổi.
      </p>
    </div>
  `;
  return createEmailWrapper(content);
};

/**
 * Template 3: Email thông báo chung
 */
exports.notificationEmailTemplate = (title, message, actionUrl, actionText) => {
  const content = `
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">${title}</h2>
      <p style="${baseStyles.text}">${message}</p>
      ${
        actionUrl
          ? `
      <div style="${baseStyles.buttonWrapper}">
        <a href="${actionUrl}" style="${baseStyles.button}">${
              actionText || "Xem chi tiết"
            }</a>
      </div>
      `
          : ""
      }
    </div>
  `;
  return createEmailWrapper(content);
};

/**
 * Template 4: Email xác nhận đơn hàng
 */
exports.orderConfirmationEmailTemplate = (userName, order, frontendUrl) => {
  const orderItemsHtml = order.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #F5F5F5; color: #2C2C2C;">${
          item.productName
        }</td>
        <td style="padding: 15px; border-bottom: 1px solid #F5F5F5; text-align: center; color: #2C2C2C; font-weight: 600;">×${
          item.quantity
        }</td>
        <td style="padding: 15px; border-bottom: 1px solid #F5F5F5; text-align: right; color: #000000; font-weight: 600;">${item.price.toLocaleString(
          "vi-VN"
        )}đ</td>
      </tr>
    `
    )
    .join("");

  const content = `
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">Đơn hàng ${order.code}</h2>
      <p style="${baseStyles.text}">Xin chào <strong>${userName}</strong>,</p>
      <p style="${
        baseStyles.text
      }">Cảm ơn bạn đã đặt hàng tại Shoe Shop. Đơn hàng của bạn đang được chuẩn bị.</p>
      
      <hr style="${baseStyles.divider}">
      
      <h3 style="color: #000000; font-size: 16px; font-weight: 600; margin: 30px 0 20px 0; letter-spacing: 1px; text-transform: uppercase;">Sản phẩm</h3>
      <table style="width: 100%; border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #F5F5F5;">
        <thead>
          <tr style="background-color: #000000;">
            <th style="padding: 15px; text-align: left; color: #FFFFFF; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Tên sản phẩm</th>
            <th style="padding: 15px; text-align: center; color: #FFFFFF; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Số lượng</th>
            <th style="padding: 15px; text-align: right; color: #FFFFFF; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Giá</th>
          </tr>
        </thead>
        <tbody>${orderItemsHtml}</tbody>
      </table>
      
      <div style="margin-top: 30px; padding: 25px; background-color: #F5F5F5; border: 2px solid #E0E0E0;">
        <table style="width: 100%;">
          <tr><td style="color: #2C2C2C; font-size: 15px;">Tổng tiền hàng:</td><td style="text-align: right; color: #2C2C2C; font-size: 15px; font-weight: 600;">${order.subTotal.toLocaleString(
            "vi-VN"
          )}đ</td></tr>
          <tr><td style="color: #2C2C2C; font-size: 15px; padding-top: 10px;">Giảm giá:</td><td style="text-align: right; color: #2C2C2C; font-size: 15px; font-weight: 600; padding-top: 10px;">-${order.discount.toLocaleString(
            "vi-VN"
          )}đ</td></tr>
          <tr><td style="color: #2C2C2C; font-size: 15px; padding-top: 10px;">Phí vận chuyển:</td><td style="text-align: right; color: #2C2C2C; font-size: 15px; font-weight: 600; padding-top: 10px;">${order.shippingFee.toLocaleString(
            "vi-VN"
          )}đ</td></tr>
        </table>
        <hr style="margin: 20px 0; border: none; border-top: 2px solid #2C2C2C;">
        <table style="width: 100%;">
          <tr><td style="color: #000000; font-size: 18px; font-weight: 700; letter-spacing: 1px;">TỔNG THANH TOÁN:</td><td style="text-align: right; color: #000000; font-size: 20px; font-weight: 700;">${order.totalAfterDiscountAndShipping.toLocaleString(
            "vi-VN"
          )}đ</td></tr>
        </table>
      </div>
      
      <h3 style="color: #000000; font-size: 16px; font-weight: 600; margin: 40px 0 20px 0; letter-spacing: 1px; text-transform: uppercase;">Địa chỉ giao hàng</h3>
      <div style="padding: 20px; background-color: #F5F5F5; border-left: 4px solid #000000;">
        <p style="margin: 5px 0; color: #000000; font-weight: 600;">${
          order.shippingAddress.name
        } • ${order.shippingAddress.phone}</p>
        <p style="margin: 5px 0; color: #2C2C2C;">${
          order.shippingAddress.detail
        }</p>
        <p style="margin: 5px 0; color: #2C2C2C;">${
          order.shippingAddress.ward
        }, ${order.shippingAddress.district}, ${
    order.shippingAddress.province
  }</p>
      </div>
      
      <div style="${baseStyles.buttonWrapper}">
        <a href="${frontendUrl}/orders/${order._id}" style="${
    baseStyles.button
  }">Xem đơn hàng</a>
      </div>
    </div>
  `;

  const footer = `
    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">
        Nếu bạn có câu hỏi, vui lòng liên hệ: <a href="mailto:${
          process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
        }" style="${baseStyles.footerLink}">${
    process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
  }</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${
        baseStyles.footerText
      }"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${
        baseStyles.footerText
      }">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  `;

  return `<div style="${baseStyles.container}"><div style="${baseStyles.header}"><h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1><p style="${baseStyles.headerSubtitle}">Premium Footwear</p></div>${content}${footer}</div>`;
};

/**
 * Template 5: Email yêu cầu đổi/trả hàng
 */
exports.returnRequestEmailTemplate = (userName, returnRequest, frontendUrl) => {
  // Thông tin status
  const statusMessages = {
    pending: {
      title: "Đã nhận yêu cầu đổi/trả hàng",
      message:
        "Chúng tôi đã nhận được yêu cầu đổi/trả hàng của bạn và đang xem xét.",
      color: "#2C2C2C",
    },
    approved: {
      title: "Yêu cầu đã được chấp nhận",
      message:
        "Yêu cầu đổi/trả hàng của bạn đã được chấp nhận. Vui lòng làm theo hướng dẫn bên dưới.",
      color: "#000000",
    },
    processing: {
      title: "Đang xử lý yêu cầu",
      message: "Chúng tôi đang xử lý yêu cầu đổi/trả hàng của bạn.",
      color: "#2C2C2C",
    },
    completed: {
      title: "Hoàn tất đổi/trả hàng",
      message: "Yêu cầu đổi/trả hàng của bạn đã được xử lý thành công.",
      color: "#000000",
    },
    rejected: {
      title: "Yêu cầu bị từ chối",
      message: "Rất tiếc, yêu cầu đổi/trả hàng của bạn không được chấp nhận.",
      color: "#2C2C2C",
    },
    canceled: {
      title: "Yêu cầu đã bị hủy",
      message: "Yêu cầu đổi/trả hàng của bạn đã bị hủy.",
      color: "#2C2C2C",
    },
  };

  const statusInfo =
    statusMessages[returnRequest.status] || statusMessages.pending;
  const typeText = returnRequest.type === "RETURN" ? "Trả hàng" : "Đổi hàng";

  const content = `
    <div style="${baseStyles.content}">
      <h2 style="color: ${
        statusInfo.color
      }; font-size: 28px; font-weight: 700; margin: 0 0 15px 0; letter-spacing: -0.5px;">${
    statusInfo.title
  }</h2>
      
      <p style="${baseStyles.text}">Xin chào <strong>${userName}</strong>,</p>
      
      <p style="${baseStyles.text}">${statusInfo.message}</p>
      
      <div style="background-color: #F5F5F5; border-left: 4px solid #000000; padding: 20px; margin: 25px 0;">
        <p style="margin: 0 0 10px 0; color: #2C2C2C; font-size: 14px;"><strong style="color: #000000;">Mã yêu cầu:</strong> ${
          returnRequest.code
        }</p>
        <p style="margin: 0 0 10px 0; color: #2C2C2C; font-size: 14px;"><strong style="color: #000000;">Loại:</strong> ${typeText}</p>
        <p style="margin: 0 0 10px 0; color: #2C2C2C; font-size: 14px;"><strong style="color: #000000;">Đơn hàng:</strong> ${
          returnRequest.order?.code || returnRequest.orderCode || "N/A"
        }</p>
        <p style="margin: 0; color: #2C2C2C; font-size: 14px;"><strong style="color: #000000;">Trạng thái:</strong> ${
          statusInfo.title
        }</p>
      </div>
      
      ${
        returnRequest.adminNote
          ? `
        <div style="background-color: #FFFFFF; border: 2px solid #F5F5F5; padding: 20px; margin: 25px 0;">
          <p style="margin: 0 0 10px 0; color: #000000; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Ghi chú từ cửa hàng:</p>
          <p style="margin: 0; color: #2C2C2C; font-size: 14px; line-height: 1.7;">${returnRequest.adminNote}</p>
        </div>
      `
          : ""
      }
      
      <div style="${baseStyles.buttonWrapper}">
        <a href="${frontendUrl}/account/return-requests/${
    returnRequest._id
  }" style="${baseStyles.button}">Xem chi tiết</a>
      </div>
      
      <p style="color: #2C2C2C; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
        Nếu có thắc mắc, vui lòng liên hệ bộ phận chăm sóc khách hàng.
      </p>
    </div>
  `;

  const footer = `
    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">
        Nếu bạn có câu hỏi, vui lòng liên hệ: <a href="mailto:${
          process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
        }" style="${baseStyles.footerLink}">${
    process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
  }</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${
        baseStyles.footerText
      }"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${
        baseStyles.footerText
      }">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  `;

  return `<div style="${baseStyles.container}"><div style="${baseStyles.header}"><h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1><p style="${baseStyles.headerSubtitle}">Premium Footwear</p></div>${content}${footer}</div>`;
};

/**
 * Template 6: Newsletter
 */
exports.newsletterEmailTemplate = (
  title,
  heroImageUrl,
  sections,
  featuredProducts,
  ctaText,
  ctaUrl,
  frontendUrl
) => {
  const sectionsHtml = sections
    .map((section) => {
      if (section.type === "text") {
        return `<div style="margin: 30px 0;">${
          section.heading
            ? `<h3 style="color: #000000; font-size: 18px; font-weight: 600; margin-bottom: 15px;">${section.heading}</h3>`
            : ""
        }<p style="${baseStyles.text}">${section.content}</p></div>`;
      } else if (section.type === "image") {
        return `<div style="margin: 30px 0;"><img src="${
          section.imageUrl
        }" alt="${
          section.alt || "Image"
        }" style="width: 100%; border: 2px solid #F5F5F5;">${
          section.caption
            ? `<p style="font-size: 13px; color: #2C2C2C; margin-top: 10px; text-align: center; font-style: italic;">${section.caption}</p>`
            : ""
        }</div>`;
      }
      return "";
    })
    .join("");

  const productsHtml = featuredProducts.length
    ? `<div style="margin: 50px 0;"><h3 style="color: #000000; font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase;">Sản phẩm nổi bật</h3><table style="width: 100%;"><tr>${featuredProducts
        .map(
          (p) =>
            `<td style="width: 50%; padding: 10px;"><div style="border: 2px solid #F5F5F5;"><img src="${
              p.imageUrl
            }" alt="${
              p.name
            }" style="width: 100%; height: 200px; object-fit: cover;"><div style="padding: 20px; text-align: center;"><p style="font-weight: 600; color: #000000; font-size: 15px; margin: 0 0 10px 0;">${
              p.name
            }</p><p style="color: #2C2C2C; font-size: 18px; font-weight: 700; margin: 0 0 15px 0;">${p.price.toLocaleString(
              "vi-VN"
            )}đ</p><a href="${frontendUrl}/products/${
              p._id
            }" style="display: inline-block; background-color: #000000; color: #FFFFFF; padding: 10px 20px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border: 2px solid #000000;">Xem ngay</a></div></div></td>`
        )
        .join("")}</tr></table></div>`
    : "";

  const content = `
    ${
      heroImageUrl
        ? `<div style="background-color: #000000; padding: 0;"><img src="${heroImageUrl}" alt="Newsletter" style="width: 100%; max-height: 400px; object-fit: cover;"></div>`
        : ""
    }
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">${title}</h2>
      ${sectionsHtml}
      ${productsHtml}
      ${
        ctaText && ctaUrl
          ? `<div style="${baseStyles.buttonWrapper}"><a href="${ctaUrl}" style="${baseStyles.button}">${ctaText}</a></div>`
          : ""
      }
    </div>
  `;

  const footer = `
    <div style="${baseStyles.footer}">
      <p style="${
        baseStyles.footerText
      }"><strong>Theo dõi chúng tôi</strong></p>
      <div style="margin: 15px 0;">
        <a href="#" style="display: inline-block; margin: 0 10px; color: #000000; text-decoration: none; font-weight: 600;">Facebook</a>
        <a href="#" style="display: inline-block; margin: 0 10px; color: #000000; text-decoration: none; font-weight: 600;">Instagram</a>
        <a href="#" style="display: inline-block; margin: 0 10px; color: #000000; text-decoration: none; font-weight: 600;">Twitter</a>
      </div>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${
        baseStyles.footerText
      }">Bạn nhận được email này vì đã đăng ký nhận newsletter từ Shoe Shop.</p>
      <p style="${baseStyles.footerText}">
        <a href="${frontendUrl}/preferences/notifications" style="${
    baseStyles.footerLink
  }">Quản lý tùy chọn</a> • 
        <a href="${frontendUrl}/unsubscribe" style="${
    baseStyles.footerLink
  }">Hủy đăng ký</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${
        baseStyles.footerText
      }"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${
        baseStyles.footerText
      }">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  `;

  return `<div style="${baseStyles.container}"><div style="${baseStyles.header}"><h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1><p style="${baseStyles.headerSubtitle}">Premium Footwear</p></div>${content}${footer}</div>`;
};

/**
 * Helper function: Gửi email xác nhận OTP
 */
exports.sendVerificationEmail = async (email, name, otp) => {
  console.log(`📧 Attempting to send verification email to: ${email}`);
  console.log(`📧 OTP: ${otp}`);

  const mailOptions = {
    from: `"Shoe Shop" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác nhận tài khoản Shoe Shop",
    html: exports.verificationEmailTemplate(name, otp),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Verification email sent successfully:", info.messageId);
    console.log("✅ Accepted:", info.accepted);
    console.log("✅ Response:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    console.error("❌ Error code:", error.code);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);

    // Kiểm tra lỗi cụ thể
    if (error.code === "EAUTH") {
      throw new ApiError(
        500,
        "Lỗi xác thực email. Vui lòng kiểm tra cấu hình EMAIL_USER và EMAIL_PASSWORD trong file .env"
      );
    }

    throw new ApiError(500, "Không thể gửi email xác nhận. Vui lòng thử lại!");
  }
};

/**
 * Helper function: Gửi email đặt lại mật khẩu
 */
exports.sendResetPasswordEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"Shoe Shop" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Đặt lại mật khẩu Shoe Shop",
    html: exports.resetPasswordEmailTemplate(name, resetUrl),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending reset password email:", error);
    throw new ApiError(
      500,
      "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại!"
    );
  }
};
