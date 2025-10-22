const returnService = require("../../services/return.service");

/**
 * Tạo yêu cầu đổi trả
 * @access User/Staff/Admin
 */
const createReturnRequest = async (req, res, next) => {
  try {
    const { orderId, items, type, reason, refundMethod, bankInfo } = req.body;
    const customerId = req.user._id;

    const returnRequest = await returnService.createReturnRequest({
      orderId,
      customerId,
      items,
      type,
      reason,
      refundMethod,
      bankInfo,
    });

    res.status(201).json({
      success: true,
      message: "Tạo yêu cầu đổi trả thành công",
      data: returnRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách yêu cầu đổi trả
 * @access User/Staff/Admin
 */
const getReturnRequests = async (req, res, next) => {
  try {
    const { page, limit, status, type, customerId } = req.query;
    const isAdmin = req.user.role === "admin" || req.user.role === "staff";

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      type,
    };

    // Nếu không phải admin, chỉ lấy yêu cầu của chính mình
    if (!isAdmin) {
      filters.customerId = req.user._id;
    } else if (customerId) {
      filters.customerId = customerId;
    }

    const result = await returnService.getReturnRequests(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy chi tiết yêu cầu đổi trả
 */
const getReturnRequestDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const returnRequest = await returnService.getReturnRequestById(id);

    // Kiểm tra quyền xem
    const isAdmin = req.user.role === "admin" || req.user.role === "staff";
    const isOwner =
      returnRequest.customer._id.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem yêu cầu này",
      });
    }

    res.status(200).json({
      success: true,
      data: returnRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Phê duyệt yêu cầu đổi trả
 */
const approveReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const returnRequest = await returnService.approveReturnRequest(id, {
      approvedBy: req.user._id,
      note,
    });

    res.status(200).json({
      success: true,
      message: "Phê duyệt yêu cầu đổi trả thành công",
      data: returnRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Từ chối yêu cầu đổi trả
 */
const rejectReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const returnRequest = await returnService.rejectReturnRequest(id, {
      rejectedBy: req.user._id,
      reason,
    });

    res.status(200).json({
      success: true,
      message: "Từ chối yêu cầu đổi trả",
      data: returnRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xử lý hoàn trả
 */
const processReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await returnService.processReturn(id, {
      processedBy: req.user._id,
      note,
    });

    res.status(200).json({
      success: true,
      message: "Xử lý hoàn trả thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xử lý đổi hàng
 */
const processExchange = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await returnService.processExchange(id, {
      processedBy: req.user._id,
      note,
    });

    res.status(200).json({
      success: true,
      message: "Xử lý đổi hàng thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Hủy yêu cầu đổi trả
 */
const cancelReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const returnRequest = await returnService.cancelReturnRequest(
      id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Hủy yêu cầu đổi trả thành công",
      data: returnRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê đổi trả
 */
const getReturnStats = async (req, res, next) => {
  try {
    const stats = await returnService.getReturnStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReturnRequest,
  getReturnRequests,
  getReturnRequestDetail,
  approveReturnRequest,
  rejectReturnRequest,
  processReturn,
  processExchange,
  cancelReturnRequest,
  getReturnStats,
};
