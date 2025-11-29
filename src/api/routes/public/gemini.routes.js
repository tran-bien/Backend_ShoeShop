const express = require("express");
const router = express.Router();
const geminiController = require("@controllers/public/gemini.controller");
const validateRequest = require("@middlewares/validateRequest");
const { optionalAuth } = require("@middlewares/auth.middleware");
const {
  validateChatWithAI,
  validateAIFeedback,
} = require("@validators/gemini.validator");

/**
 * @route   POST /api/v1/public/ai-chat
 * @desc    Chat với Gemini AI (Public - không cần đăng nhập, nhưng có personalization nếu đăng nhập)
 * @access  Public (optionalAuth cho personalization)
 */
router.post(
  "/ai-chat",
  optionalAuth, // Attach user nếu có token, để personalize response
  validateChatWithAI,
  validateRequest,
  geminiController.chatWithAI
);

/**
 * @route   POST /api/v1/public/ai-chat/feedback
 * @desc    Gửi feedback cho AI response
 * @access  Public
 */
router.post(
  "/ai-chat/feedback",
  validateAIFeedback,
  validateRequest,
  geminiController.feedback
);

module.exports = router;
