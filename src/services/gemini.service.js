const { chatModel } = require("@config/gemini");
const {
  Product,
  Category,
  Brand,
  Order,
  KnowledgeDocument,
} = require("@models");
const NodeCache = require("node-cache");
const SessionManager = require("@utils/sessionManager");

/**
 * Gemini AI Service với RAG (Retrieval-Augmented Generation)
 */
class GeminiService {
  constructor() {
    // LRU Cache với TTL tự động cleanup
    this.responseCache = new NodeCache({
      stdTTL: 3600, // 1 hour
      checkperiod: 600, // Check every 10 mins để cleanup expired
      maxKeys: 1000, // Giới hạn 1000 entries
      useClones: false, // Performance optimization
    });

    // DEMO MODE: Cho phép AI trả lời lung tung khi chưa có KB
    // Set = false để bật strict mode (production)
    // Set = true để demo AI trả lời sai khi chưa train (demo purpose)
    // Default to true for development/demo purposes
    this.demoMode = process.env.GEMINI_DEMO_MODE !== "false";
  }

  /**
   * Build context từ Knowledge Base + Real-time data
   */
  async buildContext(userQuery, userId = null) {
    const contextParts = [];

    // FIX Issue #4: Sanitize user input để tránh NoSQL injection và regex DoS
    const sanitizedQuery = userQuery
      .replace(/[${}]/g, "") // Remove MongoDB operators
      .replace(/[\\^$.*+?()[\]|]/g, " ") // Remove regex special chars
      .slice(0, 500) // Limit length để tránh DoS
      .trim();

    // 1. Search Knowledge Base (MongoDB Text Search)
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

    // CRITICAL FIX: Không có knowledge → return null để reject câu hỏi
    if (knowledgeDocs.length === 0) {
      return null; // Sẽ được handle ở chat()
    }

    contextParts.push("📚 KIẾN THỨC CƠ BẢN:");
    knowledgeDocs.forEach((doc) => {
      contextParts.push(`\n[${doc.category.toUpperCase()}] ${doc.title}`);
      contextParts.push(doc.content);
    });

    // 2. Search sản phẩm liên quan (nếu query về sản phẩm)
    // FIX Issue #4: Sử dụng sanitizedQuery thay vì userQuery để tránh injection
    const productKeywords = this.extractProductKeywords(sanitizedQuery);
    if (productKeywords.length > 0) {
      // FIX Issue #4: Escape regex special chars trong keywords
      const escapedKeywords = productKeywords.map((k) =>
        k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );
      const products = await Product.find({
        $or: [
          { name: { $regex: escapedKeywords.join("|"), $options: "i" } },
          { description: { $regex: escapedKeywords.join("|"), $options: "i" } },
        ],
        isActive: true,
      })
        .populate("brand", "name")
        .populate("category", "name")
        .limit(5)
        .select("name price brand category description stock");

      if (products.length > 0) {
        contextParts.push("\n\n👟 SẢN PHẨM LIÊN QUAN:");
        products.forEach((p) => {
          const priceFormatted = p.price?.toLocaleString("vi-VN") || "Liên hệ";
          const stock = p.stock > 0 ? "Còn hàng" : "Hết hàng";
          contextParts.push(
            `- ${p.name} (${
              p.brand?.name || "N/A"
            }) - ${priceFormatted}đ - ${stock}`
          );
        });
      }
    }

    // 3. Thông tin cá nhân hóa (nếu user đã đăng nhập)
    if (userId) {
      const recentOrder = await Order.findOne({ user: userId })
        .sort({ createdAt: -1 })
        .select("orderNumber status totalAmount items")
        .populate("items.variant", "color");

      if (recentOrder) {
        contextParts.push("\n\n📦 ĐƠN HÀNG GẦN NHẤT CỦA KHÁCH:");
        contextParts.push(`- Mã đơn: #${recentOrder.orderNumber}`);
        contextParts.push(
          `- Trạng thái: ${this.translateStatus(recentOrder.status)}`
        );
        contextParts.push(
          `- Tổng tiền: ${recentOrder.totalAmount?.toLocaleString("vi-VN")}đ`
        );
      }
    }

    // 4. Static policies (luôn có)
    contextParts.push("\n\n📋 CHÍNH SÁCH QUAN TRỌNG:");
    contextParts.push(
      "- Đổi trả: 7 ngày, sản phẩm chưa qua sử dụng, còn tem mác"
    );
    contextParts.push("- Vận chuyển: Miễn phí đơn >500k, giao hàng 2-5 ngày");
    contextParts.push("- Thanh toán: COD, VNPAY, chuyển khoản ngân hàng");
    contextParts.push("- Hotline hỗ trợ: 1900 xxxx (8h-22h hàng ngày)");

    return contextParts.join("\n");
  }

  /**
   * Extract product keywords từ user query
   */
  extractProductKeywords(text) {
    const keywords = [];
    const brands = [
      "nike",
      "adidas",
      "puma",
      "converse",
      "vans",
      "new balance",
    ];
    const types = ["giày", "sneaker", "boot", "sandal", "dép", "slipper"];
    const purposes = ["chạy bộ", "bóng đá", "tennis", "công sở", "đi chơi"];

    const lowerText = text.toLowerCase();

    brands.forEach((brand) => {
      if (lowerText.includes(brand)) keywords.push(brand);
    });

    types.forEach((type) => {
      if (lowerText.includes(type)) keywords.push(type);
    });

    purposes.forEach((purpose) => {
      if (lowerText.includes(purpose)) keywords.push(purpose);
    });

    return keywords;
  }

