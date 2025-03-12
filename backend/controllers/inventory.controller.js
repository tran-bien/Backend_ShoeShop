const asyncHandler = require("express-async-handler");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

// Lấy danh sách biến thể sản phẩm (kho)
exports.getInventory = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      keyword,
      status,
      stockStatus,
      minQuantity,
      maxQuantity,
      sortBy = "createdAt",
      sortOrder = "desc",
      category,
      brand,
      colorId,
      sizeId,
    } = req.query;

    // Tạo pipeline aggregation
    let pipeline = [
      // Giai đoạn $unwind để tách các variants
      {
        $unwind: {
          path: "$variants",
          preserveNullAndEmptyArrays: false,
        },
      },

      // Giai đoạn $lookup để join với bảng Colors
      {
        $lookup: {
          from: "colors",
          localField: "variants.color",
          foreignField: "_id",
          as: "colorInfo",
        },
      },
      {
        $unwind: {
          path: "$colorInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Giai đoạn $lookup để join với bảng Sizes
      {
        $lookup: {
          from: "sizes",
          localField: "variants.size",
          foreignField: "_id",
          as: "sizeInfo",
        },
      },
      {
        $unwind: {
          path: "$sizeInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Giai đoạn $lookup để join với bảng Categories
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $unwind: {
          path: "$categoryInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Giai đoạn $lookup để join với bảng Brands
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brandInfo",
        },
      },
      {
        $unwind: {
          path: "$brandInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Tạo tài liệu mới với cấu trúc mong muốn
      {
        $project: {
          _id: "$_id",
          variantId: {
            $concat: [
              "$_id",
              "-",
              { $toString: "$variants.color" },
              "-",
              { $toString: "$variants.size" },
            ],
          },
          product: "$_id",
          productName: "$name",
          color: "$variants.color",
          colorName: "$colorInfo.name",
          colorCode: "$colorInfo.code",
          size: "$variants.size",
          sizeValue: "$sizeInfo.value",
          quantity: "$variants.quantity",
          reservedQuantity: "$variants.reservedQuantity",
          status: "$variants.status",
          isAvailable: "$variants.isAvailable",
          lastRestocked: "$variants.lastRestocked",
          category: "$categoryInfo.name",
          brand: "$brandInfo.name",
          gender: "$gender",
          price: "$price",
          sku: "$variants.sku",
        },
      },
    ];

    // Thêm điều kiện lọc
    let matchQuery = {};

    // Lọc theo từ khóa
    if (keyword) {
      matchQuery.$or = [
        { productName: { $regex: keyword, $options: "i" } },
        { colorName: { $regex: keyword, $options: "i" } },
        { sizeValue: { $regex: keyword, $options: "i" } },
        { sku: { $regex: keyword, $options: "i" } },
      ];
    }

    // Lọc theo trạng thái
    if (status) {
      matchQuery.status = status;
    }

    // Lọc theo trạng thái kho
    if (stockStatus === "outOfStock") {
      matchQuery.quantity = 0;
    } else if (stockStatus === "lowStock") {
      matchQuery.quantity = { $gt: 0, $lte: 5 };
    } else if (stockStatus === "inStock") {
      matchQuery.quantity = { $gt: 5 };
    }

    // Lọc theo số lượng
    if (minQuantity !== undefined) {
      matchQuery.quantity = matchQuery.quantity || {};
      matchQuery.quantity.$gte = parseInt(minQuantity);
    }

    if (maxQuantity !== undefined) {
      matchQuery.quantity = matchQuery.quantity || {};
      matchQuery.quantity.$lte = parseInt(maxQuantity);
    }

    // Lọc theo danh mục
    if (category) {
      matchQuery.category = category;
    }

    // Lọc theo thương hiệu
    if (brand) {
      matchQuery.brand = brand;
    }

    // Lọc theo màu sắc
    if (colorId) {
      matchQuery.color = mongoose.Types.ObjectId(colorId);
    }

    // Lọc theo kích thước
    if (sizeId) {
      matchQuery.size = mongoose.Types.ObjectId(sizeId);
    }

    if (Object.keys(matchQuery).length > 0) {
      pipeline.push({ $match: matchQuery });
    }

    // Sắp xếp
    const sortStage = {};
    sortStage[sortBy] = sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: sortStage });

    // Đếm tổng số bản ghi
    const totalPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await Product.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Phân trang
    pipeline.push({ $skip: (parseInt(page) - 1) * parseInt(limit) });
    pipeline.push({ $limit: parseInt(limit) });

    // Thực hiện truy vấn
    const inventoryItems = await Product.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: {
        items: inventoryItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Lỗi khi lấy danh sách kho hàng: ${error.message}`);
  }
});

// Lấy chi tiết một biến thể
exports.getInventoryItem = asyncHandler(async (req, res) => {
  try {
    const { id, colorId, sizeId } = req.params;

    // Tìm sản phẩm
    const product = await Product.findById(id)
      .populate("brand", "name")
      .populate("category", "name");

    if (!product) {
      res.status(404);
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm biến thể
    const variant = product.findVariant(colorId, sizeId);

    if (!variant) {
      res.status(404);
      throw new Error("Không tìm thấy biến thể sản phẩm");
    }

    // Lấy thông tin màu sắc và kích thước
    const color = await mongoose.model("Color").findById(colorId);
    const size = await mongoose.model("Size").findById(sizeId);

    if (!color || !size) {
      res.status(404);
      throw new Error("Không tìm thấy thông tin màu sắc hoặc kích thước");
    }

    res.status(200).json({
      success: true,
      data: {
        product: {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          gender: product.gender,
          price: product.price,
        },
        variant: {
          color: {
            _id: color._id,
            name: color.name,
            code: color.code,
          },
          size: {
            _id: size._id,
            value: size.value,
          },
          quantity: variant.quantity,
          reservedQuantity: variant.reservedQuantity,
          status: variant.status,
          isAvailable: variant.isAvailable,
          lastRestocked: variant.lastRestocked,
          sku: variant.sku,
        },
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500);
    throw error;
  }
});

// Thống kê kho
exports.getInventoryStats = asyncHandler(async (req, res) => {
  try {
    // Thống kê theo trạng thái
    const statusCounts = await Product.aggregate([
      { $unwind: "$variants" },
      {
        $group: {
          _id: "$variants.status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Tạo object kết quả
    const statusStats = statusCounts.reduce((obj, item) => {
      obj[item._id] = item.count;
      return obj;
    }, {});

    // Đếm các biến thể hết hàng nhưng vẫn active
    const outOfStockActive = await Product.aggregate([
      { $unwind: "$variants" },
      {
        $match: {
          "variants.status": "active",
          "variants.quantity": 0,
        },
      },
      { $count: "count" },
    ]);

    // Đếm các biến thể sắp hết hàng (1-5)
    const lowStock = await Product.aggregate([
      { $unwind: "$variants" },
      {
        $match: {
          "variants.status": "active",
          "variants.quantity": { $gt: 0, $lte: 5 },
        },
      },
      { $count: "count" },
    ]);

    // Thống kê theo loại sản phẩm
    const categoryStats = await Product.aggregate([
      { $unwind: "$variants" },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: {
            categoryId: "$category",
            categoryName: "$categoryInfo.name",
          },
          totalQuantity: { $sum: "$variants.quantity" },
          variantCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          categoryId: "$_id.categoryId",
          categoryName: "$_id.categoryName",
          totalQuantity: 1,
          variantCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusStats: {
          active: statusStats.active || 0,
          inactive: statusStats.inactive || 0,
          discontinued: statusStats.discontinued || 0,
          outOfStockActive:
            outOfStockActive.length > 0 ? outOfStockActive[0].count : 0,
          lowStock: lowStock.length > 0 ? lowStock[0].count : 0,
        },
        categoryStats,
      },
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Lỗi khi lấy thống kê kho hàng: ${error.message}`);
  }
});

