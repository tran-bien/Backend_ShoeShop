const { body, param, query } = require("express-validator");

/**
 * Validator cho API chat với AI (Public)
 */
const validateChatWithAI = [
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Tin nhắn không được để trống")
    .isLength({ max: 500 })
    .withMessage("Tin nhắn không được quá 500 ký tự"),

  body("sessionId")
    .optional()
    .isString()
    .withMessage("Session ID phải là chuỗi"),

  body("history")
    .optional()
    .isArray()
    .withMessage("History phải là mảng")
    .custom((value) => {
      if (value.length > 20) {
        throw new Error("History không được quá 20 tin nhắn");
      }
      return true;
    }),
];

/**
 * Validator cho API feedback AI
 */
const validateAIFeedback = [
  body("sessionId").notEmpty().withMessage("Session ID không được để trống"),

  body("helpful").isBoolean().withMessage("Helpful phải là boolean"),

  body("comment")
    .optional()
    .isString()
    .withMessage("Comment phải là chuỗi")
    .isLength({ max: 500 })
    .withMessage("Comment không được quá 500 ký tự"),
];

/**
 * Validator cho API toggle demo mode (Admin)
 */
const validateToggleDemoMode = [
  body("enabled")
    .notEmpty()
    .withMessage("enabled không được để trống")
    .isBoolean()
    .withMessage("enabled phải là boolean (true/false)"),
];

module.exports = {
  validateChatWithAI,
  validateAIFeedback,
  validateToggleDemoMode,
};
