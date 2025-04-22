# TagStore (v1.0)

一个使用 Vue 3, TypeScript, Pinia, Naive UI 和 Dexie (IndexedDB) 构建的现代化标签管理系统。

## 主要特性

*   **多标签库管理**:
    *   创建、切换、重命名、删除多个独立的标签库。
    *   数据隔离，每个库拥有自己的分类和标签。
*   **分类管理**:
    *   在当前库中添加、编辑、删除分类。
    *   通过侧边栏快速筛选分类下的标签。
*   **标签管理**:
    *   在当前库的分类下添加、编辑、删除标签（支持名称、副标题、关键词、权重、颜色等属性）。
    *   网格视图展示标签，支持点击复制关键词。
*   **搜索与筛选**:
    *   按分类筛选标签。
    *   全局搜索标签的名称、副标题、关键词（支持动态展开/收起搜索框）。
*   **批量操作**:
    *   批量选择标签。
    *   批量删除选中的标签。
    *   批量移动选中的标签到其他分类。
*   **收藏夹功能**:
    *   将常用标签添加到收藏夹，方便快速访问和使用。
    *   支持在标签列表和工具箱中快速添加/移除收藏。
*   **工具箱 (Toolbox)**:
    *   **标签购物车 (Tag Shopping Cart)**:
        *   通过分类和副标题浏览标签库。
        *   选择标签添加到"购物车"区域。
        *   提供文本编辑区，自动同步购物车标签名称，方便修改和组合。
        *   支持一键复制、清空购物车标签。
        *   集成收藏夹视图，直接使用已收藏标签。
        *   提供标签内搜索，快速在整个标签库中查找。
        *   支持一键添加当前副标题下的所有可见标签。
        *   标签按钮提供 Hover 快捷工具栏（复制、收藏/取消收藏）。
        *   优化的选中状态视觉反馈。
    *   **权重添加器 (Weight Generator)**:
        *   支持从标签库选择或通过文本解析的方式添加标签。
        *   为标签应用不同的权重值（手动输入、预设值、随机范围）。
        *   为标签应用不同的括号风格（如 `()`, `[]`, `{}`）并支持嵌套。
        *   提供多种预设的提示词模板（如 Stable Diffusion, Midjourney）并支持自定义。
        *   生成并一键复制带权重和括号的完整提示词字符串。
        *   可配置默认权重、括号、小数位数等设置。
    *   **标签抽取器 (Tag Extractor)**:
        *   从任意文本块中自动提取潜在的标签。
        *   支持自定义文本分隔符和提取规则。
        *   预览提取结果，并允许用户选择、编辑或忽略。
        *   将确认后的标签快速添加到指定分类。
*   **数据持久化**:
    *   使用 Dexie.js 将所有数据存储在浏览器的 IndexedDB 中，实现本地持久化。
*   **导入/导出**:
    *   将当前活动标签库的数据导出为 JSON 文件。
    *   从 JSON 文件导入数据到当前活动标签库（支持合并或替换模式）。
    *   应用首次启动且无数据时，自动加载默认模板。
*   **设置**:
    *   提供设置页面（目前主要是主题切换：亮色/暗色）。
    *   主题设置与操作系统偏好同步或手动选择。
*   **响应式 UI**:
    *   使用 Naive UI 构建，界面简洁美观。
    *   支持侧边栏收起/展开。
*   **UI/UX 优化**:
    *   持续关注并改进用户界面和交互体验。
    *   优化的标签选中状态、快捷操作等。

## 技术栈

*   **前端框架**: Vue 3 (Composition API, `<script setup>`)
*   **状态管理**: Pinia
*   **UI 库**: Naive UI
*   **语言**: TypeScript
*   **本地存储**: Dexie.js (IndexedDB Wrapper)
*   **构建工具**: Vite
*   **图标**: Vicons (@vicons/ionicons5)

## 如何本地运行

1.  **克隆仓库 (如果你还没有)**
    ```bash
    # 根据你的实际仓库地址修改
    git clone https://github.com/your-username/your-repo-name.git 
    cd your-repo-name/Tag-Store 
    ```
2.  **安装依赖**
    ```
        ```bash
    npm install 
    ```
    或者，如果你使用 `pnpm` 或 `yarn`:
    ```bash
    pnpm install
    # yarn install
    ```
3.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    或者:
    ```bash
    pnpm dev
    # yarn dev
    ```
4.  在浏览器中打开显示的本地地址 (通常是 `http://localhost:5173`)。

## 项目结构 (简要)

```
src/
├── App.vue          # 根组件, 初始化 Stores
├── main.ts          # 应用入口
├── assets/          # 静态资源 (如果需要)
├── components/      # 可复用 UI 组件
│   ├── dialogs/     # 对话框组件
│   └── ...
├── layouts/         # 布局组件 (DefaultLayout)
├── router/          # Vue Router 配置
├── services/        # 数据服务 (TagDatabase.ts, StorageService.ts)
├── stores/          # Pinia Stores (tagStore, libraryStore, settingsStore)
├── styles/          # 全局样式 (SCSS)
├── types/           # TypeScript 类型定义 (data.ts)
├── views/           # 页面级组件 (路由对应的视图)
public/              # 公共静态文件 (如 default.json 模板)
└── templates/       # 存放模板文件 (default.json)
```

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
