const express = require("express");
const router = express.Router();
const blogController = require("@controllers/admin/blog.controller");
const {
  protect,
  requireStaffOrAdmin,
} = require("@middlewares/auth.middleware");
const uploadMiddleware = require("@middlewares/upload.middleware");
const blogValidator = require("@validators/blog.validator");
const uploadValidator = require("@validators/upload.validator");
const validate = require("@utils/validatehelper");

// Áp dụng middleware protect cho tất cả routes
router.use(protect);
router.use(requireStaffOrAdmin);

/**
 * @route GET /api/admin/blogs
 * @desc Lấy danh sách blog posts
 * @access Staff/Admin
 */
router.get(
  "/",
  validate(blogValidator.validateBlogPostQuery),
  blogController.getAllPosts
);

/**
 * @route GET /api/admin/blogs/:id
 * @desc Lấy chi tiết blog post
 * @access Staff/Admin
 */
router.get(
  "/:id",
  validate(blogValidator.validateBlogPostId),
  blogController.getPostById
);

/**
 * @route POST /api/admin/blogs
 * @desc Tạo blog post mới
 * @access Staff/Admin
 */
router.post(
  "/",
  validate(blogValidator.validateCreateBlogPost),
  blogController.createPost
);

/**
 * @route PUT /api/admin/blogs/:id
 * @desc Cập nhật blog post
 * @access Staff/Admin
 */
router.put(
  "/:id",
  validate([
    blogValidator.validateBlogPostId,
    blogValidator.validateUpdateBlogPost,
  ]),
  blogController.updatePost
);

/**
 * @route DELETE /api/admin/blogs/:id
 * @desc Xóa blog post
 * @access Staff/Admin
 */
router.delete(
  "/:id",
  validate(blogValidator.validateBlogPostId),
  blogController.deletePost
);

/**
 * @route PUT /api/admin/blogs/:id/thumbnail
 * @desc Upload/cập nhật thumbnail cho blog post
 * @access Staff/Admin
 */
router.put(
  "/:id/thumbnail",
  validate(blogValidator.validateBlogPostId),
  uploadMiddleware.handleBlogThumbnailUpload,
  validate([
    uploadValidator.validateSingleFileExists,
    uploadValidator.validateImageFileType,
    uploadValidator.validateImageFileSize,
  ]),
  blogController.updateThumbnail
);

/**
 * @route PUT /api/admin/blogs/:id/featured-image
 * @desc Upload/cập nhật featured image cho blog post
 * @access Staff/Admin
 */
router.put(
  "/:id/featured-image",
  validate(blogValidator.validateBlogPostId),
  uploadMiddleware.handleBlogFeaturedImageUpload,
  validate([
    uploadValidator.validateSingleFileExists,
    uploadValidator.validateImageFileType,
    uploadValidator.validateImageFileSize,
  ]),
  blogController.updateFeaturedImage
);

/**
 * @route POST /api/admin/blogs/:id/content-image
 * @desc Thêm content image vào blog post
 * @access Staff/Admin
 */
router.post(
  "/:id/content-image",
  validate(blogValidator.validateBlogPostId),
  uploadMiddleware.handleBlogContentImageUpload,
  validate([
    uploadValidator.validateSingleFileExists,
    uploadValidator.validateImageFileType,
    uploadValidator.validateImageFileSize,
  ]),
  blogController.addContentImage
);

/**
 * @route DELETE /api/admin/blogs/:id/content-image/:blockId
 * @desc Xóa content image từ blog post
 * @access Staff/Admin
 */
router.delete(
  "/:id/content-image/:blockId",
  validate([blogValidator.validateBlogPostId, blogValidator.validateBlockId]),
  blogController.removeContentImage
);

module.exports = router;
