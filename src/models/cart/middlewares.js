const mongoose = require("mongoose");
const cartSchema = require("./schema");

/**
 * Tính tổng số lượng sản phẩm trong giỏ hàng
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng
 * @returns {Number} - Tổng số lượng
 */
const calculateTotalItems = (cartItems) => {
  if (!cartItems || !Array.isArray(cartItems)) return 0;
  return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
};

/**
 * Tính tổng giá trị sản phẩm trong giỏ hàng
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng
 * @returns {Number} - Tổng giá trị
 */
const calculateSubTotal = (cartItems) => {
  if (!cartItems || !Array.isArray(cartItems)) return 0;
  return cartItems.reduce(
    (total, item) => total + ((item.price || 0) * (item.quantity || 0)),
    0
  );
};

/**
 * Kiểm tra và xác thực coupon
 * @param {Object} coupon - Thông tin coupon
 * @param {Number} subTotal - Tổng giá trị đơn hàng
 * @returns {Object} - Kết quả kiểm tra và giá trị giảm giá
 */
const validateCoupon = async (coupon, subTotal) => {
  if (!coupon) return { isValid: false, discount: 0 };

  // Kiểm tra trạng thái
  if (coupon.status !== "active") {
    return {
      isValid: false,
      message: "Mã giảm giá không hoạt động",
      discount: 0,
    };
  }

  const now = new Date();
  if (now < coupon.startDate || now > coupon.endDate) {
    return {
      isValid: false,
      message: "Mã giảm giá đã hết hạn hoặc chưa đến thời gian sử dụng",
      discount: 0,
    };
  }

  // Kiểm tra đơn hàng tối thiểu
  if (coupon.minOrderValue && subTotal < coupon.minOrderValue) {
    return {
      isValid: false,
      message: `Giá trị đơn hàng tối thiểu để sử dụng mã giảm giá này là ${coupon.minOrderValue.toLocaleString(
        "vi-VN"
      )}đ`,
      discount: 0,
    };
  }

  // Tính giá trị giảm giá
  let discount = 0;
  if (coupon.type === "percent") {
    discount = (subTotal * coupon.value) / 100;
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = Math.min(coupon.value, subTotal);
  }

  return {
    isValid: true,
    discount,
  };
};

/**
 * Cập nhật thông tin của một mục trong giỏ hàng
 * @param {Object} cartItem - Mục cần cập nhật
 * @returns {Object} - Dữ liệu đã cập nhật
 */
