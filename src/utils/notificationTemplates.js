/**
 * Template cho các loại notification
 * Sử dụng {{variable}} để thay thế động
 */
const templates = {
  ORDER_CONFIRMED: {
    title: "Đơn hàng {{orderCode}} đã được xác nhận",
    message:
      "Đơn hàng của bạn đang được chuẩn bị. Cảm ơn bạn đã mua hàng tại Shop!",
    actionText: "Xem đơn hàng",
    actionUrl: "/orders/{{orderId}}",
  },

  ORDER_SHIPPING: {
    title: "Đơn hàng {{orderCode}} đang được giao",
    message:
      "Shipper đang trên đường giao hàng đến bạn. Vui lòng chú ý điện thoại!",
    actionText: "Theo dõi đơn hàng",
    actionUrl: "/orders/{{orderId}}",
  },

  ORDER_DELIVERED: {
    title: "Đơn hàng {{orderCode}} đã giao thành công",
    message:
      "Cảm ơn bạn đã mua hàng! Đừng quên đánh giá sản phẩm để nhận thêm điểm.",
    actionText: "Đánh giá ngay",
    actionUrl: "/orders/{{orderId}}",
  },

  ORDER_CANCELLED: {
    title: "Đơn hàng {{orderCode}} đã bị hủy",
    message: "Đơn hàng của bạn đã bị hủy. Lý do: {{reason}}",
    actionText: "Xem chi tiết",
    actionUrl: "/orders/{{orderId}}",
  },

  RETURN_APPROVED: {
    title: "Yêu cầu {{type}} đã được chấp nhận",
    message:
      "Yêu cầu {{type}} cho đơn {{orderCode}} đã được duyệt. Vui lòng làm theo hướng dẫn.",
    actionText: "Xem chi tiết",
    actionUrl: "/account/return-requests/{{returnRequestId}}",
  },

  RETURN_REQUEST_APPROVED: {
    title: "Yêu cầu {{type}} đã được chấp nhận",
    message:
      "Yêu cầu đổi/trả hàng #{{returnRequestCode}} đã được chấp nhận. Vui lòng làm theo hướng dẫn.",
    actionText: "Xem chi tiết",
    actionUrl: "/account/return-requests/{{returnRequestId}}",
  },

  RETURN_REQUEST_PROCESSING: {
    title: "Đang xử lý yêu cầu {{type}}",
    message:
      "Chúng tôi đang xử lý yêu cầu #{{returnRequestCode}}. Vui lòng đợi thêm thông tin.",
    actionText: "Xem chi tiết",
    actionUrl: "/account/return-requests/{{returnRequestId}}",
  },

  RETURN_REQUEST_COMPLETED: {
    title: "Hoàn tất {{type}}",
    message: "Yêu cầu #{{returnRequestCode}} đã được xử lý thành công.",
    actionText: "Xem chi tiết",
    actionUrl: "/account/return-requests/{{returnRequestId}}",
  },

  RETURN_REQUEST_REJECTED: {
    title: "Yêu cầu {{type}} bị từ chối",
    message: "Rất tiếc, yêu cầu #{{returnRequestCode}} không được chấp nhận.",
    actionText: "Xem chi tiết",
    actionUrl: "/account/return-requests/{{returnRequestId}}",
  },

  RETURN_REQUEST_CANCELED: {
    title: "Yêu cầu {{type}} đã bị hủy",
    message: "Yêu cầu #{{returnRequestCode}} đã bị hủy.",
    actionText: "Xem chi tiết",
    actionUrl: "/account/return-requests/{{returnRequestId}}",
  },

  RETURN_REJECTED: {
    title: "Yêu cầu đổi/trả hàng bị từ chối",
    message:
      "Yêu cầu đổi/trả cho đơn {{orderCode}} bị từ chối. Lý do: {{reason}}",
    actionText: "Xem chi tiết",
    actionUrl: "/returns/{{returnRequestId}}",
  },

  RETURN_COMPLETED: {
    title: "Đổi/trả hàng hoàn tất",
    message: "Yêu cầu đổi/trả cho đơn {{orderCode}} đã được xử lý xong.",
    actionText: "Xem chi tiết",
    actionUrl: "/returns/{{returnRequestId}}",
  },

  LOYALTY_TIER_UP: {
    title: "Chúc mừng! Bạn đã lên hạng {{tierName}}",
    message:
      "Bạn nhận được ưu đãi: giảm {{discount}}%, tích điểm x{{multiplier}}",
    actionText: "Xem ưu đãi",
    actionUrl: "/loyalty",
  },

  POINTS_EARNED: {
    title: "Bạn nhận được {{points}} điểm",
    message: "{{points}} điểm đã được cộng vào tài khoản. {{description}}",
    actionText: "Xem điểm",
    actionUrl: "/loyalty",
  },

  POINTS_EXPIRE_SOON: {
    title: "{{points}} điểm sắp hết hạn",
    message:
      "{{points}} điểm của bạn sẽ hết hạn vào {{expiryDate}}. Sử dụng ngay!",
    actionText: "Đổi điểm",
    actionUrl: "/loyalty",
  },

  PROMOTION: {
    title: "{{promoTitle}}",
    message: "{{promoMessage}}",
    actionText: "Xem ngay",
    actionUrl: "{{promoUrl}}",
  },

  SYSTEM: {
    title: "{{systemTitle}}",
    message: "{{systemMessage}}",
    actionText: "{{systemActionText}}",
    actionUrl: "{{systemActionUrl}}",
  },
};

/**
 * Render template với data động
 * @param {String} type - Loại notification
 * @param {Object} data - Data để thay thế vào template
 * @returns {Object} - Template đã render
 */
const renderTemplate = (type, data) => {
  const template = templates[type];

  if (!template) {
    return {
      title: "Thông báo",
      message: "Bạn có thông báo mới",
      actionText: "Xem chi tiết",
      actionUrl: "/",
    };
  }

  const rendered = {};

  for (const key in template) {
    let value = template[key];

    // Thay thế {{variable}} bằng giá trị thực
    value = value.replace(/\{\{(\w+)\}\}/g, (match, prop) => {
      return data[prop] !== undefined ? data[prop] : match;
    });

    rendered[key] = value;
  }

  return rendered;
};

/**
 * Generate idempotency key
 */
const generateIdempotencyKey = (type, userId, referenceId) => {
  return `${type}_${userId}_${referenceId || Date.now()}`;
};

module.exports = {
  templates,
  renderTemplate,
  generateIdempotencyKey,
};
