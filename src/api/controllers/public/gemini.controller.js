const asyncHandler = require("express-async-handler");
const GeminiService = require("@services/gemini.service");

const geminiController = {
  /**
   * @route POST /api/v1/public/ai-chat
   * @desc Chat với Gemini AI (Public)
   * @note Rate limiting được xử lý bởi middleware trong routes
   */
  chatWithAI: asyncHandler(async (req, res) => {
    const { message, sessionId: clientSessionId, history = [] } = req.body;
    const clientIp = req.ip;

    // Service xử lý toàn bộ logic: session validation, chat, response
    const result = await GeminiService.chatWithValidation(message, {
      clientSessionId,
      clientIp,
      history: history.slice(-10), // Chỉ lấy 10 tin nhắn gần nhất
    });

    // Rate limit info được set trong header bởi middleware
    return res.json({
      success: !result.error, // false nếu có lỗi
      data: {
        response: result.response,
        sessionId: result.sessionId,
        outOfScope: result.outOfScope || false,
        cached: result.cached || false,
        noKnowledge: result.noKnowledge || false,
        demoMode: result.demoMode || false,
        rateLimited: result.rateLimited || false, // Thông báo bị rate limit
        quotaExhausted: result.quotaExhausted || false, // Quota hết (cần chờ reset)
      },
    });
  }),
};

module.exports = geminiController;