const updateCartItemInfo = async (cartItem) => {
  try {
    // Lấy thông tin biến thể và kích thước
    const Variant = mongoose.model("Variant");
    const Size = mongoose.model("Size");
    const Product = mongoose.model("Product");  // Truy cập trực tiếp đến model Product

    // console.log(`[${new Date().toISOString()}] Đang cập nhật thông tin cho sản phẩm trong giỏ hàng - Variant ID: ${cartItem.variant}, Size ID: ${cartItem.size}`);

    // Kiểm tra biến thể có tồn tại không - lấy thông tin cơ bản
    const variant = await Variant.findById(cartItem.variant);
    
    if (!variant) {
      console.error(`[${new Date().toISOString()}] Không tìm thấy biến thể với ID: ${cartItem.variant}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Không tìm thấy biến thể sản phẩm";
      return cartItem;
    }

    // Kiểm tra trạng thái biến thể
    // console.log(`[${new Date().toISOString()}] Biến thể ${variant._id} - isActive: ${variant.isActive}`);
    
    if (variant.isActive === false) {
      console.error(`[${new Date().toISOString()}] Biến thể với ID: ${cartItem.variant} đã bị vô hiệu hóa (isActive: false)`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Biến thể sản phẩm đã bị vô hiệu hóa";
      return cartItem;
    }

    // Lấy productId từ variant
    const productId = variant.product;
    
    // Lấy thông tin sản phẩm TRỰC TIẾP từ database
    const product = await Product.findById(productId);
    
    if (!product) {
      // console.error(`[${new Date().toISOString()}] Không tìm thấy sản phẩm với ID: ${productId}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Không tìm thấy thông tin sản phẩm";
      return cartItem;
    }

    // Log chi tiết thông tin sản phẩm
    // console.log(`[${new Date().toISOString()}] Sản phẩm ${product._id} - Tên: ${product.name} - isActive: ${product.isActive} - deletedAt: ${product.deletedAt}`);

    // Kiểm tra trạng thái sản phẩm
    if (product.isActive === false || product.deletedAt !== null) {
      // console.error(`[${new Date().toISOString()}] Sản phẩm với ID: ${productId} đã bị vô hiệu hóa hoặc xóa - isActive: ${product.isActive}, deletedAt: ${product.deletedAt}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Sản phẩm đã bị vô hiệu hóa";
      return cartItem;
    }

    // Kiểm tra kích cỡ có tồn tại không
    const size = await Size.findById(cartItem.size);
    if (!size) {
      // console.error(`[${new Date().toISOString()}] Không tìm thấy kích cỡ với ID: ${cartItem.size}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Kích cỡ không tồn tại";
      return cartItem;
    }

    // Kiểm tra trong variant có size này không
    const sizeInVariant = variant.sizes.find(
      (s) => s.size && s.size.toString() === cartItem.size.toString()
    );

    if (!sizeInVariant) {
      // console.error(`[${new Date().toISOString()}] Không tìm thấy kích cỡ ${cartItem.size} trong biến thể ${cartItem.variant}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Kích cỡ này không có sẵn trong biến thể sản phẩm";
      return cartItem;
    }

    if (sizeInVariant.isSizeAvailable === false) {
      // console.error(`[${new Date().toISOString()}] Kích cỡ ${cartItem.size} không khả dụng trong biến thể ${cartItem.variant}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = "Kích cỡ này hiện không có sẵn";
      return cartItem;
    }

    // Kiểm tra tồn kho đủ không
    if (sizeInVariant.quantity < cartItem.quantity) {
      // console.error(`[${new Date().toISOString()}] Tồn kho không đủ: Yêu cầu ${cartItem.quantity}, có sẵn ${sizeInVariant.quantity}`);
      cartItem.isAvailable = false;
      cartItem.unavailableReason = `Chỉ còn ${sizeInVariant.quantity} sản phẩm trong kho`;
      return cartItem;
    }

    // Cập nhật thông tin về sản phẩm
    cartItem.productName = product.name;
    cartItem.price = variant.priceFinal || variant.price;
    
    // Lấy hình ảnh từ biến thể hoặc sản phẩm
    let imageUrl = "";
    if (variant.imagesvariant && variant.imagesvariant.length > 0) {
      const mainImage = variant.imagesvariant.find(img => img.isMain);
      imageUrl = mainImage ? mainImage.url : variant.imagesvariant[0].url;
    } else if (product.images && product.images.length > 0) {
      const mainImage = product.images.find(img => img.isMain);
      imageUrl = mainImage ? mainImage.url : product.images[0].url;
    }
    
    cartItem.image = imageUrl;
    cartItem.isAvailable = true;
    cartItem.unavailableReason = "";

    // console.log(`[${new Date().toISOString()}] Cập nhật thành công sản phẩm ${product.name} trong giỏ hàng, isAvailable = ${cartItem.isAvailable}`);
    return cartItem;
  } catch (error) {
    // console.error(`[${new Date().toISOString()}] Lỗi khi cập nhật thông tin sản phẩm trong giỏ hàng: ${error.message}`);
    // if (error.stack) console.error(error.stack);
    cartItem.isAvailable = false;
    cartItem.unavailableReason = "Lỗi hệ thống khi xử lý thông tin sản phẩm";
    return cartItem;
  }
};

/**
 * Áp dụng middleware cho schema giỏ hàng
 */
const applyMiddlewares = () => {
  // Trước khi lưu giỏ hàng
  cartSchema.pre("save", async function (next) {
    try {
      // Nếu không có sự thay đổi trong items hoặc coupon, không cần cập nhật giá
      if (!this.isModified("cartItems") && !this.isModified("coupon")) {
        return next();
      }

      // console.log(`[${new Date().toISOString()}] Đang cập nhật giỏ hàng trước khi lưu - Cart ID: ${this._id}`);

      // Cập nhật thông tin về sản phẩm, giá, tên,...
      if (this.cartItems && this.cartItems.length > 0) {
        for (let i = 0; i < this.cartItems.length; i++) {
          this.cartItems[i] = await updateCartItemInfo(this.cartItems[i]);
        }
      }

      // Tính toán tổng số lượng và tổng giá
      this.totalItems = calculateTotalItems(this.cartItems);
      this.subTotal = calculateSubTotal(this.cartItems);

      // Tính tổng số tiền giảm giá từ các sản phẩm được áp dụng
      const totalItemDiscount = this.cartItems.reduce(
        (sum, item) => sum + (item.hasCoupon ? item.itemDiscount : 0),
        0
      );
      this.discount = totalItemDiscount;

      // Cập nhật thông tin coupon nếu cần
      const hasAnyCoupon = this.cartItems.some(item => item.hasCoupon);
      if (!hasAnyCoupon) {
        this.coupon = null;
        this.couponData = null;
      }

      // Tính toán giá cuối cùng
      this.totalPrice = this.subTotal - (this.discount || 0);
      
      // console.log(`[${new Date().toISOString()}] Giỏ hàng đã được cập nhật: ${this._id}, Items: ${this.totalItems}, SubTotal: ${this.subTotal}, Discount: ${this.discount}, TotalPrice: ${this.totalPrice}`);

      return next();
    } catch (error) {
      // console.error(`[${new Date().toISOString()}] Lỗi trước khi lưu giỏ hàng: ${error.message}`);
      if (error.stack) console.error(error.stack);
      return next(error);
    }
  });

  // Hook để kiểm tra khi cart được truy vấn
  cartSchema.post("findOne", async function (doc, next) {
    if (!doc) return next();

    try {
      let needUpdate = false;

      // Kiểm tra và cập nhật thông tin sản phẩm
      if (doc.cartItems && doc.cartItems.length > 0) {
        // console.log(`[${new Date().toISOString()}] Cập nhật ${doc.cartItems.length} sản phẩm trong giỏ hàng sau khi truy vấn`);
        
        for (let i = 0; i < doc.cartItems.length; i++) {
          const item = doc.cartItems[i];
          // Kiểm tra xem item có hợp lệ không
          if (!item || !item.variant) {
            console.error(`[${new Date().toISOString()}] Item không hợp lệ tại vị trí ${i}`);
            continue;
          }
          
          // Cập nhật item với thông tin mới nhất
          const updatedItem = await updateCartItemInfo(doc.cartItems[i]);
          
          // Log kết quả cập nhật
          // console.log(`[${new Date().toISOString()}] Kết quả cập nhật sản phẩm: ID=${doc.cartItems[i]._id}, Khả dụng=${updatedItem.isAvailable}, Lý do=${updatedItem.unavailableReason || 'OK'}`);
          
          // Kiểm tra nếu có thay đổi
          if (
            updatedItem.price !== doc.cartItems[i].price ||
            updatedItem.isAvailable !== doc.cartItems[i].isAvailable ||
            updatedItem.productName !== doc.cartItems[i].productName ||
            updatedItem.image !== doc.cartItems[i].image
          ) {
            doc.cartItems[i] = updatedItem;
            needUpdate = true;
          }
        }
      }

      // Cập nhật giỏ hàng nếu có thay đổi
      if (needUpdate) {
        // console.log(`[${new Date().toISOString()}] Cập nhật giỏ hàng sau khi có thay đổi`);
        doc.totalItems = calculateTotalItems(doc.cartItems);
        doc.subTotal = calculateSubTotal(doc.cartItems);

        // Tính lại tổng giảm giá từ các sản phẩm
        const totalItemDiscount = doc.cartItems.reduce(
          (sum, item) => sum + (item.hasCoupon ? item.itemDiscount : 0),
          0
        );
        doc.discount = totalItemDiscount;

        // Kiểm tra nếu không còn sản phẩm nào có coupon
        const hasAnyCoupon = doc.cartItems.some(item => item.hasCoupon);
        if (!hasAnyCoupon) {
          doc.coupon = null;
          doc.couponData = null;
        }

        // Cập nhật tổng giá
        doc.totalPrice = doc.subTotal - (doc.discount || 0);
        
        // Tránh vòng lặp bất tận bằng cách sử dụng updateOne trực tiếp
        await mongoose.model("Cart").updateOne(
          { _id: doc._id },
          {
            $set: {
              cartItems: doc.cartItems,
              totalItems: doc.totalItems,
              subTotal: doc.subTotal,
              discount: doc.discount,
              totalPrice: doc.totalPrice,
              coupon: doc.coupon,
              couponData: doc.couponData,
            }
          }
        );
        // console.log(`[${new Date().toISOString()}] Đã cập nhật giỏ hàng ${doc._id}`);
      }

      return next();
    } catch (error) {
      // console.error(`[${new Date().toISOString()}] Lỗi khi xử lý sau khi truy vấn giỏ hàng: ${error.message}`);
      // if (error.stack) console.error(error.stack);
      return next(error);
    }
  });

  // console.log(`[${new Date().toISOString()}] Đã áp dụng middleware cho giỏ hàng`);
};

module.exports = { applyMiddlewares };