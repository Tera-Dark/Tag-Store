import { defineStore } from 'pinia';
import type {
  ServiceProviders,
  ServiceProvider,
  PromptTemplate,
  HistoryItem,
  AdvancedOptions,
  Conversation,
  Model,
} from '../types/aiExpand';

import {
  loadServiceProviders,
  saveServiceProviders,
  loadAdvancedOptions,
} from '../services/aiExpand/apiService';

import { handleApiError } from '../utils/errorHandling';

import {
  loadTemplates,
  saveTemplate,
} from '../services/aiExpand/templateService';

import {
  loadHistory,
  saveHistory,
  clearHistory
} from '../services/aiExpand/historyService';

// --- Helper: Define Generic Fetch Functions --- 

const fetchOpenAICompatible = async (prompt: string, provider: ServiceProvider, model: string, options: AdvancedOptions | undefined, signal: AbortSignal | undefined): Promise<string> => {
  console.log(`[fetchEquivalent] Called for OpenAI Compatible Provider: ${provider.name}. Model:`, model, 'Options:', options);
  const messages = [{ role: 'user', content: prompt }];
  const requestBody: Record<string, any> = {
    model: model,
    messages: messages,
    stream: false,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 1024,
    top_p: options?.top_p ?? 0.7,
  };
  if (options?.top_k !== undefined) { requestBody.top_k = options.top_k; }
  if (options?.frequency_penalty !== undefined) { requestBody.frequency_penalty = options.frequency_penalty; }
  if (options?.stop !== undefined) { requestBody.stop = options.stop; }
  
  console.log(`[fetchEquivalent] ${provider.name} Request body:`, JSON.stringify(requestBody));

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      ...(provider.customHeaders || {}),
    },
    body: JSON.stringify(requestBody),
    signal: signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: any = null;
    try { errorJson = JSON.parse(errorText); } catch (e) {}
    const errorMessage = errorJson?.error?.message || errorJson?.message || response.statusText;
    const errorDetails = errorJson ? JSON.stringify(errorJson) : errorText;
    console.error(`[fetchEquivalent] ${provider.name} API Error: ${response.status} ${errorMessage}`, errorDetails);
    throw new Error(`${provider.name} API Error: ${response.status} ${errorMessage}. Details: ${errorDetails}`);
  }
  const data = await response.json();
  console.log(`[fetchEquivalent] ${provider.name} Response Data:`, data);
  return data.choices[0]?.message?.content || '';
};

const fetchSiliconFlow = async (prompt: string, provider: ServiceProvider, model: string, options: AdvancedOptions | undefined, signal: AbortSignal | undefined): Promise<string> => {
    console.log('[fetchEquivalent] Called for SiliconFlow. Model:', model, 'Options:', options);
    const messages = [{ role: 'user', content: prompt }];
    const requestBodySf: Record<string, any> = {
        model: model,
        messages: messages,
        stream: false,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 1024,
        top_p: options?.top_p ?? 0.7,
    };
    if (options?.top_k !== undefined) { requestBodySf.top_k = options.top_k; }
    if (options?.frequency_penalty !== undefined) { requestBodySf.frequency_penalty = options.frequency_penalty; }
    if (options?.stop !== undefined) { requestBodySf.stop = options.stop; }
    if (options?.responseFormat) { // SiliconFlow uses response_format
        // Assuming responseFormat in options is the string 'text' or similar for now
        // API expects object like { type: "text" }
        if (typeof options.responseFormat === 'string' && options.responseFormat.toLowerCase() === 'text') {
             requestBodySf.response_format = { type: "text" };
        } else if (typeof options.responseFormat === 'object') { // If it's already an object
             requestBodySf.response_format = options.responseFormat;
        } else {
             requestBodySf.response_format = { type: "text" }; // Default
        }
    }
     else {
         requestBodySf.response_format = { type: "text" }; // Default
    }
    console.log('[fetchEquivalent] SiliconFlow Request body:', JSON.stringify(requestBodySf));
    const responseSf = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBodySf),
        signal: signal
    });
    if (!responseSf.ok) {
        const errorTextSf = await responseSf.text();
        let errorJsonSf: any = null;
        try { errorJsonSf = JSON.parse(errorTextSf); } catch (e) {}
        const errorMessageSf = errorJsonSf?.error?.message || errorJsonSf?.message || responseSf.statusText;
        const errorDetailsSf = errorJsonSf ? JSON.stringify(errorJsonSf) : errorTextSf;
        console.error(`[fetchEquivalent] SiliconFlow API Error: ${responseSf.status} ${errorMessageSf}`, errorDetailsSf);
        throw new Error(`SiliconFlow API Error: ${responseSf.status} ${errorMessageSf}. Details: ${errorDetailsSf}`);
    }
    const dataSf = await responseSf.json();
    console.log('[fetchEquivalent] SiliconFlow Response Data:', dataSf);
    return dataSf.choices[0]?.message?.content || '';
};

