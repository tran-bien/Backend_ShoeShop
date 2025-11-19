const express = require("express");
const router = express.Router();
const returnController = require("@controllers/return.controller");
const {
  protect,
  requireStaffOrAdmin,
} = require("@middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateApproveReturn,
  validateRejectReturn,
  validateProcessReturn,
  validateGetReturns,
  validateReturnId,
} = require("@validators/return.validator");

/**
 * ADMIN RETURN ROUTES
 * Chỉ dành cho Admin/Staff quản lý return requests
 */

router.use(protect);
router.use(requireStaffOrAdmin);

/**
 * @route   GET /api/v1/admin/returns/stats/summary
 * @desc    Lấy thống kê đổi trả
 * @access  Staff/Admin
 */
router.get("/stats/summary", returnController.getReturnStats);

/**
 * @route   GET /api/v1/admin/returns
 * @desc    Lấy tất cả yêu cầu đổi trả (admin view)
 * @access  Staff/Admin
 */
router.get(
  "/",
  validate(validateGetReturns),
  returnController.getReturnRequests
);

/**
 * @route   GET /api/v1/admin/returns/:id
 * @desc    Lấy chi tiết yêu cầu đổi trả
 * @access  Staff/Admin
 */
router.get(
  "/:id",
  validate(validateReturnId),
  returnController.getReturnRequestDetail
);

/**
 * @route   PATCH /api/v1/admin/returns/:id/approve
 * @desc    Phê duyệt yêu cầu đổi trả
 * @access  Staff/Admin
 */
router.patch(
  "/:id/approve",
  validate(validateApproveReturn),
  returnController.approveReturnRequest
);

/**
 * @route   PATCH /api/v1/admin/returns/:id/reject
 * @desc    Từ chối yêu cầu đổi trả
 * @access  Staff/Admin
 */
router.patch(
  "/:id/reject",
  validate(validateRejectReturn),
  returnController.rejectReturnRequest
);

/**
 * @route   POST /api/v1/admin/returns/:id/process-return
 * @desc    Xử lý hoàn trả
 * @access  Staff/Admin
 */
router.post(
  "/:id/process-return",
  validate(validateProcessReturn),
  returnController.processReturn
);

/**
 * @route   POST /api/v1/admin/returns/:id/process-exchange
 * @desc    Xử lý đổi hàng
 * @access  Staff/Admin
 */
router.post(
  "/:id/process-exchange",
  validate(validateProcessReturn),
  returnController.processExchange
);

module.exports = router;
