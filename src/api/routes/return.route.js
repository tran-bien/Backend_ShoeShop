const express = require("express");
const router = express.Router();
const returnController = require("../controllers/return.controller");
const {
  protect,
  requireStaffOrAdmin,
  isAuthenticated,
} = require("../middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateCreateReturnRequest,
  validateApproveReturn,
  validateRejectReturn,
  validateProcessReturn,
  validateGetReturns,
  validateReturnId,
} = require("../validators/return.validator");

/**
 * CUSTOMER ROUTES (Authenticated Users)
 */

/**
 * @route   POST /api/v1/returns
 * @desc    Tạo yêu cầu đổi trả
 * @access  Authenticated
 */
router.post(
  "/",
  protect,
  isAuthenticated,
  validate(validateCreateReturnRequest),
  returnController.createReturnRequest
);

/**
 * ADMIN ROUTES - Đặt các route cụ thể lên trước để tránh conflict với /:id
 */

/**
 * @route   GET /api/v1/returns/stats/summary
 * @desc    Lấy thống kê đổi trả
 * @access  Staff/Admin
 */
router.get(
  "/stats/summary",
  protect,
  requireStaffOrAdmin,
  returnController.getReturnStats
);

/**
 * CUSTOMER ROUTES - Routes chung cho cả User và Admin
 */

/**
 * @route   GET /api/v1/returns
 * @desc    Lấy danh sách yêu cầu đổi trả (của chính mình hoặc tất cả nếu là admin)
 * @access  Authenticated
 */
router.get(
  "/",
  protect,
  isAuthenticated,
  validate(validateGetReturns),
  returnController.getReturnRequests
);

/**
 * @route   GET /api/v1/returns/:id
 * @desc    Lấy chi tiết yêu cầu đổi trả
 * @access  Authenticated
 */
router.get(
  "/:id",
  protect,
  isAuthenticated,
  validate(validateReturnId),
  returnController.getReturnRequestDetail
);

/**
 * @route   DELETE /api/v1/returns/:id
 * @desc    Hủy yêu cầu đổi trả (chỉ khi còn pending)
 * @access  Authenticated
 */
router.delete(
  "/:id",
  protect,
  isAuthenticated,
  validate(validateReturnId),
  returnController.cancelReturnRequest
);

/**
 * ADMIN ROUTES - Routes chỉ dành cho Admin/Staff
 */

/**
 * @route   PATCH /api/v1/returns/:id/approve
 * @desc    Phê duyệt yêu cầu đổi trả
 * @access  Staff/Admin
 */
router.patch(
  "/:id/approve",
  protect,
  requireStaffOrAdmin,
  validate(validateApproveReturn),
  returnController.approveReturnRequest
);

/**
 * @route   PATCH /api/v1/returns/:id/reject
 * @desc    Từ chối yêu cầu đổi trả
 * @access  Staff/Admin
 */
router.patch(
  "/:id/reject",
  protect,
  requireStaffOrAdmin,
  validate(validateRejectReturn),
  returnController.rejectReturnRequest
);

/**
 * @route   POST /api/v1/returns/:id/process-return
 * @desc    Xử lý hoàn trả
 * @access  Staff/Admin
 */
router.post(
  "/:id/process-return",
  protect,
  requireStaffOrAdmin,
  validate(validateProcessReturn),
  returnController.processReturn
);

/**
 * @route   POST /api/v1/returns/:id/process-exchange
 * @desc    Xử lý đổi hàng
 * @access  Staff/Admin
 */
router.post(
  "/:id/process-exchange",
  protect,
  requireStaffOrAdmin,
  validate(validateProcessReturn),
  returnController.processExchange
);

module.exports = router;
