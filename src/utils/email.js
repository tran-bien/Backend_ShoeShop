const nodemailer = require("nodemailer");const nodemailer = require('nodemailer');

const ApiError = require("@utils/ApiError");const ApiError = require('@utils/ApiError');

const { baseStyles } = require("@utils/emailTemplates");const { baseStyles } = require('@utils/emailTemplates');



// Khởi tạo transporter// Khởi tạo transporter

const transporter = nodemailer.createTransport({const transporter = nodemailer.createTransport({

  service: process.env.EMAIL_SERVICE || "gmail",  service: process.env.EMAIL_SERVICE || 'gmail',

  auth: {  auth: {

    user: process.env.EMAIL_USER,    user: process.env.EMAIL_USER,

    pass: process.env.EMAIL_PASSWORD,    pass: process.env.EMAIL_PASSWORD,

  },  },

});});



// Helper: Header + Footer chung// Template: Email xác nhận OTP

const createEmailWrapper = (content) => `const verificationEmailTemplate = (name, otp) => {

  <div style="${baseStyles.container}">  return `<div style="${baseStyles.container}">

    <div style="${baseStyles.header}">    <div style="${baseStyles.header}">

      <h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1>      <h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1>

      <p style="${baseStyles.headerSubtitle}">Premium Footwear</p>      <p style="${baseStyles.headerSubtitle}">Premium Footwear</p>

    </div>    </div>

    ${content}    <div style="${baseStyles.content}">

    <div style="${baseStyles.footer}">      <h2 style="${baseStyles.title}">Xác nhận tài khoản</h2>

      <p style="${baseStyles.footerText}"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>      <p style="${baseStyles.text}">Xin chào <strong>${name}</strong>,</p>

      <p style="${baseStyles.footerText}">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>      <p style="${baseStyles.text}">Cảm ơn bạn đã đăng ký tài khoản tại Shoe Shop. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã OTP bên dưới:</p>

    </div>      <div style="${baseStyles.codeBox}">

  </div>        <p style="margin: 0 0 10px 0; font-size: 12px; color: #2C2C2C; letter-spacing: 2px; text-transform: uppercase;">Mã xác nhận</p>

`;        <div style="${baseStyles.code}">${otp}</div>

      </div>

// Template 1: Verification Email (OTP)      <p style="${baseStyles.text}">Mã OTP này sẽ <strong>hết hạn sau 10 phút</strong>.</p>

exports.verificationEmailTemplate = (name, otp) => {      <p style="${baseStyles.text}">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>

  const content = `    </div>

    <div style="${baseStyles.content}">    <div style="${baseStyles.footer}">

      <h2 style="${baseStyles.title}">Xác nhận tài khoản</h2>      <p style="${baseStyles.footerText}"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>

      <p style="${baseStyles.text}">Xin chào <strong>${name}</strong>,</p>      <p style="${baseStyles.footerText}"> ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>

      <p style="${baseStyles.text}">    </div>

        Cảm ơn bạn đã đăng ký tài khoản tại Shoe Shop. Để hoàn tất quá trình đăng ký,   </div>`;

        vui lòng sử dụng mã OTP bên dưới:};

      </p>

      <div style="${baseStyles.codeBox}">module.exports = { verificationEmailTemplate };

        <p style="margin: 0 0 10px 0; font-size: 12px; color: #2C2C2C; letter-spacing: 2px; text-transform: uppercase;">Mã xác nhận</p>
        <div style="${baseStyles.code}">${otp}</div>
      </div>
      <p style="${baseStyles.text}">Mã OTP này sẽ <strong>hết hạn sau 10 phút</strong>.</p>
      <p style="${baseStyles.text}">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
    </div>
  `;
  return createEmailWrapper(content);
};

// Template 2: Reset Password Email
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

// Template 3: General Notification
exports.notificationEmailTemplate = (title, message, actionUrl, actionText) => {
  const content = `
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">${title}</h2>
      <p style="${baseStyles.text}">${message}</p>
      ${
        actionUrl
          ? `
      <div style="${baseStyles.buttonWrapper}">
        <a href="${actionUrl}" style="${baseStyles.button}">${actionText || "Xem chi tiết"}</a>
      </div>
      `
          : ""
      }
    </div>
  `;
  return createEmailWrapper(content);
};