// --- Store Definition ---

const defaultProviderIDs = ['openrouter', 'siliconflow']; // IDs of non-custom providers

// Define essential default templates that should always exist
const essentialDefaultTemplates: PromptTemplate[] = [
  {
    label: 'AI绘画提示词扩写 (SD风格)',
    value: 'sd_prompt_expand',
    content: "You are an AI assistant specialized in generating detailed, comma-separated English tags for AI image generation platforms like Stable Diffusion. " +
             "Based on the user's input, expand it into a rich list of descriptive tags. " +
             "The output MUST be a single line of English tags, separated by commas. Do not add any other text, sentences, or explanations.\n\n" +
             "Example Input: \"a beautiful elven sorceress in a dark forest\"\n" +
             "Example Output Tags: \"1girl, solo, elf, sorceress, long_hair, pointy_ears, magical_staff, flowing_robe, dark_forest, ancient_trees, mystical_atmosphere, (masterpiece:1.2), (best_quality)\"\n\n" +
             "User Input: {content}\n\n" +
             "Output Tags (comma-separated English tags only):"
  },
  // Add other essential templates here if needed, e.g., the general text expander
  {
    label: '通用文本扩写',
    value: 'general_text_expand',
    content: "Please expand the following text, making it more detailed, richer, and more comprehensive. " +
             "Maintain the original intent and key information, but elaborate on the concepts, provide examples if applicable, and improve the overall flow and readability.\n\n" +
             "Original Text: {content}\n\n" +
             "Expanded Text:"
  }
];

