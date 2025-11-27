const express = require("express");
const router = express.Router();
const geminiController = require("@controllers/public/gemini.controller");
const validateRequest = require("@middlewares/validateRequest");
const {
  validateChatWithAI,
  validateAIFeedback,
} = require("@validators/gemini.validator");

/**
 * @route   POST /api/v1/public/ai-chat
 * @desc    Chat với Gemini AI (Public - không cần đăng nhập)
 * @access  Public
 */
router.post(
  "/ai-chat",
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