  /**
   * Translate order status sang tiếng Việt
   * SYNC với Order schema status enum
   */
  translateStatus(status) {
    const statusMap = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      assigned_to_shipper: "Đã giao cho shipper",
      out_for_delivery: "Đang giao hàng",
      delivered: "Đã giao hàng",
      delivery_failed: "Giao hàng thất bại",
      returning_to_warehouse: "Đang trả về kho",
      cancelled: "Đã hủy",
      returned: "Đã hoàn trả",
      refunded: "Đã hoàn tiền",
    };
    return statusMap[status] || status;
  }

  /**
   * Validate câu hỏi có trong phạm vi không
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
   */
  async chat(userMessage, { sessionId, userId = null, history = [] }) {
    try {
      // 1. Validate scope
      if (!this.isInScope(userMessage)) {
        return {
          response:
            "Xin lỗi, tôi chỉ có thể hỗ trợ về sản phẩm giày và dịch vụ của shop. Bạn có câu hỏi nào khác không? 😊",
          outOfScope: true,
        };
      }

      // 3. Build context TRƯỚC để tránh cache collision (Bug #56)
      const context = await this.buildContext(userMessage, userId);

      // 2. Check cache - FIXED Bug #56: Thêm hasContext vào cache key để tránh collision
      // Nếu user A có context cá nhân và user B không có, họ sẽ có cache key khác nhau
      const contextHash = context ? "ctx" : "noctx";
      const cacheKey = `${
        userId || "guest"
      }_${contextHash}_${userMessage.toLowerCase()}`;
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        return { response: cached, cached: true };
      }

      // DEMO MODE: Cho phép AI trả lời lung tung khi chưa có KB
      if (!context && !this.demoMode) {
        // Production mode: Từ chối trả lời khi không có KB
        return {
          response:
            "Xin lỗi, tôi không có đủ thông tin để trả lời câu hỏi này. Vui lòng chat với nhân viên hỗ trợ hoặc gọi hotline 1900 xxxx. 🙏",
          noKnowledge: true,
        };
      }

      // DEMO MODE: AI sẽ trả lời bằng kiến thức chung (có thể sai)
      if (!context && this.demoMode) {
        console.warn(
          "[GEMINI DEMO MODE] AI đang trả lời KHÔNG dựa trên KB - có thể SAI thông tin!"
        );
      }

      // 4. Prepare chat history
      const chatHistory = history.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      // 5. Create chat session
      const chat = chatModel.startChat({
        history: chatHistory,
      });

      // 6. Send message với/không context (tùy demo mode)
      let fullPrompt;
      if (context) {
        fullPrompt = `NGỮ CẢNH:\n${context}\n\n---\n\nCÂU HỎI KHÁCH HÀNG: ${userMessage}`;
      } else {
        // Demo mode: AI trả lời trực tiếp (có thể lung tung)
        fullPrompt = userMessage;
      }

      // FIX Issue #23: Add timeout để tránh hanging indefinitely
      const GEMINI_TIMEOUT = 30000; // 30 seconds
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

      // 7. Cache response (NodeCache tự động cleanup theo TTL)
      this.responseCache.set(cacheKey, response);

      return {
        response,
        hasContext: context ? context.length > 100 : false,
        noKnowledge: !context, // Flag để frontend biết AI đang trả lời không có KB
        demoMode: this.demoMode,
      };
    } catch (error) {
      console.error("[GEMINI] Chat error:", error);

      // Fallback response
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
  _validateAndGenerateSessionId(clientSessionId, userId, clientIp) {
    let sessionId = clientSessionId;

    if (sessionId) {
      // Validate format
      if (!SessionManager.validateSessionId(sessionId)) {
        sessionId = SessionManager.generateSessionId(userId || clientIp);
        console.warn(
          `[GEMINI] Invalid sessionId format, generated new: ${sessionId}`
        );
      }
      // Check expired
      else if (SessionManager.isExpired(sessionId, 24 * 60 * 60 * 1000)) {
        sessionId = SessionManager.generateSessionId(userId || clientIp);
        console.warn(`[GEMINI] Expired sessionId, generated new: ${sessionId}`);
      }
    } else {
      // Generate new session ID
      sessionId = SessionManager.generateSessionId(userId || clientIp);
    }

    return sessionId;
  }

  /**
   * Chat with validation (wrapper for controller)
   * Xử lý toàn bộ: session validation + chat
   */
  async chatWithValidation(
    message,
    { clientSessionId, userId = null, clientIp, history = [] }
  ) {
    // Validate và generate session ID
    const sessionId = this._validateAndGenerateSessionId(
      clientSessionId,
      userId,
      clientIp
    );

    // Chat với Gemini
    const result = await this.chat(message, {
      sessionId,
      userId,
      history,
    });

    return {
      ...result,
      sessionId,
    };
  }
}

module.exports = new GeminiService();
