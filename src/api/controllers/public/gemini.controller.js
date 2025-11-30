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
    const userId = req.user?._id;
    const clientIp = req.ip;

    // Service xử lý toàn bộ logic: session validation, chat, response
    const result = await GeminiService.chatWithValidation(message, {
      clientSessionId,
      userId,
      clientIp,
      history: history.slice(-10), // Chỉ lấy 10 tin nhắn gần nhất
    });

    // Rate limit info được set trong header bởi middleware
    return res.json({
      success: true,
      data: {
        response: result.response,
        sessionId: result.sessionId,
        outOfScope: result.outOfScope || false,
        cached: result.cached || false,
        noKnowledge: result.noKnowledge || false,
        demoMode: result.demoMode || false,
      },
    });
  }),

  /**
   * @route POST /api/v1/public/ai-chat/feedback
   * @desc Feedback cho AI response
   */
  feedback: asyncHandler(async (req, res) => {
    const { sessionId, helpful, comment } = req.body;

    // TODO: Lưu feedback vào DB để cải thiện AI
    // await AIFeedback.create({ sessionId, helpful, comment });

    return res.json({
      success: true,
      message: "Cảm ơn phản hồi của bạn!",
    });
  }),
};

module.exports = geminiController;
