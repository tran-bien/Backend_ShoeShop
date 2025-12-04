/**
 * Seed Knowledge Base Documents for AI Chat
 * Run: node seed-knowledge.js
 */
require("module-alias/register");
const mongoose = require("mongoose");
const KnowledgeDocument = require("./src/models/knowledgeDocument");
require("dotenv").config();

const knowledgeDocuments = [
  // FAQ - General
  {
    category: "faq",
    title: "Chào hỏi và giới thiệu",
    content: `ShoeStore là cửa hàng giày trực tuyến uy tín hàng đầu Việt Nam. 
Chúng tôi chuyên cung cấp các sản phẩm giày thể thao, giày công sở, sandal, dép từ các thương hiệu nổi tiếng như Nike, Adidas, Puma, Converse, Vans, New Balance.
Địa chỉ: 123 Nguyễn Văn Linh, Quận 7, TP.HCM
Hotline: 1900 xxxx (8h-22h hàng ngày)
Email: support@shoestore.vn
Website: shoestore.vn`,
    tags: [
      "xin chào",
      "hello",
      "hi",
      "giới thiệu",
      "cửa hàng",
      "shop",
      "địa chỉ",
      "liên hệ",
    ],
    priority: 10,
    isActive: true,
  },
  {
    category: "faq",
    title: "Cách đặt hàng",
    content: `Để đặt hàng tại ShoeStore, bạn có thể thực hiện theo các bước sau:
1. Truy cập website shoestore.vn
2. Chọn sản phẩm yêu thích, chọn size và màu sắc
3. Nhấn "Thêm vào giỏ hàng"
4. Vào giỏ hàng để kiểm tra và tiến hành thanh toán
5. Điền thông tin giao hàng và chọn phương thức thanh toán
6. Xác nhận đơn hàng

Bạn cũng có thể đặt hàng qua hotline 1900 xxxx hoặc chat với nhân viên hỗ trợ.`,
    tags: ["đặt hàng", "mua hàng", "order", "cách mua", "hướng dẫn"],
    priority: 9,
    isActive: true,
  },
  // Policy - Shipping
  {
    category: "policy",
    title: "Chính sách vận chuyển",
    content: `CHÍNH SÁCH VẬN CHUYỂN:
- Miễn phí vận chuyển cho đơn hàng từ 500.000đ
- Đơn hàng dưới 500.000đ: phí ship 30.000đ (nội thành) - 40.000đ (ngoại thành)
- Thời gian giao hàng: 2-3 ngày (nội thành), 3-5 ngày (tỉnh khác)
- Kiểm tra hàng trước khi thanh toán (COD)
- Giao hàng toàn quốc qua các đơn vị: Giao Hàng Nhanh, GHTK, J&T Express

Lưu ý: Thời gian giao hàng có thể thay đổi vào các ngày lễ, Tết.`,
    tags: [
      "vận chuyển",
      "giao hàng",
      "ship",
      "phí ship",
      "thời gian giao",
      "free ship",
    ],
    priority: 8,
    isActive: true,
  },
  // Policy - Return
  {
    category: "policy",
    title: "Chính sách đổi trả",
    content: `CHÍNH SÁCH ĐỔI TRẢ:
- Thời hạn đổi trả: 7 ngày kể từ ngày nhận hàng
- Điều kiện đổi trả:
  + Sản phẩm còn nguyên tem, nhãn mác, chưa qua sử dụng
  + Có hóa đơn mua hàng
  + Sản phẩm không bị hư hỏng do người dùng
- Các trường hợp được đổi/trả:
  + Sản phẩm lỗi từ nhà sản xuất
  + Giao sai size, sai màu, sai mẫu
  + Sản phẩm không đúng mô tả
- Phí đổi trả: MIỄN PHÍ nếu lỗi từ shop, khách chịu phí ship 2 chiều nếu đổi ý

Để đổi trả, vui lòng liên hệ hotline 1900 xxxx hoặc gửi yêu cầu qua mục "Đơn hàng của tôi".`,
    tags: ["đổi trả", "hoàn tiền", "trả hàng", "đổi size", "bảo hành", "lỗi"],
    priority: 8,
    isActive: true,
  },
  // Policy - Payment
  {
    category: "policy",
    title: "Phương thức thanh toán",
    content: `CÁC PHƯƠNG THỨC THANH TOÁN:
1. Thanh toán khi nhận hàng (COD)
   - Trả tiền mặt cho shipper khi nhận hàng
   - Được kiểm tra hàng trước khi thanh toán
   
2. Chuyển khoản ngân hàng
   - Ngân hàng Vietcombank: 0123456789 - NGUYEN VAN A
   - Ngân hàng Techcombank: 9876543210 - NGUYEN VAN A
   - Ghi nội dung: [Họ tên] - [Số điện thoại]
   
3. Ví điện tử VNPAY
   - Quét mã QR khi thanh toán
   - Hỗ trợ các ngân hàng nội địa
   
4. Thẻ tín dụng/Debit (Visa, Mastercard)
   - Thanh toán an toàn qua cổng VNPAY`,
    tags: [
      "thanh toán",
      "COD",
      "chuyển khoản",
      "VNPAY",
      "thẻ",
      "tiền mặt",
      "payment",
    ],
    priority: 7,
    isActive: true,
  },
  // Size Guide
  {
    category: "how_to_size",
    title: "Hướng dẫn chọn size giày",
    content: `HƯỚNG DẪN CHỌN SIZE GIÀY:

BƯỚC 1: Đo chiều dài bàn chân
- Đặt bàn chân lên tờ giấy trắng
- Dùng bút đánh dấu điểm gót và điểm dài nhất của ngón chân
- Đo khoảng cách giữa 2 điểm (đơn vị cm)

BƯỚC 2: Tra cứu bảng size
Chiều dài (cm) -> Size US -> Size EU
22.5 -> 4 -> 35
23 -> 4.5 -> 35.5
23.5 -> 5 -> 36
24 -> 5.5 -> 37
24.5 -> 6 -> 37.5
25 -> 6.5 -> 38
25.5 -> 7 -> 39
26 -> 7.5 -> 40
26.5 -> 8 -> 41
27 -> 8.5 -> 42
27.5 -> 9 -> 42.5
28 -> 9.5 -> 43
28.5 -> 10 -> 44
29 -> 10.5 -> 44.5
29.5 -> 11 -> 45

LƯU Ý:
- Nên đo chân vào buổi chiều/tối (chân hơi phình)
- Nếu size nằm giữa 2 số, chọn size lớn hơn
- Giày Nike, Adidas thường đúng size, Converse thường rộng hơn 0.5 size`,
    tags: [
      "size",
      "chọn size",
      "đo chân",
      "bảng size",
      "hướng dẫn size",
      "cỡ giày",
    ],
    priority: 9,
    isActive: true,
  },
  // Brand Info
  {
    category: "brand_info",
    title: "Thông tin thương hiệu Nike",
    content: `THƯƠNG HIỆU NIKE:
- Thương hiệu thể thao số 1 thế giới từ Mỹ
- Slogan: "Just Do It"
- Các dòng sản phẩm nổi bật:
  + Air Max: Đệm khí, thoải mái
  + Air Force 1: Classic, đa dụng
  + Jordan: Huyền thoại bóng rổ
  + Dunk: Retro, thời trang
  + Pegasus: Chạy bộ chuyên nghiệp
- Công nghệ:
  + Nike Air: Đệm khí giảm chấn
  + Flyknit: Thân giày dệt nhẹ
  + ZoomX: Foam siêu nhẹ, phản hồi cao`,
    tags: [
      "nike",
      "thương hiệu",
      "air max",
      "jordan",
      "air force",
      "just do it",
    ],
    priority: 6,
    isActive: true,
  },
  {
    category: "brand_info",
    title: "Thông tin thương hiệu Adidas",
    content: `THƯƠNG HIỆU ADIDAS:
- Thương hiệu thể thao hàng đầu từ Đức
- Slogan: "Impossible Is Nothing"
- Các dòng sản phẩm nổi bật:
  + Ultraboost: Công nghệ Boost, êm ái
  + Stan Smith: Classic, tennis
  + Superstar: Icon, shell toe
  + NMD: Streetwear, trẻ trung
  + Yeezy: Collab với Kanye West
- Công nghệ:
  + Boost: Đệm foam phản hồi năng lượng
  + Primeknit: Thân giày dệt co giãn
  + Lightstrike: Đệm nhẹ, ổn định`,
    tags: [
      "adidas",
      "thương hiệu",
      "ultraboost",
      "stan smith",
      "superstar",
      "boost",
    ],
    priority: 6,
    isActive: true,
  },
  // Product Catalog
  {
    category: "product_catalog",
    title: "Danh mục sản phẩm",
    content: `DANH MỤC SẢN PHẨM TẠI SHOESTORE:

1. GIÀY THỂ THAO
   - Giày chạy bộ
   - Giày bóng rổ
   - Giày tennis
   - Giày đá bóng

2. GIÀY THỜI TRANG
   - Sneaker
   - Giày cao gót
   - Giày Oxford
   - Giày loafer

3. DÉP & SANDAL
   - Dép quai ngang
   - Sandal thể thao
   - Dép đi trong nhà

4. THƯƠNG HIỆU:
Nike, Adidas, Puma, Converse, Vans, New Balance, Reebok, Fila, MLB

5. GIÁ:
- Phân khúc phổ thông: 500.000đ - 1.500.000đ
- Phân khúc trung cấp: 1.500.000đ - 3.000.000đ
- Phân khúc cao cấp: trên 3.000.000đ`,
    tags: [
      "danh mục",
      "sản phẩm",
      "giày",
      "dép",
      "sneaker",
      "thể thao",
      "thời trang",
    ],
    priority: 7,
    isActive: true,
  },
];

async function seedKnowledge() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing documents (optional)
    const existingCount = await KnowledgeDocument.countDocuments();
    console.log(`📚 Existing knowledge documents: ${existingCount}`);

    // Insert new documents
    for (const doc of knowledgeDocuments) {
      const existing = await KnowledgeDocument.findOne({ title: doc.title });
      if (existing) {
        // Update existing
        await KnowledgeDocument.updateOne({ _id: existing._id }, doc);
        console.log(`🔄 Updated: ${doc.title}`);
      } else {
        // Insert new
        await KnowledgeDocument.create(doc);
        console.log(`✅ Created: ${doc.title}`);
      }
    }

    const finalCount = await KnowledgeDocument.countDocuments();
    console.log(`\n✨ Total knowledge documents: ${finalCount}`);
    console.log("🎉 Knowledge base seeding completed!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding knowledge:", error);
    process.exit(1);
  }
}

seedKnowledge();
