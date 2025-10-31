const asyncHandler = require("express-async-handler");
const blogService = require("@services/blog.service");
const imageService = require("@services/image.service");

const blogController = {
  /**
   * @route GET /api/admin/blogs
   * @desc Lấy danh sách blog posts (admin)
   * @access Staff/Admin
   */
  getAllPosts: asyncHandler(async (req, res) => {
    const result = await blogService.getAdminPosts(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/admin/blogs/:id
   * @desc Lấy chi tiết blog post
   * @access Staff/Admin
   */
  getPostById: asyncHandler(async (req, res) => {
    const result = await blogService.getPostById(req.params.id);
    return res.json(result);
  }),

  /**
   * @route POST /api/admin/blogs
   * @desc Tạo blog post mới
   * @access Staff/Admin
   */
  createPost: asyncHandler(async (req, res) => {
    const result = await blogService.createPost(req.body, req.user._id);
    return res.status(201).json(result);
  }),

  /**
   * @route PUT /api/admin/blogs/:id
   * @desc Cập nhật blog post
   * @access Staff/Admin
   */
  updatePost: asyncHandler(async (req, res) => {
    const result = await blogService.updatePost(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.json(result);
  }),

  /**
   * @route DELETE /api/admin/blogs/:id
   * @desc Xóa blog post
   * @access Staff/Admin
   */
  deletePost: asyncHandler(async (req, res) => {
    const result = await blogService.deletePost(req.params.id, req.user._id);
    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/blogs/:id/thumbnail
   * @desc Upload/cập nhật thumbnail cho blog post
   * @access Staff/Admin
   */
  updateThumbnail: asyncHandler(async (req, res) => {
    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const result = await imageService.updateBlogThumbnail(
      req.params.id,
      imageData
    );

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/blogs/:id/featured-image
   * @desc Upload/cập nhật featured image cho blog post
   * @access Staff/Admin
   */
  updateFeaturedImage: asyncHandler(async (req, res) => {
    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
      caption: req.body.caption || "",
      alt: req.body.alt || "",
    };

    const result = await imageService.updateBlogFeaturedImage(
      req.params.id,
      imageData
    );

    return res.json(result);
  }),

  /**
   * @route POST /api/admin/blogs/:id/content-image
   * @desc Thêm content image vào blog post
   * @access Staff/Admin
   */
  addContentImage: asyncHandler(async (req, res) => {
    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
      caption: req.body.caption || "",
      alt: req.body.alt || "",
    };

    const order = req.body.order ? parseInt(req.body.order) : null;

    const result = await imageService.addBlogContentImage(
      req.params.id,
      imageData,
      order
    );

    return res.json(result);
  }),

  /**
   * @route DELETE /api/admin/blogs/:id/content-image/:blockId
   * @desc Xóa content image từ blog post
   * @access Staff/Admin
   */
  removeContentImage: asyncHandler(async (req, res) => {
    const result = await imageService.removeBlogContentImage(
      req.params.id,
      req.params.blockId
    );

    return res.json(result);
  }),
};

module.exports = blogController;