export const useAiExpandStore = defineStore('aiExpand', {
  state: () => {
    // 1. Define hardcoded default providers
    const defaultProviders: ServiceProviders = {
      openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKey: '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',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'deepseek/deepseek-r1:free',
        modelGroups: [
          {
            id: 'deepseek_openrouter_group',
            name: 'DeepSeek Models (OpenRouter)',
            models: [
              { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek-R1 (Free) (推荐)' },
            ]
          },
          {
            id: 'other_openrouter_group',
            name: 'Other Models (OpenRouter)',
            models: [
              { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral-7B Instruct (Free)' },
              { id: 'gryphe/mythomax-l2-13b:free', name: 'MythoMax-L2 13B (Free)' },
            ]
          }
        ],
        enabled: true,
        customHeaders: { 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'TagStore AI Expand' },
        isCustom: false,
        apiType: 'openai_compatible',
        fetchEquivalent: fetchOpenAICompatible // Assign the helper
      },
      siliconflow: {
        id: 'siliconflow',
        name: '硅基流动',
        apiKey: 'sk-zzvfbjuitzusxvjwztcfrlpnjzcfdkutdkgxnhrwgihtytkh',
        baseUrl: 'https://api.siliconflow.cn/v1',
        defaultModel: 'deepseek-ai/DeepSeek-R1',
        modelGroups: [
          { id: 'deepseek_sf', name: 'DeepSeek (SF)', models: [{ id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1' }, { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3' }] },
          { id: 'qwen_sf', name: 'Qwen (SF)', models: [{ id: 'Qwen/Qwen3-32B', name: 'Qwen3-32B' }, { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B Instruct' }] }
        ],
        enabled: true,
        isCustom: false,
        apiType: 'siliconflow',
        fetchEquivalent: fetchSiliconFlow // Assign the helper
      }
    };

    // 2. Load potentially all saved providers from storage
    const loadedProviders = loadServiceProviders(); 

    // 3. Merge default and loaded providers with refined logic
    const mergedProviders: ServiceProviders = { ...defaultProviders }; // Start with current defaults

    for (const id in loadedProviders) {
        const loadedProvider = loadedProviders[id];
        if (defaultProviders[id]) { // If loaded provider ID matches a default one
            // Only override specific fields from loaded data for default providers
            mergedProviders[id] = {
                ...defaultProviders[id], // Keep most defaults (name, baseUrl, models, apiType, fetchFn)
                apiKey: loadedProvider.apiKey || defaultProviders[id].apiKey, // Update apiKey if loaded
                enabled: loadedProvider.enabled !== undefined ? loadedProvider.enabled : defaultProviders[id].enabled, // Update enabled if loaded
                // Optionally update defaultModel if you want user selection to persist
                // defaultModel: loadedProvider.defaultModel || defaultProviders[id].defaultModel,
                isCustom: false, // Ensure it remains marked as non-custom
            };
        } else { // It's a truly custom provider (not in defaultProviders keys)
             // Ensure custom providers loaded from storage have fetch function assigned based on apiType
            if (loadedProvider.isCustom === undefined) loadedProvider.isCustom = true; // Mark as custom if flag missing
            mergedProviders[id] = {
                ...loadedProvider,
                fetchEquivalent: loadedProvider.apiType === 'siliconflow' ? fetchSiliconFlow : fetchOpenAICompatible
            };
        }
    }
    // Ensure all default providers are present even if not in loaded data
    Object.keys(defaultProviders).forEach(id => {
        if (!mergedProviders[id]) {
            mergedProviders[id] = defaultProviders[id];
        }
    });

    // 4. Load templates robustly
    let loadedTemplates = loadTemplates(essentialDefaultTemplates); 
    let templatesModified = false; // Flag to track if we need to save later

    // Ensure essential default templates exist (double check, in case loadTemplates didn't add them)
    essentialDefaultTemplates.forEach(defaultTemplate => {
      if (!loadedTemplates.some(t => t.value === defaultTemplate.value)) {
        loadedTemplates = [defaultTemplate, ...loadedTemplates]; // Add missing default to the beginning
        templatesModified = true;
        console.log(`[Store Init] Added missing default template (post-load check): ${defaultTemplate.label}`);
      }
    });

    // Filter out old/unwanted templates (e.g., old 'general' if replaced)
    const initialLength = loadedTemplates.length;
    loadedTemplates = loadedTemplates.filter(t => t.value !== 'general');
    if (loadedTemplates.length < initialLength) {
        templatesModified = true;
        console.log(`[Store Init] Removed old template with value 'general'.`);
    }

    // 5. Save templates back if they were modified during initialization
    if (templatesModified) {
      console.log('[Store Init] Saving modified template list back to storage.');
      saveTemplate(loadedTemplates);
    }
    
    // 6. Determine initial selected template
    let initialSelectedTemplate = 'sd_prompt_expand'; // Preferred default
    const currentSelectedTemplateExists = loadedTemplates.some(t => t.value === initialSelectedTemplate);
    if (!currentSelectedTemplateExists) {
        // Fallback if preferred default doesn't exist for some reason
        initialSelectedTemplate = loadedTemplates.length > 0 ? loadedTemplates[0].value : '';
    }

    // 7. Return the initial state
    return {
      serviceProviders: mergedProviders,
      selectedProvider: 'openrouter', 
      selectedModel: '',
      templates: loadedTemplates,
      selectedTemplate: initialSelectedTemplate, 
      customPrompt: '',
      useCustomPrompt: false,
      history: loadHistory() as HistoryItem[],
      activeConversationId: '',
      conversations: [] as Conversation[],
      advancedOptions: loadAdvancedOptions() as AdvancedOptions,
      requestTimeout: 120000, 
      inputContent: '',
      outputContent: '',
      isProcessing: false,
      errorDetails: '',
      showErrorDetails: false,
      showSettingsDrawer: false,
      showTemplateEditor: false,
      showTemplateManager: false,
      showHelpModal: false,
      sidebarCollapsed: false,
      abortController: null as AbortController | null,
    };
  },
  
  getters: {
    currentProvider: (state) => state.serviceProviders[state.selectedProvider] || null,
    providerOptions: (state) => {
      return Object.entries(state.serviceProviders)
        .filter(([, provider]) => provider.enabled)
        .map(([id, provider]) => ({
          label: provider.name,
          value: id
        }));
    },
    currentModel: (state) => {
      const provider = state.serviceProviders[state.selectedProvider];
      return provider ? state.selectedModel || provider.defaultModel : '';
    },
    modelOptions: (state) => {
      try {
        const provider = state.serviceProviders[state.selectedProvider];
        if (!provider || !Array.isArray(provider.modelGroups)) {
          return [];
        }
        
        const options: any[] = [];
        
        if (provider.modelGroups && Array.isArray(provider.modelGroups)) {
          provider.modelGroups.forEach(group => {
            if (!group || !group.id || !group.name || !Array.isArray(group.models)) {
              return;
            }
            
            options.push({
              label: group.name,
              value: `group-${group.id}`,
              type: 'group'
            });
            
            if (group.models && Array.isArray(group.models)) {
              group.models.forEach(model => {
                if (!model || !model.id || !model.name) {
                  return;
                }
                
                options.push({
                  label: model.name,
                  value: model.id,
                  type: 'item'
                });
              });
            }
          });
        }
        
        return options;
      } catch (error) {
        console.error('解析模型选项失败:', error);
        return [];
      }
    },
    currentApiConfig: (state) => {
      const provider = state.serviceProviders[state.selectedProvider];
      if (!provider) return null;
      
      return {
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        model: state.selectedModel || provider.defaultModel,
        customHeaders: provider.customHeaders
      };
    },
    promptPreview: (state) => {
      if (!state.inputContent) return '';
      
      if (state.useCustomPrompt) {
        return state.customPrompt.replace('{content}', state.inputContent);
      }
      
      const template = state.templates.find(t => t.value === state.selectedTemplate);
      if (!template) return state.inputContent;
      
      if (!template.content.includes('{content}')) {
        return `${template.content}\n\n${state.inputContent}`;
      }
      
      return template.content.replace('{content}', state.inputContent);
    },
    activePromptForDisplay(state): string {
      if (state.useCustomPrompt && state.customPrompt) {
        const promptPreview = state.customPrompt.length > 100 ? state.customPrompt.substring(0, 97) + '...' : state.customPrompt;
        return `自定义提示: ${promptPreview}`;
      }
      if (state.selectedTemplate) {
        const template = state.templates.find(t => t.value === state.selectedTemplate);
        if (template && template.content) {
          const contentPreview = template.content.length > 100 ? template.content.substring(0, 97) + '...' : template.content;
          return `模板 (${template.label || '无名模板'}): ${contentPreview}`;
        }
      }
      return '';
    },
    customProviders: (state) => {
        return Object.values(state.serviceProviders).filter(p => p.isCustom);
    },
    isProviderDeletable: (state) => (providerId: string) => {
        return state.serviceProviders[providerId]?.isCustom === true;
    }
  },
  
  actions: {
    async initialize() {
      try {
        // Provider and model initialization
        if (!this.serviceProviders[this.selectedProvider]) {
          const firstAvailableProviderId = Object.keys(this.serviceProviders)[0];
          this.selectedProvider = firstAvailableProviderId || 'openrouter'; 
        }
        const currentProviderData = this.serviceProviders[this.selectedProvider];
        if (currentProviderData && !this.selectedModel) { // Set model only if not already set
          this.selectedModel = currentProviderData.defaultModel;
        } else if (!currentProviderData && this.serviceProviders.openrouter) { 
            this.selectedProvider = 'openrouter';
            this.selectedModel = this.serviceProviders.openrouter.defaultModel;
        } else if (!currentProviderData && this.serviceProviders.siliconflow) {
             this.selectedProvider = 'siliconflow';
            this.selectedModel = this.serviceProviders.siliconflow.defaultModel;
        }

        // Timeout loading
        const savedTimeout = localStorage.getItem('aiExpandRequestTimeout');
        if (savedTimeout) {
          this.requestTimeout = Number(savedTimeout);
        }

        // Template selection is handled by state initializer now

      } catch (error) {
        console.error('初始化AI扩写Store失败:', error);
      }
    },
    updateProvider(providerId: string, updates: Partial<Omit<ServiceProvider, 'id' | 'isCustom' | 'apiType' | 'fetchEquivalent'>> & { modelsText?: string }) {
        const provider = this.serviceProviders[providerId];
        if (!provider || !provider.isCustom) {
            console.error('Cannot update non-custom provider or provider not found:', providerId);
            return;
        }

        let updatedModelGroups = provider.modelGroups;
        if (updates.modelsText !== undefined) {
            const models: Model[] = [];
            const lines = updates.modelsText.trim().split('\n');
            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const id = parts[0].trim();
                    const name = parts.slice(1).join(',').trim();
                    if (id && name) {
                        models.push({ id, name });
                    }
                }
            });
            const customGroupIndex = updatedModelGroups.findIndex(g => g.id === 'custom_group');
            if (customGroupIndex !== -1) {
                 updatedModelGroups[customGroupIndex].models = models;
            } else if (models.length > 0){
                 updatedModelGroups = [...updatedModelGroups, { id: 'custom_group', name: 'Custom Models', models }];
            }
            delete updates.modelsText;
        }

        const updatedProvider: ServiceProvider = {
            ...provider,
            ...updates,
            modelGroups: updatedModelGroups,
            id: provider.id,
            isCustom: provider.isCustom,
            apiType: provider.apiType,
            fetchEquivalent: provider.fetchEquivalent 
        };
        
        this.serviceProviders[providerId] = updatedProvider;
        saveServiceProviders(this.serviceProviders);
    },
    deleteProvider(providerId: string) {
        const provider = this.serviceProviders[providerId];
        if (!provider || !provider.isCustom) {
            console.error('Cannot delete non-custom provider or provider not found:', providerId);
            return;
        }

        delete this.serviceProviders[providerId];

        if (this.selectedProvider === providerId) {
            const defaultProvider = defaultProviderIDs.find(id => this.serviceProviders[id]);
            this.selectedProvider = defaultProvider || Object.keys(this.serviceProviders)[0] || '';
             if (this.selectedProvider && this.serviceProviders[this.selectedProvider]) {
                 this.selectedModel = this.serviceProviders[this.selectedProvider].defaultModel;
             } else {
                 this.selectedModel = '';
             }
        }

        saveServiceProviders(this.serviceProviders);
    },
    async sendToAI() {
      if (!this.inputContent || this.isProcessing) return;

      this.isProcessing = true;
      this.errorDetails = '';
      this.showErrorDetails = false;
      
      const controller = new AbortController();
      this.abortController = controller;
      let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

      try {
        console.log(`[sendToAI] Request timeout set to: ${this.requestTimeout}ms`);
        timeoutId = setTimeout(() => {
          console.warn(`[sendToAI] Request explicitly timed out after ${this.requestTimeout}ms. Aborting...`);
          controller.abort();
        }, this.requestTimeout);
        
        const promptContent = this.useCustomPrompt
          ? this.customPrompt.replace('{content}', this.inputContent)
          : this.templates.find(t => t.value === this.selectedTemplate)?.content.replace('{content}', this.inputContent) || this.inputContent;
        
        const providerConfig = this.serviceProviders[this.selectedProvider];
        if (!providerConfig) throw new Error('服务提供商配置未找到');
        
        const modelToUse = this.selectedModel || providerConfig.defaultModel;

        let effectiveOptions = JSON.parse(JSON.stringify(this.advancedOptions));
        if (effectiveOptions.hasOwnProperty('maxOutputLength') && typeof effectiveOptions.maxOutputLength === 'number') {
            effectiveOptions.max_tokens = effectiveOptions.maxOutputLength;
            delete effectiveOptions.maxOutputLength;
            console.log(`[sendToAI] Converted maxOutputLength to max_tokens. New max_tokens: ${effectiveOptions.max_tokens}`);
        }

        console.log(`[sendToAI] Sending to AI. Provider: ${providerConfig.name}, Model: ${modelToUse}`);
        console.log('[sendToAI] API Key (first 5 chars): ', providerConfig.apiKey?.substring(0, 5));
        console.log('[sendToAI] Effective Advanced options being used:', JSON.stringify(effectiveOptions));
        console.log('[sendToAI] Prompt being sent:', promptContent);

        if (providerConfig.fetchEquivalent) {
            const result = await providerConfig.fetchEquivalent(
                promptContent,
                providerConfig,
                modelToUse,
                effectiveOptions,
                controller.signal
            );
            if (timeoutId) clearTimeout(timeoutId); 
            timeoutId = undefined; 
            this.outputContent = result;
            const historyItem: HistoryItem = {
              input: this.inputContent,
              output: result,
              timestamp: new Date().toISOString(),
              provider: this.selectedProvider
            };
            this.history = [historyItem, ...this.history];
            saveHistory(this.history);
        } else {
            throw new Error(`Provider ${providerConfig.name} does not have a fetchEquivalent method implemented.`);
        }

      } catch (error: any) {
        if (error.name !== 'AbortError' && timeoutId) {
          console.log('[sendToAI] Clearing timeout because an error occurred before timeout.');
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        console.error('[sendToAI] Error details:', error); 
        const errorInfo = handleApiError(error);
        this.errorDetails = typeof errorInfo === 'string' 
          ? errorInfo 
          : (errorInfo.details || error.message || '未知错误');
        this.showErrorDetails = true;
        this.outputContent = `发生错误: ${typeof errorInfo === 'string' ? errorInfo : errorInfo.message}`;
      } finally {
        if (timeoutId) {
            console.log('[sendToAI] Clearing timeout in finally block.');
            clearTimeout(timeoutId);
        }
        this.isProcessing = false;
      }
    },
    cancelRequest() {
      if (this.abortController) {
        console.log('[cancelRequest] Aborting active request...');
        this.abortController.abort();
        this.abortController = null;
        this.isProcessing = false;
        this.errorDetails = '请求已取消';
        if (this.outputContent === '') {
          this.outputContent = '请求已取消';
        }
      }
    },
    saveNewTemplate(template: PromptTemplate) {
      const existingIndex = this.templates.findIndex(t => t.value === template.value);
      
      if (existingIndex >= 0) {
        this.templates[existingIndex] = template;
      } else {
        this.templates.push(template);
      }
      
      saveTemplate(this.templates);
    },
    deleteTemplate(templateValue: string) {
      this.templates = this.templates.filter(t => t.value !== templateValue);
      
      if (this.selectedTemplate === templateValue && this.templates.length > 0) {
        this.selectedTemplate = this.templates[0].value;
      }
      
      saveTemplate(this.templates);
    },
    createNewConversation() {
      this.inputContent = '';
      this.outputContent = '';
    },
    clearAllHistory() {
      this.history = [];
      clearHistory();
    },
    updateTemplate(updatedTemplate: PromptTemplate) {
        const index = this.templates.findIndex(t => t.value === updatedTemplate.value);
        if (index !== -1) {
            this.templates[index] = { ...updatedTemplate };
            saveTemplate(this.templates);
        }
    },
    importTemplates(importedTemplates: PromptTemplate[]) {
        const existingValues = new Set(this.templates.map(t => t.value));
        const newTemplates = importedTemplates.filter(t => t.label && t.value && t.content !== undefined && !existingValues.has(t.value));
        this.templates.push(...newTemplates);
        saveTemplate(this.templates);
    }
  }
}); 