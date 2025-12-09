const { chatModel } = require("@config/gemini");
const { KnowledgeDocument } = require("@models");
const NodeCache = require("node-cache");
const SessionManager = require("@utils/sessionManager");

/**
 * Gemini AI Service với RAG (Retrieval-Augmented Generation)
 *
 * Logic hoạt động:
 * 1. User gửi câu hỏi → isInScope() kiểm tra phạm vi
 * 2. buildContext() tìm kiếm Knowledge Base (MongoDB Text Search)
 * 3. Nếu tìm thấy KB → inject vào prompt để AI trả lời chính xác
 * 4. Nếu không có KB → tùy demoMode mà từ chối hoặc trả lời lung tung
 * 5. Response được cache để tối ưu performance
 */
class GeminiService {
  constructor() {
    // Cache response với TTL tự động cleanup
    this.responseCache = new NodeCache({
      stdTTL: 3600, // 1 hour
      checkperiod: 600, // Check every 10 mins để cleanup expired
      maxKeys: 1000, // Giới hạn 1000 entries
      useClones: false, // Performance optimization
    });

    // DEMO MODE:
    // - true: AI trả lời bằng kiến thức chung khi chưa có KB (có thể sai)
    // - false: AI từ chối trả lời khi không có KB (production mode)
    this.demoMode = process.env.GEMINI_DEMO_MODE !== "false";
  }