// Template 4: Order Confirmation
exports.orderConfirmationEmailTemplate = (userName, order, frontendUrl) => {
  const orderItemsHtml = order.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #F5F5F5; color: #2C2C2C;">${item.productName}</td>
        <td style="padding: 15px; border-bottom: 1px solid #F5F5F5; text-align: center; color: #2C2C2C; font-weight: 600;">×${item.quantity}</td>
        <td style="padding: 15px; border-bottom: 1px solid #F5F5F5; text-align: right; color: #000000; font-weight: 600;">${item.price.toLocaleString("vi-VN")}đ</td>
      </tr>
    `
    )
    .join("");

  const content = `
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">Đơn hàng ${order.code}</h2>
      <p style="${baseStyles.text}">Xin chào <strong>${userName}</strong>,</p>
      <p style="${baseStyles.text}">Cảm ơn bạn đã đặt hàng tại Shoe Shop. Đơn hàng của bạn đang được chuẩn bị.</p>
      
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
          <tr><td style="color: #2C2C2C; font-size: 15px;">Tổng tiền hàng:</td><td style="text-align: right; color: #2C2C2C; font-size: 15px; font-weight: 600;">${order.subTotal.toLocaleString("vi-VN")}đ</td></tr>
          <tr><td style="color: #2C2C2C; font-size: 15px; padding-top: 10px;">Giảm giá:</td><td style="text-align: right; color: #2C2C2C; font-size: 15px; font-weight: 600; padding-top: 10px;">-${order.discount.toLocaleString("vi-VN")}đ</td></tr>
          <tr><td style="color: #2C2C2C; font-size: 15px; padding-top: 10px;">Phí vận chuyển:</td><td style="text-align: right; color: #2C2C2C; font-size: 15px; font-weight: 600; padding-top: 10px;">${order.shippingFee.toLocaleString("vi-VN")}đ</td></tr>
        </table>
        <hr style="margin: 20px 0; border: none; border-top: 2px solid #2C2C2C;">
        <table style="width: 100%;">
          <tr><td style="color: #000000; font-size: 18px; font-weight: 700; letter-spacing: 1px;">TỔNG THANH TOÁN:</td><td style="text-align: right; color: #000000; font-size: 20px; font-weight: 700;">${order.totalAfterDiscountAndShipping.toLocaleString("vi-VN")}đ</td></tr>
        </table>
      </div>
      
      <h3 style="color: #000000; font-size: 16px; font-weight: 600; margin: 40px 0 20px 0; letter-spacing: 1px; text-transform: uppercase;">Địa chỉ giao hàng</h3>
      <div style="padding: 20px; background-color: #F5F5F5; border-left: 4px solid #000000;">
        <p style="margin: 5px 0; color: #000000; font-weight: 600;">${order.shippingAddress.name} • ${order.shippingAddress.phone}</p>
        <p style="margin: 5px 0; color: #2C2C2C;">${order.shippingAddress.detail}</p>
        <p style="margin: 5px 0; color: #2C2C2C;">${order.shippingAddress.ward}, ${order.shippingAddress.district}, ${order.shippingAddress.province}</p>
      </div>
      
      <div style="${baseStyles.buttonWrapper}">
        <a href="${frontendUrl}/orders/${order._id}" style="${baseStyles.button}">Xem đơn hàng</a>
      </div>
    </div>
  `;
  
  const footer = `
    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">
        Nếu bạn có câu hỏi, vui lòng liên hệ: <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}" style="${baseStyles.footerLink}">${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${baseStyles.footerText}"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${baseStyles.footerText}">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  `;
  
  return `<div style="${baseStyles.container}"><div style="${baseStyles.header}"><h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1><p style="${baseStyles.headerSubtitle}">Premium Footwear</p></div>${content}${footer}</div>`;
};

// Template 5: Promotion Email
exports.promotionEmailTemplate = (title, message, couponCode, imageUrl, ctaUrl, frontendUrl) => {
  const content = `
    ${imageUrl ? `<div style="background-color: #F5F5F5; padding: 0;"><img src="${imageUrl}" alt="Promotion" style="width: 100%; display: block; max-height: 400px; object-fit: cover;"></div>` : ""}
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">${title}</h2>
      <p style="${baseStyles.text}">${message}</p>
      ${
        couponCode
          ? `
      <div style="${baseStyles.codeBox}">
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #2C2C2C; letter-spacing: 2px; text-transform: uppercase;">Mã giảm giá</p>
        <div style="font-size: 28px; font-weight: 700; color: #000000; letter-spacing: 4px; font-family: 'Courier New', monospace;">${couponCode}</div>
      </div>
      `
          : ""
      }
      <div style="${baseStyles.buttonWrapper}">
        <a href="${ctaUrl || frontendUrl}" style="${baseStyles.button}">Mua ngay</a>
      </div>
    </div>
  `;
  
  const footer = `
    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">Bạn nhận được email này vì đã đăng ký nhận thông báo từ Shoe Shop.</p>
      <p style="${baseStyles.footerText}">
        <a href="${frontendUrl}/preferences/notifications" style="${baseStyles.footerLink}">Quản lý tùy chọn</a> • 
        <a href="${frontendUrl}/unsubscribe" style="${baseStyles.footerLink}">Hủy đăng ký</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${baseStyles.footerText}"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${baseStyles.footerText}">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  `;
  
  return `<div style="${baseStyles.container}"><div style="${baseStyles.header}"><h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1><p style="${baseStyles.headerSubtitle}">Premium Footwear</p></div>${content}${footer}</div>`;
};

