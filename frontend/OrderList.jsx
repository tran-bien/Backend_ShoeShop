import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Button,
  Form,
  Pagination,
  Spinner,
} from "react-bootstrap";

const OrderList = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({});

  // Bộ lọc
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("");
  const [perPage, setPerPage] = useState(10);

  // Lấy danh sách đơn hàng
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);

        // Xây dựng query params
        let params = new URLSearchParams();
        params.append("page", currentPage);
        params.append("limit", perPage);

        if (selectedStatus) {
          params.append("status", selectedStatus);
        }

        if (selectedPaymentStatus) {
          params.append("paymentStatus", selectedPaymentStatus);
        }

        const { data } = await axios.get(`/api/orders?${params.toString()}`);

        setOrders(data.orders);
        setTotalPages(data.totalPages);
        setStatusCounts(data.statusCounts || {});
        setLoading(false);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Có lỗi xảy ra khi tải danh sách đơn hàng"
        );
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentPage, selectedStatus, selectedPaymentStatus, perPage]);

  // Xử lý chuyển trang
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = () => {
    setCurrentPage(1); // Reset về trang 1 khi thay đổi bộ lọc
  };

  // Xử lý chuyển đến trang chi tiết đơn hàng
  const handleViewOrder = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  // Hiển thị trang đang tải
  if (loading && currentPage === 1) {
    return (
      <Container className="py-5 d-flex justify-content-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  // Hiển thị thông báo lỗi nếu có
  if (error && currentPage === 1) {
    return (
      <Container className="py-5">
        <div className="alert alert-danger">{error}</div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">Đơn hàng của tôi</h2>

      {/* Thống kê trạng thái đơn hàng */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Row>
                <Col xs={4} md={2} className="text-center border-end">
                  <h5>{statusCounts.total || 0}</h5>
                  <p className="text-muted mb-0">Tất cả</p>
                </Col>
                <Col xs={4} md={2} className="text-center border-end">
                  <h5>{statusCounts.pending || 0}</h5>
                  <p className="text-muted mb-0">Chờ xác nhận</p>
                </Col>
                <Col xs={4} md={2} className="text-center border-end">
                  <h5>{statusCounts.confirmed || 0}</h5>
                  <p className="text-muted mb-0">Đã xác nhận</p>
                </Col>
                <Col xs={4} md={2} className="text-center border-end">
                  <h5>{statusCounts.shipping || 0}</h5>
                  <p className="text-muted mb-0">Đang giao</p>
                </Col>
                <Col xs={4} md={2} className="text-center border-end">
                  <h5>{statusCounts.delivered || 0}</h5>
                  <p className="text-muted mb-0">Đã giao</p>
                </Col>
                <Col xs={4} md={2} className="text-center">
                  <h5>{statusCounts.cancelled || 0}</h5>
                  <p className="text-muted mb-0">Đã hủy</p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Bộ lọc đơn hàng */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Trạng thái đơn hàng</Form.Label>
                <Form.Select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    handleFilterChange();
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ xác nhận</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="shipping">Đang giao hàng</option>
                  <option value="delivered">Đã giao hàng</option>
                  <option value="cancelled">Đã hủy</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Trạng thái thanh toán</Form.Label>
                <Form.Select
                  value={selectedPaymentStatus}
                  onChange={(e) => {
                    setSelectedPaymentStatus(e.target.value);
                    handleFilterChange();
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ thanh toán</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="failed">Thanh toán thất bại</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Số đơn hàng mỗi trang</Form.Label>
                <Form.Select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    handleFilterChange();
                  }}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Danh sách đơn hàng */}
      {orders.length === 0 ? (
        <Card className="shadow-sm">
          <Card.Body className="text-center py-5">
            <h5>Không tìm thấy đơn hàng nào</h5>
            <p className="text-muted">
              Bạn chưa có đơn hàng nào hoặc không có đơn hàng nào phù hợp với bộ
              lọc đã chọn.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <Card.Body className="p-0">
            <Table responsive hover className="m-0">
              <thead className="bg-light">
                <tr>
                  <th>Mã đơn hàng</th>
                  <th>Ngày đặt</th>
                  <th>Tổng tiền</th>
                  <th>Phương thức thanh toán</th>
                  <th>Trạng thái đơn hàng</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>{order.orderCode}</td>
                    <td>
                      {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td>{order.totalAmount.toLocaleString("vi-VN")}đ</td>
                    <td>{order.paymentMethod}</td>
                    <td>
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
                    </td>
                    <td>
                      <Badge
                        bg={
                          order.paymentStatus === "paid"
                            ? "success"
                            : order.paymentStatus === "pending"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {order.paymentStatus === "paid"
                          ? "Đã thanh toán"
                          : order.paymentStatus === "pending"
                          ? "Chờ thanh toán"
                          : "Thanh toán thất bại"}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleViewOrder(order._id)}
                      >
                        Xem chi tiết
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-4">
          <Pagination>
            <Pagination.First
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            />
            <Pagination.Prev
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            />

            {[...Array(totalPages).keys()].map((page) => {
              // Hiển thị tối đa 5 trang gần nhất với trang hiện tại
              if (
                page + 1 === currentPage ||
                page + 1 === currentPage - 1 ||
                page + 1 === currentPage - 2 ||
                page + 1 === currentPage + 1 ||
                page + 1 === currentPage + 2
              ) {
                return (
                  <Pagination.Item
                    key={page + 1}
                    active={page + 1 === currentPage}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    {page + 1}
                  </Pagination.Item>
                );
              }
              return null;
            })}

            <Pagination.Next
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            />
            <Pagination.Last
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            />
          </Pagination>
        </div>
      )}
    </Container>
  );
};

export default OrderList;
