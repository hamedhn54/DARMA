import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { askFinancialAssistant } from "../services/ai/orchestrator";
import { getFinancialContext } from "../services/ai/contextBuilder";
import "./AIChatPage.css";

interface Message { role: "user" | "assistant"; content: string; }

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "سلام! من دستیار هوشمند دارما هستم. می‌توانم وضعیت مالی شما را تحلیل کنم، بودجه پیشنهاد بدهم یا به سوالات مالی‌تان پاسخ دهم. چه کاری برایتان انجام دهم؟" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const context = await getFinancialContext();
      const response = await askFinancialAssistant(userMsg, context);
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: `خطا: ${error instanceof Error ? error.message : "ارتباط برقرار نشد."}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ai-chat-page" dir="rtl">
      <header className="ai-chat-header">
        <div>
          <span>دستیار مالی هوشمند</span>
          <h1>مشاور و تحلیلگر دارما</h1>
          <p>سوالات خود را درباره هزینه‌ها، اقساط، بودجه و وضعیت مالی بپرسید.</p>
        </div>
      </header>

      <div className="ai-chat-container">
        <div className="ai-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`ai-message ${msg.role}`}>
              <div className="ai-avatar">{msg.role === "assistant" ? <Bot size={20}/> : <User size={20}/>}</div>
              <div className="ai-bubble">{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className="ai-message assistant">
              <div className="ai-avatar"><Bot size={20}/></div>
              <div className="ai-bubble loading"><Loader2 size={18} className="spin"/> در حال تحلیل اطلاعات...</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="ai-input-area">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="مثلاً: این ماه چقدر هزینه کرده‌ام؟" 
            disabled={loading}
          />
          <button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
