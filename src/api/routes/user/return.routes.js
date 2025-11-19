const express = require("express");
const router = express.Router();
const returnController = require("@controllers/user/return.controller");
const { protect } = require("@middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateCreateReturnRequest,
  validateGetReturns,
  validateReturnId,
  validateCheckEligibility,
} = require("@validators/return.validator");

/**
 * USER RETURN ROUTES
 * Chỉ dành cho user thao tác với return requests của chính họ
 */

router.use(protect); // Tất cả routes cần đăng nhập

/**
 * @route   GET /api/v1/users/returns/check-eligibility
 * @desc    Kiểm tra sản phẩm có thể đổi hàng không
 * @access  Authenticated User
 * @query   orderId, variantId, sizeId
 */
router.get(
  "/check-eligibility",
  validate(validateCheckEligibility),
  returnController.checkExchangeEligibility
);

/**
 * @route   GET /api/v1/users/returns
 * @desc    Lấy danh sách yêu cầu đổi trả của chính mình
 * @access  Authenticated User
 */
router.get(
  "/",
  validate(validateGetReturns),
  returnController.getReturnRequests
);

/**
 * @route   POST /api/v1/users/returns
 * @desc    Tạo yêu cầu đổi trả
 * @access  Authenticated User
 */
router.post(
  "/",
  validate(validateCreateReturnRequest),
  returnController.createReturnRequest
);

/**
 * @route   GET /api/v1/users/returns/:id
 * @desc    Lấy chi tiết yêu cầu đổi trả của chính mình
 * @access  Authenticated User
 */
router.get(
  "/:id",
  validate(validateReturnId),
  returnController.getReturnRequestDetail
);

/**
 * @route   DELETE /api/v1/users/returns/:id
 * @desc    Hủy yêu cầu đổi trả (chỉ khi còn pending)
 * @access  Authenticated User
 */
router.delete(
  "/:id",
  validate(validateReturnId),
  returnController.cancelReturnRequest
);

module.exports = router;
