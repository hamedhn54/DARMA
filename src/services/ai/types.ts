
/**
 * DARMA AI Core Types
 * نسخه توسعه‌یافته قراردادهای هوش مصنوعی
 */

// --------------------------------------------------
// 1. Message Types
// --------------------------------------------------

export type AIMessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string;

  // نام ابزار یا فرستنده پیام، در صورت نیاز
  name?: string;

  // شناسه فراخوانی ابزار
  tool_call_id?: string;

  // فراخوانی ابزار توسط دستیار
  tool_calls?: AIToolCall[];
}

// --------------------------------------------------
// 2. Provider Types
// --------------------------------------------------

export type AIProviderId = string;

export interface AIProviderConfig {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AIProviderCapabilities {
  streaming?: boolean;
  toolCalling?: boolean;
  jsonMode?: boolean;
}

export interface AIProviderDescriptor {
  id: AIProviderId;
  name: string;
  description?: string;
  models: string[];
  capabilities?: AIProviderCapabilities;
}

// --------------------------------------------------
// 3. Request Options
// --------------------------------------------------

export interface AIRequestOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: "text" | "json";
  tools?: AIToolDefinition[];
}

// --------------------------------------------------
// 4. Tool Calling Types
// --------------------------------------------------

export interface AIToolDefinition {
  type: "function";

  function: {
    name: string;
    description: string;

    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
}

export interface AIToolCall {
  id: string;

  type: "function";

  function: {
    name: string;
    arguments: string;
  };
}

export interface AIToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// --------------------------------------------------
// 5. AI Response Types
// --------------------------------------------------

export interface AIResponse {
  content: string | null;

  toolCalls?: AIToolCall[];

  finishReason?: string;

  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// --------------------------------------------------
// 6. Provider Interface
// --------------------------------------------------

export interface AIProvider {
  name: string;

  // متد فعلی برای حفظ سازگاری با نسخه موجود دارما
  generateResponse(
    messages: AIMessage[]
  ): Promise<string>;

  // متد پیشرفته برای پشتیبانی از Tool Calling
  generateAdvancedResponse?(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<AIResponse>;
}

// --------------------------------------------------
// 7. Conversation Types
// --------------------------------------------------

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

// --------------------------------------------------
// 8. Assistant Roles
// --------------------------------------------------

export type AIAssistantRole =
  | "analyst"
  | "advisor"
  | "manager";

export interface AIAssistantConfig {
  role: AIAssistantRole;
  name: string;
  description: string;
  systemPrompt: string;
}
