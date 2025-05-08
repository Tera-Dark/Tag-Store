# TagStore - 现代化标签管理与 AI 扩写助手

一个使用 Vue 3, TypeScript, Pinia, Naive UI 和 Dexie (IndexedDB) 构建的功能丰富的本地标签管理系统，集成了强大的 AI 扩写与辅助生成工具。

## 主要特性

### 标签管理核心

*   **多标签库管理**: 创建、切换、重命名、删除多个独立的标签库，数据隔离。
*   **分类管理**: 在当前库中添加、编辑、删除分类。
*   **标签管理**: 添加、编辑、删除标签（支持名称、副标题、关键词、权重、颜色等），网格视图展示，点击复制关键词。
*   **搜索与筛选**: 按分类筛选，全局搜索标签内容。
*   **批量操作**: 批量选择、删除、移动标签。
*   **收藏夹**: 快速访问和使用常用标签。

### 工具箱

*   **标签购物车**: 浏览、选择、组合、编辑和复制标签。
*   **权重添加器**: 为标签应用权重和括号风格（如 `(tag:1.2)`, `[tag]`)，支持预设和自定义模板。
*   **标签抽取器**: 从文本中自动提取潜在标签并添加到库中。

### AI 扩写工具 (重点功能)

*   **聊天式交互**: 提供输入和输出分离的编辑器界面。
*   **多服务商支持**: 
    *   内置预配置 **OpenRouter** 和 **硅基流动 (SiliconFlow)** 服务商。
    *   **支持用户自定义添加、编辑、删除服务商** (需在设置界面进行配置，需提供名称、API类型、API Key、Base URL、模型列表)。
    *   区分默认服务商和自定义服务商，保护默认配置。
    *   支持 OpenAI 兼容 和 SiliconFlow 两种 API 类型。
*   **模型选择**: 用户可在所选服务商提供的模型列表中选择具体模型。
*   **提示词模板管理**: 
    *   创建、管理、编辑、删除、导入/导出自定义提示词模板。
    *   内置 **"AI绘画提示词扩写 (SD风格)"** 模板，引导 AI 输出逗号分隔的英文标签。
    *   内置 **"通用文本扩写"** 模板。
    *   可在侧边栏选择模板或启用自定义提示词。
*   **当前提示词显示**: 在输入框上方清晰展示当前生效的提示词模板或自定义提示词（预览）。
*   **高级选项**: 支持配置 `temperature`, `max_tokens`, `top_p`, `top_k`, `frequency_penalty`, `stop` 等参数 (通过 `aiExpandStore.state.advancedOptions` 配置)。
*   **请求控制**: 
    *   包含可配置的 API 请求超时时间 (默认为 120 秒，可在 store 中修改)。
    *   支持取消正在进行的 AI 请求 (TODO: 取消按钮功能待完全实现)。
    *   包含加载状态指示。
*   **历史记录**: 自动保存 AI 请求的输入、输出、时间戳和服务商信息，方便回顾。
*   **结果处理**: 提供一键复制 AI 输出结果的功能。
*   **错误处理与提示**: 包含 API 错误处理和用户友好的消息提示 (使用 Naive UI `useMessage`, `useDialog`)。
*   **用户帮助**: 提供内置的使用帮助说明模态框，包含对潜在长响应时间的提示。

### 其他特性

*   **数据持久化**: 
    *   标签库数据 (库、分类、标签) 使用 **Dexie.js (IndexedDB)** 存储在浏览器本地。
    *   AI 相关配置 (服务商、模板、历史记录、高级选项、UI状态) 使用 **localStorage** 存储。
*   **导入/导出**: 支持标签库数据的 JSON 导入导出。
*   **设置**: 
    *   主题切换（亮色/暗色），支持跟随系统。
    *   **AI 服务商管理** (通过设置抽屉进行，提供添加/编辑/删除自定义服务商的入口)。
*   **响应式 UI**: 基于 Naive UI 构建，简洁美观，支持侧边栏折叠。

## 技术栈

*   **前端框架**: Vue 3 (Composition API, `<script setup>`)
*   **状态管理**: Pinia
*   **UI 库**: Naive UI
*   **语言**: TypeScript
*   **本地存储**: Dexie.js (IndexedDB), localStorage
*   **构建工具**: Vite
*   **图标**: Vicons (@vicons/ionicons5)
*   **其他**: vuedraggable (用于可能的拖拽功能)