  /**
   * Build context từ Knowledge Base
   *
   * @param {string} userQuery - Câu hỏi của user
   * @returns {string|null} - Context string hoặc null nếu không tìm thấy KB
   *
   * Flow:
   * 1. Sanitize input để tránh injection
   * 2. Full-text search trong KnowledgeDocument
   * 3. Sort theo textScore + priority
   * 4. Trả về top 3 docs dưới dạng context string
   */
  async buildContext(userQuery) {
    // Sanitize user input để tránh NoSQL injection và regex DoS
    const sanitizedQuery = userQuery
      .replace(/[${}]/g, "") // Remove MongoDB operators
      .replace(/[\\^$.*+?()[\]|]/g, " ") // Remove regex special chars
      .slice(0, 500) // Limit length để tránh DoS
      .trim();

    // Search Knowledge Base (MongoDB Text Search)
    // Text index đã được tạo trên: title (weight 10), tags (5), content (1)
    const knowledgeDocs = await KnowledgeDocument.find(
      {
        $text: { $search: sanitizedQuery },
        isActive: true,
      },
      {
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" }, priority: -1 })
      .limit(3);

    // Không có knowledge → return null để chat() xử lý
    if (knowledgeDocs.length === 0) {
      return null;
    }

    // Build context string từ các KB docs tìm được
    const contextParts = ["📚 KIẾN THỨC TỪ HỆ THỐNG:"];

    knowledgeDocs.forEach((doc) => {
      contextParts.push(`\n[${doc.category.toUpperCase()}] ${doc.title}`);
      contextParts.push(doc.content);
    });

    return contextParts.join("\n");
  }

  /**
   * Validate câu hỏi có trong phạm vi cho phép không
   * Ngăn chặn các câu hỏi nhạy cảm/ngoài phạm vi shop giày
   */
  isInScope(userQuery) {
    const outOfScopePatterns = [
      /chính trị|tổng thống|bầu cử/i,
      /thuốc|bệnh|y tế|điều trị|khám bệnh/i,
      /luật|pháp luật|kiện|tòa án/i,
      /tôn giáo|phật giáo|công giáo/i,
      /hack|crack|phần mềm lậu/i,
    ];

    return !outOfScopePatterns.some((pattern) => pattern.test(userQuery));
  }

  /**
   * Chat with Gemini AI
   *
   * @param {string} userMessage - Câu hỏi của user
   * @param {Object} options - { sessionId, history }
   * @returns {Object} - { response, cached?, noKnowledge?, demoMode? }
   *
   * Flow:
   * 1. Kiểm tra câu hỏi có trong phạm vi (isInScope)
   * 2. Build context từ Knowledge Base
   * 3. Check cache → nếu có thì trả về luôn
   * 4. Gửi prompt (context + câu hỏi) → Gemini API
   * 5. Cache response và trả về
   */
  async chat(userMessage, { sessionId, history = [] }) {
    try {
      // 1. Validate scope - Chặn câu hỏi ngoài phạm vi
      if (!this.isInScope(userMessage)) {
        return {
          response:
            "Xin lỗi, tôi chỉ có thể hỗ trợ về sản phẩm giày và dịch vụ của shop. Bạn có câu hỏi nào khác không? 😊",
          outOfScope: true,
        };
      }

      // 2. Build context từ Knowledge Base
      const context = await this.buildContext(userMessage);

      // 3. Check cache - Tránh gọi API Gemini nhiều lần cho cùng câu hỏi
      const contextHash = context ? "ctx" : "noctx";
      const cacheKey = `${contextHash}_${userMessage.toLowerCase()}`;
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        return { response: cached, cached: true };
      }

      // 4. Xử lý khi không có Knowledge Base
      if (!context && !this.demoMode) {
        // Production mode: Từ chối trả lời khi không có KB
        return {
          response:
            "Xin lỗi, tôi không có đủ thông tin để trả lời câu hỏi này. Vui lòng chat với nhân viên hỗ trợ hoặc gọi hotline 1900 xxxx. 🙏",
          noKnowledge: true,
        };
      }

      if (!context && this.demoMode) {
        // Demo mode: Cảnh báo AI đang trả lời không dựa trên KB
        console.warn(
          "[GEMINI DEMO MODE] AI đang trả lời KHÔNG dựa trên KB - có thể SAI thông tin!"
        );
      }

      // 5. Prepare chat history cho multi-turn conversation
      const chatHistory = history.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      // 6. Create chat session với Gemini
      const chat = chatModel.startChat({
        history: chatHistory,
      });

      // 7. Build prompt và gửi tới Gemini
      const fullPrompt = context
        ? `NGỮ CẢNH:\n${context}\n\n---\n\nCÂU HỎI KHÁCH HÀNG: ${userMessage}`
        : userMessage; // Demo mode: gửi trực tiếp

      // Timeout 30s để tránh hanging
      const GEMINI_TIMEOUT = 30000;
      const result = await Promise.race([
        chat.sendMessage(fullPrompt),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Gemini API timeout sau 30 giây")),
            GEMINI_TIMEOUT
          )
        ),
      ]);
      const response = result.response.text();

      // 8. Cache response
      this.responseCache.set(cacheKey, response);

      return {
        response,
        hasContext: context ? context.length > 100 : false,
        noKnowledge: !context, // Flag để frontend biết AI đang trả lời không có KB
        demoMode: this.demoMode,
      };
    } catch (error) {
      console.error("[GEMINI] Chat error:", error);

      // Xử lý các loại lỗi cụ thể
      const errorStatus = error.status || error.statusCode;

      if (errorStatus === 429) {
        // Kiểm tra xem có phải hết quota ngày không (limit: 0)
        const quotaExhausted = error.message?.includes("limit: 0");
        const retryMatch = error.message?.match(/retry in (\d+)/i);
        const retrySeconds = retryMatch ? retryMatch[1] : "vài";

        if (quotaExhausted) {
          // Hết quota ngày - cần chờ reset hoặc đổi API key
          return {
            response: `Hệ thống AI đã hết lượt sử dụng hôm nay. Vui lòng chat với nhân viên hỗ trợ hoặc gọi hotline 1900 xxxx để được tư vấn nhé!`,
            error: true,
            rateLimited: true,
            quotaExhausted: true,
            errorDetails: "Gemini API daily quota exhausted",
          };
        }

        return {
          response: `AI đang bận, vui lòng thử lại sau ${retrySeconds} giây hoặc chat với nhân viên hỗ trợ nhé!`,
          error: true,
          rateLimited: true,
          quotaExhausted: false,
          errorDetails: "Gemini API rate limit exceeded",
        };
      }

      if (errorStatus === 404) {
        return {
          response:
            "🔧 Hệ thống AI đang bảo trì. Vui lòng chat với nhân viên hỗ trợ hoặc gọi hotline 1900 xxxx.",
          error: true,
          errorDetails: "Gemini model not available",
        };
      }

      // Fallback response cho các lỗi khác
      return {
        response:
          "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng chat với nhân viên hỗ trợ hoặc gọi hotline 1900 xxxx. 🙏",
        error: true,
        errorDetails: error.message,
      };
    }
  }

  /**
   * Toggle Demo Mode (runtime)
   */
  setDemoMode(enabled) {
    this.demoMode = enabled;
    console.log(`[GEMINI] Demo Mode ${enabled ? "ENABLED" : "DISABLED"}`);
    return this.demoMode;
  }

  /**
   * Get Demo Mode status
   */
  getDemoMode() {
    return {
      enabled: this.demoMode,
      description: this.demoMode
        ? "AI sẽ trả lời lung tung khi không có KB (dùng kiến thức chung)"
        : "AI từ chối trả lời khi không có KB (production mode)",
    };
  }

  /**
   * Clear cache (để admin có thể clear khi update knowledge base)
   */
  clearCache() {
    this.responseCache.flushAll();
    return {
      message: "Cache cleared successfully",
      stats: this.responseCache.getStats(),
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.responseCache.getStats();
  }

  /**
   * Validate và generate session ID
   * @private
   */
  _validateAndGenerateSessionId(clientSessionId, clientIp) {
    let sessionId = clientSessionId;

    if (sessionId) {
      // Validate format
      if (!SessionManager.validateSessionId(sessionId)) {
        sessionId = SessionManager.generateSessionId(clientIp);
        console.warn(
          `[GEMINI] Invalid sessionId format, generated new: ${sessionId}`
        );
      }
      // Check expired (24 hours)
      else if (SessionManager.isExpired(sessionId, 24 * 60 * 60 * 1000)) {
        sessionId = SessionManager.generateSessionId(clientIp);
        console.warn(`[GEMINI] Expired sessionId, generated new: ${sessionId}`);
      }
    } else {
      // Generate new session ID
      sessionId = SessionManager.generateSessionId(clientIp);
    }

    return sessionId;
  }

  /**
   * Chat with validation (wrapper for controller)
   * Xử lý toàn bộ: session validation + chat
   *
   * @param {string} message - Câu hỏi của user
   * @param {Object} options - { clientSessionId, clientIp, history }
   */
  async chatWithValidation(
    message,
    { clientSessionId, clientIp, history = [] }
  ) {
    // Validate và generate session ID
    const sessionId = this._validateAndGenerateSessionId(
      clientSessionId,
      clientIp
    );

    // Chat với Gemini
    const result = await this.chat(message, {
      sessionId,
      history,
    });

    return {
      ...result,
      sessionId,
    };
  }
}

module.exports = new GeminiService();
