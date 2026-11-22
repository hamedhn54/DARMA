import type { AIProvider, AIMessage } from "./types";

export class DeepSeekProvider implements AIProvider {
  name = "Hormouz (DeepSeek)";

  async generateResponse(messages: AIMessage[]): Promise<string> {
    // کلیدی که در تنظیمات دارما وارد می‌کنید از اینجا خوانده می‌شود
    const apiKey = localStorage.getItem("darma_deepseek_key");
    if (!apiKey) throw new Error("کلید API یافت نشد. لطفاً به تنظیمات بروید.");

    try {
      // آدرس API هرمز و مدل دیپ‌سیک
      const response = await fetch("https://api.hormouz.net/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${apiKey}` 
        },
        body: JSON.stringify({ 
            model: "google/gemma-4-31b-it:free", // اگر هرمز مدل دیگری داشت، اسم آن را اینجا بگذارید
            messages: messages, 
            temperature: 0.3 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `خطا با کد وضعیت ${response.status}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("AI Error:", error);
      throw error;
    }
  }
}