## 如何本地运行

1.  **克隆仓库**
    ```bash
    # git clone <your-repo-url>
    # cd <repo-folder>
    ```
2.  **安装依赖**
    ```bash
    npm install 
    # or pnpm install / yarn install
    ```
3.  **启动开发服务器**
    ```bash
    npm run dev
    # or pnpm dev / yarn dev
    ```
4.  在浏览器中打开显示的本地地址 (通常是 `http://localhost:5173`)。

## AI 服务商配置

*   应用内置了 OpenRouter 和 硅基流动 (SiliconFlow) 作为默认服务商。
*   您需要在使用前，通过 **设置 -> AI设置** (点击右上角齿轮图标) 来配置这些服务商的 **API Key**。
*   您也可以在设置中**添加自定义服务商**，选择 API 类型（OpenAI 兼容或 SiliconFlow），并提供必要的 Base URL, API Key 和模型信息。
*   **安全警告**: 直接在前端存储 API Key 存在安全风险。建议仅在本地开发或受信任的环境中使用。生产环境建议通过后端代理处理 API Key。

## 项目结构 (简要更新)

```
src/
├── App.vue          # 根组件
├── main.ts          # 应用入口
├── assets/          # 静态资源
├── components/      # 可复用 UI 组件
│   ├── ai-expand/   # AI 扩写工具相关组件 (View, Sidebar, Settings, etc.)
│   ├── tag-manage/  # 标签管理相关组件
│   └── ...
├── layouts/         # 布局组件
├── router/          # Vue Router 配置
├── services/        # 数据服务 (Dexie数据库, AI相关服务)
│   ├── aiExpand/    # AI服务相关 (apiService, history, template)
│   └── ...
├── stores/          # Pinia Stores (tagStore, aiExpandStore, etc.)
├── styles/          # 全局样式 (SCSS)
├── types/           # TypeScript 类型定义 (data.ts, aiExpand.ts)
├── utils/           # 工具函数 (errorHandling, requestUtils, secureStorage)
├── views/           # 页面级组件
public/              # 公共静态文件
```

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# Lint 代码
npm run lint

# Lint 并修复
npm run lint:fix

# 格式化代码
npm run format
```

## 部署到GitHub Pages

本项目配置了自动部署到GitHub Pages的工作流，只需要将代码推送到main分支，GitHub Actions就会自动构建并部署网站。

### 手动部署

1. 构建项目
   ```bash
   npm run build
   ```

2. 构建结果将保存在`dist`目录中
3. 将`dist`目录的内容推送到GitHub Pages分支

## 用户库

### 1. 目录结构

用户库文件存储在`public/user_libraries`目录中，构建后会自动复制到`dist/user_libraries`目录。

用户库目录结构：
```
public/
  └── user_libraries/
      ├── index.json     # 用户库索引文件
      ├── lib1.json      # 用户库文件1
      ├── lib2.json      # 用户库文件2
      └── ...
```

### 2. 索引文件格式

`index.json`文件用于索引所有用户库，格式如下：

```json
{
  "version": "1.0",
  "libraries": [
    {
      "id": "lib1",
      "name": "示例库1",
      "description": "示例标签库",
      "path": "lib1.json",
      "tags_count": 10,
      "categories_count": 2
    },
    {
      "id": "lib2",
      "name": "示例库2",
      "description": "示例标签库2",
      "path": "lib2.json",
      "tags_count": 15,
      "categories_count": 3
    }
  ]
}
```

### 3. 用户库文件格式

用户库文件的格式如下：

```json
{
  "version": "1.0",
  "metadata": {
    "name": "示例库",
    "description": "示例标签库"
  },
  "categories": [
    {
      "name": "分类1",
      "description": "分类描述"
    }
  ],
  "tags": [
    {
      "categoryName": "分类1",
      "name": "标签1",
      "subtitles": ["副标题1", "副标题2"],
      "keyword": "keyword1"
    }
  ]
}
```

## 注意事项

- 部署到GitHub Pages时，基础URL为`/Tag-Store/`
- 在本地开发时，基础URL为`/`
