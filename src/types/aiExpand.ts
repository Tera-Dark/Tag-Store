// AI扩写工具的类型定义

// 模型定义
export interface Model {
  id: string;         // 模型ID
  name: string;       // 模型显示名称
  maxTokens?: number; // 最大token数（可选）
  capabilities?: string[]; // 模型支持的功能（可选）
}

// 模型分组
export interface ModelGroup {
  id: string;        // 分组ID
  name: string;      // 分组名称
  models: Model[];   // 该分组下的模型列表
}

// 服务提供商定义
export interface ServiceProvider {
  id: string;        // 服务商ID（如'openai'）
  name: string;      // 服务商显示名称（如'OpenAI'）
  description?: string; // 服务商描述（可选）
  apiKey: string;    // API密钥
  baseUrl: string;   // API基础URL
  defaultModel: string; // 默认模型ID
  customHeaders?: Record<string, string>; // 自定义请求头 (Make optional as custom might not need it)
  modelGroups: ModelGroup[]; // 模型分组列表
  enabled: boolean;  // 是否启用
  fetchEquivalent?: (
    prompt: string,
    provider: ServiceProvider,
    model: string,
    options: AdvancedOptions | undefined,
    signal: AbortSignal | undefined
  ) => Promise<string>;
  isCustom?: boolean; // Added: Flag for custom providers
  apiType: 'openai_compatible' | 'siliconflow'; // Added: API type for handling requests
}

// 服务提供商集合
export type ServiceProviders = Record<string, ServiceProvider>;

// 会话项接口
export interface HistoryItem {
  input: string;
  output: string;
  timestamp: string;
  provider: string;
}

// 会话接口
export interface Conversation {
  id: string;
  title: string;
  items: HistoryItem[];
  createdAt: string;
  updatedAt: string;
  provider: string;
}

// API配置接口
export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  customHeaders: Record<string, string>;
}

// 所有服务提供商的API配置
export interface ApiConfigs {
  [key: string]: ApiConfig;
}

// 高级选项接口
export interface AdvancedOptions {
  temperature?: number;         // 改为可选
  max_tokens?: number;          // 原 maxOutputLength，重命名并改为可选
  top_p?: number;               // 新增，可选
  top_k?: number;               // 新增，可选
  frequency_penalty?: number;   // 新增，可选
  stop?: string | string[];     // 新增，可选
  responseFormat?: string;      // 保留为string，但提示其可能需要是对象。设为可选。
  streaming?: boolean;          // 改为可选
}

// 自定义请求头接口
export interface CustomHeader {
  key: string;
  value: string;
}

// 可用模型接口
export interface AvailableModels {
  [key: string]: {
    label: string;
    value: string;
  }[];
}

// 服务提供商列表项接口
export interface ProviderListItem {
  id: string;
  name: string;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  customHeaders: Record<string, string>;
  headersArray?: CustomHeader[];
  modelGroups?: ModelGroup[];
  description?: string;
}

// 提示词模板接口
export interface PromptTemplate {
  label: string;
  value: string;
  content: string;
} 