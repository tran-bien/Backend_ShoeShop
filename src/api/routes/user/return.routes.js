const express = require("express");
const router = express.Router();
const returnController = require("@controllers/user/return.controller");
const { protect } = require("@middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateCreateReturnRequest,
  validateGetReturns,
  validateReturnId,
} = require("@validators/return.validator");

/**
 * USER RETURN ROUTES
 * Chỉ dành cho user thao tác với yêu cầu trả hàng của chính họ
 * (Đã loại bỏ logic đổi hàng - chỉ có trả hàng/hoàn tiền)
 */

router.use(protect); // Tất cả routes cần đăng nhập

/**
 * @route   GET /api/v1/users/returns
 * @desc    Lấy danh sách yêu cầu trả hàng của chính mình
 * @access  Authenticated User
 */
router.get(
  "/",
  validate(validateGetReturns),
  returnController.getReturnRequests
);

/**
 * @route   POST /api/v1/users/returns
 * @desc    Tạo yêu cầu trả hàng
 * @access  Authenticated User
 */
router.post(
  "/",
  validate(validateCreateReturnRequest),
  returnController.createReturnRequest
);

/**
 * @route   GET /api/v1/users/returns/:id
 * @desc    Lấy chi tiết yêu cầu trả hàng của chính mình
 * @access  Authenticated User
 */
router.get(
  "/:id",
  validate(validateReturnId),
  returnController.getReturnRequestDetail
);

/**
 * @route   DELETE /api/v1/users/returns/:id
 * @desc    Hủy yêu cầu trả hàng (chỉ khi còn pending)
 * @access  Authenticated User
 */
router.delete(
  "/:id",
  validate(validateReturnId),
  returnController.cancelReturnRequest
);

module.exports = router;
