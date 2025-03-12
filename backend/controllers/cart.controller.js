const asyncHandler = require("express-async-handler");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

// Lấy giỏ hàng của người dùng
exports.getCart = asyncHandler(async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate({
        path: "cartItems.product",
        select: "name price images slug",
      })
      .populate({
        path: "cartItems.color",
        select: "name code",
      })
      .populate({
        path: "cartItems.size",
        select: "value",
      });

    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        cartItems: [],
      });
    }

    // Kiểm tra tính hợp lệ của các sản phẩm trong giỏ hàng
    const validationResult = await cart.validateItems();

    res.status(200).json({
      success: true,
      data: cart,
      validation: validationResult,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Lỗi khi lấy giỏ hàng: ${error.message}`);
  }
});

// Thêm sản phẩm vào giỏ hàng
exports.addToCart = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, colorId, sizeId, quantity = 1 } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!productId || !colorId || !sizeId) {
      res.status(400);
      throw new Error("Vui lòng cung cấp đầy đủ thông tin sản phẩm");
    }

    // Kiểm tra sản phẩm
    const product = await Product.findById(productId).session(session);
    if (!product || !product.isActive || product.isDeleted) {
      res.status(404);
      throw new Error("Sản phẩm không tồn tại hoặc không khả dụng");
    }

    // Kiểm tra tồn kho
    const variant = product.findVariant(colorId, sizeId);

    if (!variant) {
      res.status(404);
      throw new Error("Không tìm thấy biến thể sản phẩm");
    }

    // Kiểm tra trạng thái
    if (variant.status === "discontinued") {
      res.status(400);
      throw new Error("Sản phẩm này đã ngừng kinh doanh");
    }

    if (variant.status === "inactive") {
      res.status(400);
      throw new Error("Sản phẩm này tạm thời không khả dụng");
    }

    // Kiểm tra số lượng
    if (variant.quantity < quantity) {
      res.status(400);
      throw new Error(
        `Số lượng sản phẩm không đủ, chỉ còn ${variant.quantity} sản phẩm`
      );
    }

    // Tìm hoặc tạo giỏ hàng cho người dùng
    let cart = await Cart.findOne({ user: req.user._id }).session(session);

    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        cartItems: [],
      });
    }

    // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
    const itemIndex = cart.cartItems.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.color.toString() === colorId &&
        item.size.toString() === sizeId
    );

    if (itemIndex > -1) {
      // Sản phẩm đã tồn tại, cập nhật số lượng
      const newQuantity = cart.cartItems[itemIndex].quantity + quantity;

      // Kiểm tra số lượng mới có vượt quá số lượng trong kho không
      if (newQuantity > variant.quantity) {
        res.status(400);
        throw new Error(
          `Số lượng sản phẩm vượt quá số lượng trong kho (${variant.quantity})`
        );
      }

      cart.cartItems[itemIndex].quantity = newQuantity;
    } else {
      // Thêm sản phẩm mới vào giỏ hàng
      cart.cartItems.push({
        product: productId,
        color: colorId,
        size: sizeId,
        quantity,
      });
    }

    // Lưu giỏ hàng
    await cart.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Trả về giỏ hàng đã cập nhật với thông tin chi tiết sản phẩm
    cart = await Cart.findById(cart._id)
      .populate({
        path: "cartItems.product",
        select: "name price images slug",
      })
      .populate({
        path: "cartItems.color",
        select: "name code",
      })
      .populate({
        path: "cartItems.size",
        select: "value",
      });

    res.status(200).json({
      success: true,
      message: "Đã thêm sản phẩm vào giỏ hàng",
      data: cart,
    });
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await session.abortTransaction();
    session.endSession();

    res.status(error.statusCode || 400);
    throw error;
  }
});

// Cập nhật số lượng sản phẩm trong giỏ hàng
exports.updateCartItem = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Kiểm tra số lượng
    if (quantity <= 0) {
      res.status(400);
      throw new Error("Số lượng phải lớn hơn 0");
    }

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user._id }).session(session);

    if (!cart) {
      res.status(404);
      throw new Error("Không tìm thấy giỏ hàng");
    }

    // Tìm sản phẩm trong giỏ hàng
    const itemIndex = cart.cartItems.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      res.status(404);
      throw new Error("Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Lấy thông tin sản phẩm để kiểm tra tồn kho
    const cartItem = cart.cartItems[itemIndex];
    const product = await Product.findById(cartItem.product).session(session);

    if (!product) {
      res.status(404);
      throw new Error("Sản phẩm không còn tồn tại");
    }

    // Kiểm tra tồn kho
    const variant = product.findVariant(cartItem.color, cartItem.size);

    if (!variant || variant.quantity < quantity) {
      res.status(400);
      throw new Error(
        `Không đủ số lượng trong kho. Chỉ còn ${
          variant ? variant.quantity : 0
        } sản phẩm.`
      );
    }

    // Cập nhật số lượng
    cart.cartItems[itemIndex].quantity = quantity;

    // Lưu giỏ hàng
    await cart.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Trả về giỏ hàng đã cập nhật
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "cartItems.product",
        select: "name price images slug",
      })
      .populate({
        path: "cartItems.color",
        select: "name code",
      })
      .populate({
        path: "cartItems.size",
        select: "value",
      });

    res.status(200).json({
      success: true,
      message: "Đã cập nhật số lượng sản phẩm",
      data: updatedCart,
    });
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await session.abortTransaction();
    session.endSession();

    res.status(error.statusCode || 400);
    throw error;
  }
});

// Xóa sản phẩm khỏi giỏ hàng
exports.removeCartItem = asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      res.status(404);
      throw new Error("Không tìm thấy giỏ hàng");
    }

    // Xóa sản phẩm khỏi giỏ hàng
    cart.cartItems = cart.cartItems.filter(
      (item) => item._id.toString() !== itemId
    );

    // Lưu giỏ hàng
    await cart.save();

    // Trả về giỏ hàng đã cập nhật
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "cartItems.product",
        select: "name price images slug",
      })
      .populate({
        path: "cartItems.color",
        select: "name code",
      })
      .populate({
        path: "cartItems.size",
        select: "value",
      });

    res.status(200).json({
      success: true,
      message: "Đã xóa sản phẩm khỏi giỏ hàng",
      data: updatedCart,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Lỗi khi xóa sản phẩm: ${error.message}`);
  }
});

// Xóa toàn bộ giỏ hàng
exports.clearCart = asyncHandler(async (req, res) => {
  try {
    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      res.status(404);
      throw new Error("Không tìm thấy giỏ hàng");
    }

    // Xóa tất cả sản phẩm
    cart.cartItems = [];

    // Lưu giỏ hàng
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Đã xóa toàn bộ giỏ hàng",
      data: cart,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Lỗi khi xóa giỏ hàng: ${error.message}`);
  }
});
