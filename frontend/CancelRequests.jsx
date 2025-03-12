import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Table,
  Badge,
  Button,
  Form,
  Pagination,
  Spinner,
  Alert,
} from "react-bootstrap";

const CancelRequests = () => {
  const navigate = useNavigate();
  const [cancelRequests, setCancelRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("");

  // Lấy danh sách yêu cầu hủy đơn
  useEffect(() => {
    const fetchCancelRequests = async () => {
      try {
        setLoading(true);

        let url = `/api/orders/my-cancel-requests?page=${currentPage}&limit=10`;
        if (selectedStatus) {
          url += `&status=${selectedStatus}`;
        }

        const { data } = await axios.get(url);

        setCancelRequests(data.cancelRequests);
        setTotalPages(data.totalPages);
        setLoading(false);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Có lỗi xảy ra khi tải danh sách yêu cầu hủy đơn"
        );
        setLoading(false);
      }
    };

    fetchCancelRequests();
  }, [currentPage, selectedStatus]);

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
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">Yêu cầu hủy đơn hàng</h2>

      {/* Bộ lọc */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Form.Group>
            <Form.Label>Trạng thái yêu cầu</Form.Label>
            <Form.Select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                handleFilterChange();
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Đang chờ xử lý</option>
              <option value="approved">Đã chấp nhận</option>
              <option value="rejected">Đã từ chối</option>
            </Form.Select>
          </Form.Group>
        </Card.Body>
      </Card>

      {/* Danh sách yêu cầu hủy đơn */}
      {cancelRequests.length === 0 ? (
        <Card className="shadow-sm">
          <Card.Body className="text-center py-5">
            <h5>Không tìm thấy yêu cầu hủy đơn hàng nào</h5>
            <p className="text-muted">
              Bạn chưa gửi yêu cầu hủy đơn hàng nào hoặc không có yêu cầu nào
              phù hợp với bộ lọc đã chọn.
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
                  <th>Ngày yêu cầu</th>
                  <th>Lý do</th>
                  <th>Trạng thái yêu cầu</th>
                  <th>Phản hồi</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {cancelRequests.map((request) => (
                  <tr key={request._id}>
                    <td>{request.orderId?.orderCode || "N/A"}</td>
                    <td>
                      {new Date(request.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td>
                      <div
                        style={{
                          maxWidth: "250px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {request.reason}
                      </div>
                    </td>
                    <td>
                      <Badge
                        bg={
                          request.status === "approved"
                            ? "success"
                            : request.status === "rejected"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {request.status === "pending"
                          ? "Đang chờ xử lý"
                          : request.status === "approved"
                          ? "Đã chấp nhận"
                          : request.status === "rejected"
                          ? "Đã từ chối"
                          : request.status}
                      </Badge>
                    </td>
                    <td>
                      <div
                        style={{
                          maxWidth: "250px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {request.adminFeedback || "Chưa có phản hồi"}
                      </div>
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleViewOrder(request.orderId?._id)}
                      >
                        Xem đơn hàng
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

export default CancelRequests;
