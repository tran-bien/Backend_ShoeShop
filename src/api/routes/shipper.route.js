const express = require("express");
const router = express.Router();
const shipperController = require("../controllers/shipper.controller");
const {
  protect,
  requireStaffOrAdmin,
  requireShipper,
} = require("../middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateAssignOrder,
  validateUpdateDeliveryStatus,
  validateUpdateLocation,
  validateUpdateAvailability,
  validateGetShippers,
  validateGetShipperOrders,
  validateShipperId,
} = require("../validators/shipper.validator");

/**
 * ADMIN ROUTES
 */

/**
 * @route   GET /api/shipper/list
 * @desc    Lấy danh sách shipper (Admin)
 * @access  Staff/Admin
 */
router.get(
  "/list",
  protect,
  requireStaffOrAdmin,
  validate(validateGetShippers),
  shipperController.getShippers
);

/**
 * @route   POST /api/shipper/assign/:orderId
 * @desc    Gán đơn hàng cho shipper (Admin)
 * @access  Staff/Admin
 */
router.post(
  "/assign/:orderId",
  protect,
  requireStaffOrAdmin,
  validate(validateAssignOrder),
  shipperController.assignOrderToShipper
);

/**
 * @route   GET /api/shipper/stats/:shipperId
 * @desc    Lấy thống kê của shipper (Admin)
 * @access  Staff/Admin
 */
router.get(
  "/stats/:shipperId",
  protect,
  requireStaffOrAdmin,
  validate(validateShipperId),
  shipperController.getShipperStats
);

/**
 * @route   GET /api/shipper/detail/:shipperId
 * @desc    Lấy thông tin chi tiết shipper (Admin)
 * @access  Staff/Admin
 */
router.get(
  "/detail/:shipperId",
  protect,
  requireStaffOrAdmin,
  validate(validateShipperId),
  shipperController.getShipperDetail
);

/**
 * SHIPPER ROUTES
 */

/**
 * @route   GET /api/shipper/my-orders
 * @desc    Lấy danh sách đơn hàng của shipper
 * @access  Shipper
 */
router.get(
  "/my-orders",
  protect,
  requireShipper,
  validate(validateGetShipperOrders),
  shipperController.getShipperOrders
);

/**
 * @route   PATCH /api/shipper/delivery-status/:orderId
 * @desc    Cập nhật trạng thái giao hàng
 * @access  Shipper
 */
router.patch(
  "/delivery-status/:orderId",
  protect,
  requireShipper,
  validate(validateUpdateDeliveryStatus),
  shipperController.updateDeliveryStatus
);

/**
 * @route   PATCH /api/shipper/location
 * @desc    Cập nhật vị trí của shipper
 * @access  Shipper
 */
router.patch(
  "/location",
  protect,
  requireShipper,
  validate(validateUpdateLocation),
  shipperController.updateShipperLocation
);

/**
 * @route   PATCH /api/shipper/availability
 * @desc    Cập nhật trạng thái sẵn sàng
 * @access  Shipper
 */
router.patch(
  "/availability",
  protect,
  requireShipper,
  validate(validateUpdateAvailability),
  shipperController.updateAvailability
);

module.exports = router;
