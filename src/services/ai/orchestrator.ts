import type { AIProvider, AIMessage } from "./types";
import { DeepSeekProvider } from "./deepseekProvider";

const activeProvider: AIProvider = new DeepSeekProvider();

export async function askFinancialAssistant(userQuestion: string, financialContext: string): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `تو یک دستیار مالی حرفه‌ای در سامانه «دارما» هستی. اطلاعات مالی کاربر: \n${financialContext}`
    },
    {
      role: "user",
      content: userQuestion
    }
  ];
  return await activeProvider.generateResponse(messages);
}
