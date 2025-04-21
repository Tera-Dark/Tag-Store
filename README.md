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
    cd your-repo-name/Tag-Store-v1.0 
    ```
2.  **安装依赖**
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
