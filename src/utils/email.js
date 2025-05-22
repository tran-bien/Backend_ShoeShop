const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const ApiError = require("@utils/ApiError");

dotenv.config();

// Khởi tạo transporter để gửi email
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Gửi email xác nhận đăng ký
exports.sendVerificationEmail = async (email, name, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Xác nhận tài khoản ShoeShop",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Xác nhận tài khoản</h2>
        <p>Xin chào ${name},</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại ShoeShop. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã OTP dưới đây:</p>
        <div style="text-align: center; margin: 20px 0;">
          <div style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f5f5f5; border-radius: 5px; display: inline-block;">${otp}</div>
        </div>
        <p>Mã OTP này sẽ hết hạn sau 10 phút.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        <p>Trân trọng,<br>Đội ngũ ShoeShop</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new ApiError(500, "Không thể gửi email xác nhận. Vui lòng thử lại!");
  }
};

// Gửi email đặt lại mật khẩu
exports.sendResetPasswordEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Đặt lại mật khẩu ShoeShop",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Đặt lại mật khẩu</h2>
        <p>Xin chào ${name},</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản tại ShoeShop. Vui lòng nhấp vào nút bên dưới để thiết lập mật khẩu mới:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Đặt lại mật khẩu</a>
        </div>
        <p>Liên kết này sẽ hết hạn sau 10 phút.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        <p>Trân trọng,<br>Đội ngũ ShoeShop</p>
      </div>
    `,
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