// Template 6: Newsletter
exports.newsletterEmailTemplate = (title, heroImageUrl, sections, featuredProducts, ctaText, ctaUrl, frontendUrl) => {
  const sectionsHtml = sections
    .map((section) => {
      if (section.type === "text") {
        return `<div style="margin: 30px 0;">${section.heading ? `<h3 style="color: #000000; font-size: 18px; font-weight: 600; margin-bottom: 15px;">${section.heading}</h3>` : ""}<p style="${baseStyles.text}">${section.content}</p></div>`;
      } else if (section.type === "image") {
        return `<div style="margin: 30px 0;"><img src="${section.imageUrl}" alt="${section.alt || "Image"}" style="width: 100%; border: 2px solid #F5F5F5;">${section.caption ? `<p style="font-size: 13px; color: #2C2C2C; margin-top: 10px; text-align: center; font-style: italic;">${section.caption}</p>` : ""}</div>`;
      }
      return "";
    })
    .join("");

  const productsHtml = featuredProducts.length
    ? `<div style="margin: 50px 0;"><h3 style="color: #000000; font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase;">Sản phẩm nổi bật</h3><table style="width: 100%;"><tr>${featuredProducts.map((p, i) => `<td style="width: 50%; padding: 10px;"><div style="border: 2px solid #F5F5F5;"><img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 200px; object-fit: cover;"><div style="padding: 20px; text-align: center;"><p style="font-weight: 600; color: #000000; font-size: 15px; margin: 0 0 10px 0;">${p.name}</p><p style="color: #2C2C2C; font-size: 18px; font-weight: 700; margin: 0 0 15px 0;">${p.price.toLocaleString("vi-VN")}đ</p><a href="${frontendUrl}/products/${p._id}" style="display: inline-block; background-color: #000000; color: #FFFFFF; padding: 10px 20px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border: 2px solid #000000;">Xem ngay</a></div></div></td>${i % 2 === 0 && i < featuredProducts.length - 1 ? "" : ""}`).join("")}</tr></table></div>`
    : "";

  const content = `
    ${heroImageUrl ? `<div style="background-color: #000000; padding: 0;"><img src="${heroImageUrl}" alt="Newsletter" style="width: 100%; max-height: 400px; object-fit: cover;"></div>` : ""}
    <div style="${baseStyles.content}">
      <h2 style="${baseStyles.title}">${title}</h2>
      ${sectionsHtml}
      ${productsHtml}
      ${ctaText && ctaUrl ? `<div style="${baseStyles.buttonWrapper}"><a href="${ctaUrl}" style="${baseStyles.button}">${ctaText}</a></div>` : ""}
    </div>
  `;
  
  const footer = `
    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}"><strong>Theo dõi chúng tôi</strong></p>
      <div style="margin: 15px 0;">
        <a href="#" style="display: inline-block; margin: 0 10px; color: #000000; text-decoration: none; font-weight: 600;">Facebook</a>
        <a href="#" style="display: inline-block; margin: 0 10px; color: #000000; text-decoration: none; font-weight: 600;">Instagram</a>
        <a href="#" style="display: inline-block; margin: 0 10px; color: #000000; text-decoration: none; font-weight: 600;">Twitter</a>
      </div>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${baseStyles.footerText}">Bạn nhận được email này vì đã đăng ký nhận newsletter từ Shoe Shop.</p>
      <p style="${baseStyles.footerText}">
        <a href="${frontendUrl}/preferences/notifications" style="${baseStyles.footerLink}">Quản lý tùy chọn</a> • 
        <a href="${frontendUrl}/unsubscribe" style="${baseStyles.footerLink}">Hủy đăng ký</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #E0E0E0;">
      <p style="${baseStyles.footerText}"><strong>SHOE SHOP</strong><br>Premium Footwear Collection</p>
      <p style="${baseStyles.footerText}">© ${new Date().getFullYear()} Shoe Shop. All rights reserved.</p>
    </div>
  `;
  
  return `<div style="${baseStyles.container}"><div style="${baseStyles.header}"><h1 style="${baseStyles.headerTitle}">SHOE SHOP</h1><p style="${baseStyles.headerSubtitle}">Premium Footwear</p></div>${content}${footer}</div>`;
};

// Helper functions to send emails
exports.sendVerificationEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `"Shoe Shop" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác nhận tài khoản Shoe Shop",
    html: exports.verificationEmailTemplate(name, otp),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new ApiError(500, "Không thể gửi email xác nhận. Vui lòng thử lại!");
  }
};

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
    throw new ApiError(500, "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại!");
  }
};
