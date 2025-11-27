const ExcelJS = require("exceljs");

/**
 * Excel Template Generator for Knowledge Base
 */
class ExcelTemplateGenerator {
  /**
   * Generate Excel template workbook
   */
  static async generateTemplate() {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Data Entry
    const dataSheet = workbook.addWorksheet("Data Entry", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    });

    // Define columns
    dataSheet.columns = [
      { header: "Category (*)", key: "category", width: 20 },
      { header: "Title (*)", key: "title", width: 40 },
      { header: "Content (*)", key: "content", width: 60 },
      { header: "Tags (phân cách bằng dấu ;)", key: "tags", width: 30 },
      { header: "Priority (1-10)", key: "priority", width: 15 },
      {
        header: "Related Products (IDs, phân cách ;)",
        key: "relatedProducts",
        width: 30,
      },
      {
        header: "Related Categories (IDs, phân cách ;)",
        key: "relatedCategories",
        width: 30,
      },
    ];

    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 25;

    // Add data validation for Category
    dataSheet.dataValidations.add("A2:A10000", {
      type: "list",
      allowBlank: false,
      formulae: ['"product_catalog,policy,faq,brand_info,how_to_size"'],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Invalid Category",
      error: "Please select a valid category from the dropdown list",
    });

    // Add data validation for Priority
    dataSheet.dataValidations.add("E2:E10000", {
      type: "whole",
      operator: "between",
      allowBlank: true,
      formulae: [1, 10],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Invalid Priority",
      error: "Priority must be a number between 1 and 10",
    });

    // Add sample data
    dataSheet.addRows([
      {
        category: "policy",
        title: "Chính sách đổi trả hàng",
        content:
          "Khách hàng có thể đổi trả hàng trong vòng 7 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tem, hộp và chưa qua sử dụng.",
        tags: "đổi trả;bảo hành;chính sách",
        priority: 10,
        relatedProducts: "",
        relatedCategories: "",
      },
      {
        category: "faq",
        title: "Làm thế nào để chọn size giày phù hợp?",
        content:
          "Bạn nên đo chiều dài bàn chân và tham khảo bảng size của từng thương hiệu. Mỗi thương hiệu có bảng size khác nhau, nên kiểm tra kỹ trước khi đặt hàng.",
        tags: "size;hướng dẫn;faq",
        priority: 8,
        relatedProducts: "",
        relatedCategories: "",
      },
      {
        category: "how_to_size",
        title: "Hướng dẫn đo size giày chính xác",
        content:
          "Bước 1: Đặt chân lên tờ giấy A4. Bước 2: Dùng bút đánh dấu điểm dài nhất. Bước 3: Dùng thước đo khoảng cách. Bước 4: Cộng thêm 0.5-1cm để thoải mái. Tham khảo bảng size của từng brand.",
        tags: "size;đo chân;hướng dẫn",
        priority: 9,
        relatedProducts: "",
        relatedCategories: "",
      },
    ]);

    // Sheet 2: Instructions
    this._addInstructionSheet(workbook);

    // Sheet 3: Category Guide
    this._addCategoryGuideSheet(workbook);

    return workbook;
  }

  /**
   * Add instruction sheet
   */
  static _addInstructionSheet(workbook) {
    const instructionSheet = workbook.addWorksheet("Instructions");
    instructionSheet.columns = [
      { header: "Step", key: "step", width: 10 },
      { header: "Description", key: "description", width: 80 },
    ];

    const instructionHeader = instructionSheet.getRow(1);
    instructionHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    instructionHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF70AD47" },
    };

    instructionSheet.addRows([
      {
        step: "1",
        description:
          'Điền thông tin vào sheet "Data Entry". Các cột có dấu (*) là bắt buộc.',
      },
      {
        step: "2",
        description:
          "Category: Chọn từ dropdown (product_catalog, policy, faq, brand_info, how_to_size)",
      },
      {
        step: "3",
        description: "Title: Tiêu đề của knowledge document (tối đa 200 ký tự)",
      },
      {
        step: "4",
        description: "Content: Nội dung chi tiết (tối đa 5000 ký tự)",
      },
      {
        step: "5",
        description:
          "Tags: Các tag phân cách bằng dấu ; (ví dụ: giày;thể thao;nam)",
      },
      {
        step: "6",
        description:
          "Priority: Độ ưu tiên từ 1-10, số càng cao càng quan trọng (mặc định là 1)",
      },
      {
        step: "7",
        description:
          "Related Products/Categories: ID của sản phẩm/danh mục liên quan, phân cách bằng dấu ;",
      },
      {
        step: "8",
        description: "Sau khi điền xong, save file và upload lên hệ thống",
      },
      {
        step: "9",
        description: "Hệ thống sẽ validate dữ liệu trước khi import",
      },
    ]);
  }

  /**
   * Add category guide sheet
   */
  static _addCategoryGuideSheet(workbook) {
    const categorySheet = workbook.addWorksheet("Category Guide");
    categorySheet.columns = [
      { header: "Category", key: "category", width: 20 },
      { header: "Description", key: "description", width: 60 },
      { header: "Example", key: "example", width: 40 },
    ];

    const categoryHeader = categorySheet.getRow(1);
    categoryHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    categoryHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC000" },
    };

    categorySheet.addRows([
      {
        category: "product_catalog",
        description: "Thông tin về danh mục sản phẩm, giới thiệu các dòng giày",
        example: "Giày chạy bộ Nike Air Zoom, Giày sneaker Adidas Ultraboost",
      },
      {
        category: "policy",
        description:
          "Các chính sách của cửa hàng: đổi trả, bảo hành, thanh toán, vận chuyển",
        example: "Chính sách đổi trả 7 ngày, Chính sách bảo hành 6 tháng",
      },
      {
        category: "faq",
        description: "Câu hỏi thường gặp từ khách hàng",
        example: "Làm sao để chọn size giày? Thời gian giao hàng bao lâu?",
      },
      {
        category: "brand_info",
        description: "Thông tin về các thương hiệu giày",
        example: "Lịch sử thương hiệu Nike, Đặc điểm giày Adidas",
      },
      {
        category: "how_to_size",
        description: "Hướng dẫn chọn size giày, đo chân, bảng size",
        example: "Cách đo size chân, Bảng size Nike, Chọn size giày cho trẻ em",
      },
    ]);
  }
}

module.exports = ExcelTemplateGenerator;
