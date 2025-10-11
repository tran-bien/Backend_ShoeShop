const shipperService = require("../../services/shipper.service");

/**
 * Lấy danh sách shipper
 */
const getShippers = async (req, res, next) => {
  try {
    const { available } = req.query;

    const shippers = await shipperService.getShippers({
      available: available === "true",
    });

    res.status(200).json({
      success: true,
      data: shippers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gán đơn hàng cho shipper
 */
const assignOrderToShipper = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { shipperId } = req.body;

    const result = await shipperService.assignOrderToShipper(
      orderId,
      shipperId
    );

    res.status(200).json({
      success: true,
      message: "Gán đơn hàng cho shipper thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật trạng thái giao hàng
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status, note, images, location } = req.body;
    const shipperId = req.user._id;

    const result = await shipperService.updateDeliveryStatus({
      orderId,
      shipperId,
      status,
      note,
      images,
      location,
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái giao hàng thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách đơn hàng của shipper
 */
const getShipperOrders = async (req, res, next) => {
  try {
    const shipperId = req.user._id;
    const { status } = req.query;

    const orders = await shipperService.getShipperOrders(shipperId, status);

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật vị trí của shipper
 */
const updateShipperLocation = async (req, res, next) => {
  try {
    const shipperId = req.user._id;
    const { latitude, longitude } = req.body;

    const result = await shipperService.updateShipperLocation(shipperId, {
      latitude,
      longitude,
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật vị trí thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê của shipper
 */
const getShipperStats = async (req, res, next) => {
  try {
    const { shipperId } = req.params;

    const stats = await shipperService.getShipperStats(shipperId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật trạng thái sẵn sàng của shipper
 */
const updateAvailability = async (req, res, next) => {
  try {
    const shipperId = req.user._id;
    const { isAvailable } = req.body;

    const result = await shipperService.updateShipperAvailability(
      shipperId,
      isAvailable
    );

    res.status(200).json({
      success: true,
      message: `Đã ${isAvailable ? "bật" : "tắt"} trạng thái sẵn sàng`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thông tin chi tiết shipper
 */
const getShipperDetail = async (req, res, next) => {
  try {
    const { shipperId } = req.params;

    const shipper = await shipperService.getShipperById(shipperId);

    res.status(200).json({
      success: true,
      data: shipper,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShippers,
  assignOrderToShipper,
  updateDeliveryStatus,
  getShipperOrders,
  updateShipperLocation,
  getShipperStats,
  updateAvailability,
  getShipperDetail,
};
