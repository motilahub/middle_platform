export type ModelVendor = 'openai' | 'deepseek' | 'qwen' | 'zhipu' | 'siliconflow' | 'moonshot' | 'custom'

export interface ModelProvider {
  id: number
  code: string
  name: string
  vendor: ModelVendor
  baseUrl: string
  apiKey?: string
  hasApiKey: boolean
  enabled: boolean
  models: string[]
  defaultModel?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface ModelProviderTestResult {
  success: boolean
  modelCount: number
  message: string
}
