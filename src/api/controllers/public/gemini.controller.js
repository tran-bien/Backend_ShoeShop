const asyncHandler = require("express-async-handler");
const GeminiService = require("@services/gemini.service");
const { rateLimiter } = require("@utils/rateLimiter");
const SessionManager = require("@utils/sessionManager");

const geminiController = {
  /**
   * @route POST /api/v1/public/ai-chat
   * @desc Chat với Gemini AI (Public)
   */
  chatWithAI: asyncHandler(async (req, res) => {
    const { message, sessionId: clientSessionId, history = [] } = req.body;
    const userId = req.user?._id;

    // Rate limiting với Redis
    const rateLimitKey = userId ? `user_${userId}` : `ip_${req.ip}`;
    const allowed = await rateLimiter.checkLimit(rateLimitKey, 10, 60000);

    if (!allowed) {
      const ttl = await rateLimiter.getTTL(rateLimitKey);
      return res.status(429).json({
        success: false,
        message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${
          ttl > 0 ? ttl : 60
        } giây.`,
      });
    }

    // Session ID validation và generation
    let sessionId = clientSessionId;

    if (sessionId) {
      // Validate format
      if (!SessionManager.validateSessionId(sessionId)) {
        sessionId = SessionManager.generateSessionId(userId || req.ip);
        console.warn(
          `[GEMINI] Invalid sessionId format, generated new: ${sessionId}`
        );
      }
      // Check expired
      else if (SessionManager.isExpired(sessionId, 24 * 60 * 60 * 1000)) {
        sessionId = SessionManager.generateSessionId(userId || req.ip);
        console.warn(`[GEMINI] Expired sessionId, generated new: ${sessionId}`);
      }
    } else {
      // Generate new session ID
      sessionId = SessionManager.generateSessionId(userId || req.ip);
    }

    // Chat với Gemini
    const result = await GeminiService.chat(message, {
      sessionId,
      userId,
      history: history.slice(-10), // Chỉ lấy 10 tin nhắn gần nhất
    });

    // Thêm rate limit info vào response
    const remaining = await rateLimiter.getRemaining(rateLimitKey, 10);

    return res.json({
      success: true,
      data: {
        response: result.response,
        sessionId,
        outOfScope: result.outOfScope || false,
        cached: result.cached || false,
        noKnowledge: result.noKnowledge || false,
        demoMode: result.demoMode || false,
      },
      meta: {
        rateLimitRemaining: remaining,
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