// Cập nhật thông tin biến thể
exports.updateInventoryItem = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, colorId, sizeId } = req.params;
    const { quantity, status, sku } = req.body;

    // Tìm sản phẩm
    const product = await Product.findById(id).session(session);

    if (!product) {
      res.status(404);
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm biến thể
    const variant = product.findVariant(colorId, sizeId);

    if (!variant) {
      res.status(404);
      throw new Error("Không tìm thấy biến thể sản phẩm");
    }

    // Lưu giá trị cũ để ghi log
    const oldQuantity = variant.quantity;
    const oldStatus = variant.status;

    // Cập nhật thông tin
    if (quantity !== undefined) {
      variant.quantity = Number(quantity);
      variant.lastRestocked = new Date();
    }

    if (status) {
      if (!["active", "inactive", "discontinued"].includes(status)) {
        res.status(400);
        throw new Error("Trạng thái không hợp lệ");
      }
      variant.status = status;
    }

    if (sku !== undefined) {
      variant.sku = sku;
    }

    // Cập nhật trạng thái isAvailable
    if (variant.quantity > 0 && variant.status === "active") {
      variant.isAvailable = true;
    } else {
      variant.isAvailable = false;
    }

    // Nếu status là discontinued, đảm bảo isAvailable là false
    if (variant.status === "discontinued") {
      variant.isAvailable = false;
    }

    // Cập nhật tổng số lượng và số lượng theo màu
    product.updateColorQuantities();
    await product.updateTotalQuantity();

    // Lưu sản phẩm
    await product.save({ session });

    // Ghi log hoạt động
    const ProductActivity = require("../models/product.activity.model");
    await ProductActivity.create(
      {
        product: product._id,
        user: req.user._id,
        action: "update_stock",
        details: `Cập nhật kho: ${oldQuantity} → ${variant.quantity}, trạng thái: ${oldStatus} → ${variant.status}`,
      },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Cập nhật thành công",
      data: {
        product: product._id,
        color: colorId,
        size: sizeId,
        quantity: variant.quantity,
        status: variant.status,
        isAvailable: variant.isAvailable,
        sku: variant.sku,
      },
    });
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await session.abortTransaction();
    session.endSession();

    res.status(error.statusCode || 500);
    throw error;
  }
});

