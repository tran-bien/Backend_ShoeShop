import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Modal,
  Form,
  Table,
  Alert,
  Spinner,
} from "react-bootstrap";

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State cho modal yêu cầu hủy đơn
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // State cho thanh toán lại
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState(null);

  // Lấy thông tin đơn hàng
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/orders/${id}`);
        setOrder(data.order);
        setLoading(false);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Có lỗi xảy ra khi tải thông tin đơn hàng"
        );
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id]);

  // Xử lý yêu cầu hủy đơn
  const handleCancelRequest = async () => {
    if (!cancelReason.trim()) {
      setCancelError("Vui lòng nhập lý do hủy đơn hàng");
      return;
    }

    try {
      setCancelLoading(true);
      setCancelError(null);

      const { data } = await axios.post(`/api/orders/${id}/cancel`, {
        reason: cancelReason,
      });

      // Cập nhật UI sau khi gửi yêu cầu hủy đơn thành công
      setShowCancelModal(false);
      setCancelReason("");

      // Hiển thị thông báo thành công và cập nhật thông tin đơn hàng
      alert(data.message || "Yêu cầu hủy đơn hàng đã được gửi thành công");

      // Làm mới thông tin đơn hàng
      const { data: orderData } = await axios.get(`/api/orders/${id}`);
      setOrder(orderData.order);

      setCancelLoading(false);
    } catch (err) {
      setCancelError(
        err.response?.data?.message || "Có lỗi xảy ra khi gửi yêu cầu hủy đơn"
      );
      setCancelLoading(false);
    }
  };

  // Xử lý thanh toán lại
  const handleRetryPayment = async () => {
    try {
      setRetryLoading(true);
      setRetryError(null);

      const { data } = await axios.post("/api/payments/retry", {
        orderId: id,
      });

      // Chuyển hướng đến trang thanh toán VNPay
      if (data.success && data.data.paymentUrl) {
        window.location.href = data.data.paymentUrl;
      } else {
        throw new Error("Không thể tạo URL thanh toán");
      }

      setRetryLoading(false);
    } catch (err) {
      setRetryError(
        err.response?.data?.message || "Có lỗi xảy ra khi tạo thanh toán lại"
      );
      setRetryLoading(false);
    }
  };

  // Hiển thị spinner khi đang tải
  if (loading) {
    return (
      <Container className="py-5 d-flex justify-content-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  // Hiển thị lỗi nếu có
  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  // Nếu không tìm thấy đơn hàng
  if (!order) {
    return (
      <Container className="py-5">
        <Alert variant="warning">Không tìm thấy thông tin đơn hàng</Alert>
      </Container>
    );
  }

  // Kiểm tra đơn hàng có thể hủy không (pending hoặc confirmed)
  const canCancel = order.status === "pending" || order.status === "confirmed";

  // Kiểm tra có thể thanh toán lại không (VNPAY + status pending hoặc payment_status failed)
  const canRetryPayment =
    order.paymentMethod === "VNPAY" &&
    (order.status === "pending" || order.paymentStatus === "failed");

  return (
    <Container className="py-4">
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">Chi tiết đơn hàng #{order.orderCode}</h4>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h5>Thông tin đơn hàng</h5>
              <p>
                <strong>Ngày đặt:</strong>{" "}
                {new Date(order.createdAt).toLocaleDateString("vi-VN")}
              </p>
              <p>
                <strong>Trạng thái đơn hàng:</strong>
                <Badge
                  bg={
                    order.status === "delivered"
                      ? "success"
                      : order.status === "shipping"
                      ? "info"
                      : order.status === "confirmed"
                      ? "primary"
                      : order.status === "cancelled"
                      ? "danger"
                      : "warning"
                  }
                  className="ms-2"
                >
                  {order.status === "pending"
                    ? "Chờ xác nhận"
                    : order.status === "confirmed"
                    ? "Đã xác nhận"
                    : order.status === "shipping"
                    ? "Đang giao hàng"
                    : order.status === "delivered"
                    ? "Đã giao hàng"
                    : order.status === "cancelled"
                    ? "Đã hủy"
                    : order.status}
                </Badge>
              </p>
              <p>
                <strong>Trạng thái thanh toán:</strong>
                <Badge
                  bg={
                    order.paymentStatus === "paid"
                      ? "success"
                      : order.paymentStatus === "pending"
                      ? "warning"
                      : "danger"
                  }
                  className="ms-2"
                >
                  {order.paymentStatus === "paid"
                    ? "Đã thanh toán"
                    : order.paymentStatus === "pending"
                    ? "Chờ thanh toán"
                    : "Thanh toán thất bại"}
                </Badge>
              </p>
              <p>
                <strong>Phương thức thanh toán:</strong> {order.paymentMethod}
              </p>
              <p>
                <strong>Tổng tiền:</strong>{" "}
                {order.totalAmount.toLocaleString("vi-VN")}đ
              </p>
            </Col>
            <Col md={6}>
              <h5>Địa chỉ giao hàng</h5>
              <p>
                <strong>Người nhận:</strong> {order.shippingAddress.fullName}
              </p>
              <p>
                <strong>Số điện thoại:</strong> {order.shippingAddress.phone}
              </p>
              <p>
                <strong>Địa chỉ:</strong> {order.shippingAddress.address},{" "}
                {order.shippingAddress.ward}, {order.shippingAddress.district},{" "}
                {order.shippingAddress.province}
              </p>
            </Col>
          </Row>

          <hr />

          <h5>Sản phẩm đã đặt</h5>
          <Table responsive striped hover className="mt-3">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Màu sắc</th>
                <th>Kích cỡ</th>
                <th>Đơn giá</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.orderItems.map((item, index) => (
                <tr key={index}>
                  <td>{item.productName}</td>
                  <td>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        backgroundColor: item.color.code,
                        display: "inline-block",
                        marginRight: "5px",
                        border: "1px solid #ddd",
                      }}
                    ></div>
                    {item.color.name}
                  </td>
                  <td>{item.size.name}</td>
                  <td>{item.price.toLocaleString("vi-VN")}đ</td>
                  <td>{item.quantity}</td>
                  <td>
                    {(item.price * item.quantity).toLocaleString("vi-VN")}đ
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Hiển thị các nút thao tác dựa trên trạng thái */}
          <div className="d-flex justify-content-between mt-4">
            <Button variant="secondary" onClick={() => navigate("/orders")}>
              Quay lại danh sách đơn hàng
            </Button>

            <div>
              {canCancel && (
                <Button
                  variant="outline-danger"
                  className="me-2"
                  onClick={() => setShowCancelModal(true)}
                >
                  Gửi yêu cầu hủy đơn
                </Button>
              )}

              {canRetryPayment && (
                <Button
                  variant="primary"
                  onClick={handleRetryPayment}
                  disabled={retryLoading}
                >
                  {retryLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : null}{" "}
                  Thanh toán lại
                </Button>
              )}
            </div>
          </div>

          {retryError && (
            <Alert variant="danger" className="mt-3">
              {retryError}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Modal xác nhận hủy đơn */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Yêu cầu hủy đơn hàng</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Vui lòng nhập lý do bạn muốn hủy đơn hàng này:</p>
          <Form.Group>
            <Form.Control
              as="textarea"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ví dụ: Tôi muốn thay đổi sản phẩm, Tôi đặt nhầm sản phẩm, v.v."
            />
          </Form.Group>
          {cancelError && (
            <Alert variant="danger" className="mt-3">
              {cancelError}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            Đóng
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelRequest}
            disabled={cancelLoading}
          >
            {cancelLoading ? <Spinner animation="border" size="sm" /> : null}{" "}
            Gửi yêu cầu hủy
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default OrderDetail;
