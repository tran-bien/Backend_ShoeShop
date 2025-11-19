const express = require("express");
const router = express.Router();
const shipperController = require("@controllers/shipper/shipper.controller");
const { protect, requireShipper } = require("@middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateUpdateDeliveryStatus,
  validateUpdateAvailability,
  validateGetShipperOrders,
} = require("@validators/shipper.validator");

/**
 * SHIPPER ROUTES
 * Cho shipper quản lý đơn hàng được gán và cập nhật trạng thái giao hàng
 */

router.use(protect);
router.use(requireShipper);

/**
 * @route   GET /api/v1/shipper/my-orders
 * @desc    Lấy danh sách đơn hàng của shipper
 * @access  Shipper
 */
router.get(
  "/my-orders",
  validate(validateGetShipperOrders),
  shipperController.getShipperOrders
);

/**
 * @route   PATCH /api/v1/shipper/delivery-status/:orderId
 * @desc    Cập nhật trạng thái giao hàng
 * @access  Shipper
 */
router.patch(
  "/delivery-status/:orderId",
  validate(validateUpdateDeliveryStatus),
  shipperController.updateDeliveryStatus
);

/**
 * @route   PATCH /api/v1/shipper/availability
 * @desc    Cập nhật trạng thái sẵn sàng
 * @access  Shipper
 */
router.patch(
  "/availability",
  validate(validateUpdateAvailability),
  shipperController.updateAvailability
);

module.exports = router;