// Cập nhật số lượng hàng loạt
exports.bulkUpdateInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error(
        "Dữ liệu không hợp lệ hoặc không có sản phẩm cần cập nhật"
      );
    }

    const results = [];
    const errors = [];
    const ProductActivity = require("../models/product.activity.model");
    const activityLogs = [];

    // Xử lý từng item cập nhật
    for (const item of items) {
      try {
        const { productId, colorId, sizeId, quantity, status } = item;

        if (!productId || !colorId || !sizeId) {
          errors.push({
            item,
            error: "Thiếu thông tin sản phẩm, màu sắc hoặc kích thước",
          });
          continue;
        }

        // Tìm sản phẩm
        const product = await Product.findById(productId).session(session);

        if (!product) {
          errors.push({
            item,
            error: "Không tìm thấy sản phẩm",
          });
          continue;
        }

        // Tìm biến thể
        const variant = product.findVariant(colorId, sizeId);

        if (!variant) {
          errors.push({
            item,
            error: "Không tìm thấy biến thể sản phẩm",
          });
          continue;
        }

        // Lưu giá trị cũ để so sánh và ghi log
        const oldQuantity = variant.quantity;
        const oldStatus = variant.status;

        // Cập nhật số lượng
        if (quantity !== undefined) {
          variant.quantity = Number(quantity);
          variant.lastRestocked = new Date();
        }

        // Cập nhật trạng thái
        if (status) {
          if (!["active", "inactive", "discontinued"].includes(status)) {
            errors.push({
              item,
              error: "Trạng thái không hợp lệ",
            });
            continue;
          }
          variant.status = status;
        }

        // Cập nhật trạng thái isAvailable
        if (variant.quantity > 0 && variant.status === "active") {
          variant.isAvailable = true;
        } else {
          variant.isAvailable = false;
        }

        // Nếu status là discontinued, đảm bảo isAvailable là false
        if (variant.status === "discontinued") {
          variant.isAvailable = false;
        }

        // Cập nhật tổng số lượng và số lượng theo màu
        product.updateColorQuantities();
        await product.updateTotalQuantity();

        // Lưu sản phẩm
        await product.save({ session });

        // Chuẩn bị ghi log hoạt động
        activityLogs.push({
          product: product._id,
          user: req.user._id,
          action: "bulk_update_stock",
          details: `Cập nhật hàng loạt: ${oldQuantity} → ${variant.quantity}, trạng thái: ${oldStatus} → ${variant.status}`,
        });

        // Thêm vào kết quả thành công
        results.push({
          productId,
          colorId,
          sizeId,
          quantity: variant.quantity,
          status: variant.status,
          isAvailable: variant.isAvailable,
        });
      } catch (error) {
        errors.push({
          item,
          error: error.message,
        });
      }
    }

    // Ghi log hoạt động
    if (activityLogs.length > 0) {
      await ProductActivity.insertMany(activityLogs, { session });
    }

    // Commit transaction nếu có ít nhất 1 cập nhật thành công hoặc không có lỗi
    if (results.length > 0 || errors.length === 0) {
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: `Đã cập nhật ${results.length} mục, ${errors.length} lỗi`,
        results,
        errors,
      });
    } else {
      // Rollback nếu tất cả cập nhật đều thất bại
      await session.abortTransaction();
      session.endSession();

      res.status(400).json({
        success: false,
        message: "Không có cập nhật nào thành công",
        errors,
      });
    }
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await session.abortTransaction();
    session.endSession();

    res.status(500);
    throw new Error(`Lỗi khi cập nhật hàng loạt: ${error.message}`);
  }
});

module.exports = exports;
