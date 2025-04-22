# TagStore 产品需求文档 (PRD)

**版本**: 1.0 (重构初始版)
**日期**: 2025-04-21

## 1. 引言

### 1.1 项目概述
TagStore 是一个专注于高效分类、管理和存储标签（Tag）的 Web 应用程序。用户可以通过该系统创建自己的标签库，定义分类和标签，并可能用于各种目的，如内容标注、知识管理、素材整理等。

### 1.2 项目背景与目标
当前项目基于 Vue 3 技术栈，但在开发过程中发现存在代码结构复杂、部分依赖过时、类型安全不足、组件耦合度高等问题。本次重构旨在：
*   **技术现代化**: 全面采用 Vue 3 Composition API (`<script setup>`)、TypeScript 严格模式、最新版 Vite、Pinia、ESLint 等，移除过时依赖。
*   **提升代码质量**: 优化项目架构，遵循关注点分离原则，提高代码可读性、可维护性和可测试性。
*   **增强类型安全**: 最大化利用 TypeScript，减少运行时错误。
*   **改善用户体验 (UX)**: 提供更流畅、现代、直观的用户界面和交互。
*   **提升性能**: 优化数据处理和渲染性能，确保在处理较大数据量时依然流畅。
*   **组件化与原子性**: 将大型组件拆分为更小、职责更单一的原子组件，提高复用性。

### 1.3 目标受众
*   需要精细化管理大量标签的用户（如艺术家、研究人员、内容创作者、知识管理者）。
*   寻求本地优先、数据自控的标签管理解决方案的用户。
*   开发者（包括用户本人和 AI 助手），需要清晰的文档和代码结构进行维护和迭代。

## 2. 核心目标 (重构)

*   **[目标 1]** 完成技术栈升级至最新稳定版本 (Vue 3, Vite, Pinia, TypeScript, ESLint, Naive UI/或其他选定UI库)。
*   **[目标 2]** 实现 100% 的 TypeScript 覆盖率，启用并满足 `strict: true` 配置。
*   **[目标 3]** 重构所有核心组件，使用 Composition API (`<script setup>`)。
*   **[目标 4]** 至少将 `TagLibrarySwitcher` 和 `ImportTemplateDialog` 等大型组件拆分为职责单一的小组件。
*   **[目标 5]** 实现清晰的状态管理模式 (Pinia Stores)。
*   **[目标 6]** 建立健壮的数据持久化层 (Dexie Service)。
*   **[目标 7]** 配置并启用 ESLint 和 Prettier，确保代码风格统一且无 Lint 错误。
*   **[目标 8]** 提供流畅、响应式的用户界面，优化关键交互（如标签选择、库切换）。
*   **[目标 9]** (如果保留插件) 确保插件系统与新架构兼容。

## 3. 功能需求 (Functional Requirements)

### 3.1 标签库/模板管理 (FR-LIB)

#### 3.1.1 查看可用库/模板 (FR-LIB-001)
*   **描述**: 系统应能发现并列出所有可用的标签库/模板来源。
*   **来源**:
    *   **本地内置**: 应用自带的默认模板 (`default.json`) 和示例模板 (`examples/` 或 `templates/` 目录下的 `.json` 文件)。
    *   **用户创建/导入**: 用户通过导入或创建保存的库 (存储在 IndexedDB 中)。
    *   **远程模板 (可选)**: 如果启用，可从指定 API (`apiConfig.baseUrl`) 获取官方或社区模板列表。
*   **展示**:
    *   以列表形式展示，每个条目包含：名称、描述、类型 (本地/远程/默认/用户库)、统计信息 (分类数、标签数 - 可选，可异步加载)。
    *   应明确标识当前正在使用的库。
    *   提供加载状态指示。
*   **实现细节**:
    *   `TemplateLoader` Service 负责扫描本地文件 (通过 fetch HEAD 探测)、查询 IndexedDB (未来)、获取远程列表。
    *   `TemplateLoader.getTemplatesMetadata()` 应合并所有来源并去重（ID 优先）。
    *   UI 组件 (`TagLibrarySwitcher`) 调用 Service 获取列表并渲染。

#### 3.1.2 切换标签库 (FR-LIB-002)
*   **描述**: 用户可以选择一个可用的库并将其设置为当前活动库。
*   **触发**: 用户在库列表 (`TagLibrarySwitcher`) 中点击"切换"按钮。
*   **流程**:
    1.  弹出确认对话框 (`SwitchConfirmDialog`)，显示目标库名称。
    2.  提供导入选项：
        *   **完全替换**: 清空当前所有分类和标签，然后加载新库数据。 (默认选中)
        *   **合并数据**: 保留现有数据，将新库的数据合并进来。
            *   **合并分类**: 若分类名称已存在，则不创建新分类。
            *   **合并标签**: 若标签名称已存在于同一分类下，则不导入重复标签 (基于名称)。提供"跳过重复标签"选项。
    3.  用户确认后，显示加载状态 (`loading` 覆盖层)。
    4.  调用 `tagStore.switchLibrary` Action，传递模板 ID 和导入选项。
    5.  `tagStore` Action 负责：
        *   加载目标模板数据 (`TemplateLoader.loadTemplate`)。
        *   根据选项执行数据清空或合并逻辑（操作 `tagStore` state）。
        *   更新 `tagStore.currentLibraryPath` 或类似状态。
        *   (重要) 所有数据操作应通过 Dexie Service 持久化到 IndexedDB。
    6.  切换完成后，关闭对话框，更新 UI (如侧边栏、标签视图)，并发出全局事件 (`EVENTS.TAG.LIBRARY_UPDATED`)。
    7.  处理切换过程中的错误，并向用户显示错误信息。**例如：若模板加载失败，提示"加载目标库数据失败，请检查网络或文件"；若数据合并/清空时出错，提示"应用库更改时出错，请重试"。**
*   **UI**: 切换按钮在当前库上应禁用。确认对话框提供清晰的选项和警告。

#### 3.1.3 预览标签库/模板 (FR-LIB-003)
*   **描述**: 用户可以在不切换的情况下预览模板的内容。
*   **触发**: 用户在库列表 (`TagLibrarySwitcher`) 中点击"预览"按钮。
*   **流程**:
    1.  打开预览对话框 (`TemplatePreviewDialog`)，显示模板名称。
    2.  对话框内部调用 `TemplateLoader.loadTemplate` 加载模板数据。
    3.  显示加载状态。
    4.  成功加载后，展示预览信息：
        *   模板元数据 (类型、路径 - 如果可用)。
        *   统计信息 (分类总数、标签总数)。
        *   分类列表 (显示前 N 个分类的名称)。
        *   (可选) 标签样本 (显示每个分类下的前 M 个标签的名称和副标题)。
    5.  处理加载错误，显示错误信息和重试按钮。**例如：提示"预览模板加载失败"。**
    6.  (可选) 提供从预览直接切换到此库的按钮 (触发 FR-LIB-002 的流程)。
*   **UI**: 对话框应模态显示，内容清晰易懂。

#### 3.1.4 导入模板文件 (FR-LIB-004)
*   **描述**: 用户可以从本地选择一个 `.json` 文件导入作为新的标签库。
*   **触发**: 用户点击界面上的"导入模板"按钮 (可能在 `ToolHeader` 或设置页面)。
*   **流程**:
    1.  打开导入对话框 (`ImportTemplateDialog`)。
    2.  **文件选择**: 提供文件选择输入框 (`<input type="file">`)，限制接受 `.json` 文件。
    3.  **文件读取与预览**:
        *   选择文件后，前端读取文件内容 (JSON)。
        *   解析 JSON 数据，验证基本格式 (包含 `tags` 和 `categories` 数组)。
        *   显示文件预览信息 (类似 FR-LIB-003，但基于文件内容而非已有模板)。
        *   处理文件读取、解析或格式错误。**例如：若文件读取失败，提示"无法读取文件"；若 JSON 解析失败或格式不正确，提示"文件内容无效，请确保是正确的 TagStore JSON 模板"。**
    4.  **导入选项**: 提供与 FR-LIB-002 类似的导入选项（替换、合并分类、合并标签、跳过重复）。
    5.  **执行导入**: 用户确认后：
        *   显示导入进度状态 (`ImportProgressIndicator`)。
        *   调用 `tagStore.importDataAction` (或类似名称)，传递解析后的数据和导入选项。
        *   `tagStore` Action 执行数据操作并持久化。
        *   (可选) 导入过程中可以更新进度百分比和已导入数量。
    6.  导入完成后，显示成功信息，关闭对话框，并发出 `EVENTS.TAG.LIBRARY_UPDATED` 事件。
    7.  处理导入过程中的错误。**例如：若数据写入 IndexedDB 失败，提示"数据保存失败，导入未完成"。**
*   **UI**: 对话框引导用户完成选择、预览、配置、导入的流程。进度显示清晰。

#### 3.1.5 导出当前库 (FR-LIB-005)
*   **描述**: 用户可以将当前活动的标签库导出为 `.json` 文件。
*   **触发**: 用户点击界面上的"导出当前库"按钮。
*   **流程**:
    1.  调用 `tagStore` Action 获取当前的 `tags` 和 `categories` 数据。
    2.  将数据格式化为指定的 JSON 结构（例如 `{ "categories": [...], "tags": [...] }`）。
    3.  生成包含 JSON 内容的 Blob 对象。
    4.  创建一个下载链接 (`<a>` 标签)，设置 `href` 为 Blob URL，`download` 属性为推荐的文件名 (如 `tagstore_库名_日期.json`)。
    5.  触发链接的点击事件，启动浏览器下载。
    6.  处理导出过程中的错误。**例如：若获取数据或生成文件失败，提示"导出失败，请稍后重试"。**
*   **UI**: 提供一个明确的导出按钮。

### 3.2 分类管理 (FR-CAT)

#### 3.2.1 创建分类 (FR-CAT-001)
*   **描述**: 用户可以创建新的标签分类。
*   **触发**: 用户在分类列表区域点击"添加分类"按钮。
*   **流程**:
    1.  打开创建/编辑分类对话框 (`CategoryDialog` 或类似名称)，内嵌 `CategoryForm`。
    2.  用户输入分类名称。
    3.  (可选) 用户可以设置分类的其他属性（如颜色、图标 - 如果未来支持）。
    4.  表单提交时进行验证 (名称不能为空，名称是否已存在)。
    5.  调用 `tagStore.createCategory` Action，传递分类数据。
    6.  `tagStore` 更新状态并持久化。
    7.  成功后关闭对话框，更新分类列表 UI。
    8.  处理错误。**例如：若名称已存在，表单验证时提示；若保存失败，提交后提示"创建分类失败"。**
*   **UI**: 提供清晰的输入表单和提交/取消按钮。

#### 3.2.2 编辑分类 (FR-CAT-002)
*   **描述**: 用户可以修改现有分类的名称或其他属性。
*   **触发**: 用户在分类项上点击"编辑"按钮或图标。
*   **流程**:
    1.  打开编辑分类对话框，预填充分类的当前信息。
    2.  用户修改信息。
    3.  表单提交验证。
    4.  调用 `tagStore.updateCategory` Action，传递分类 ID 和更新后的数据。
    5.  `tagStore` 更新状态并持久化。
    6.  成功后关闭对话框，更新 UI。
    7.  处理错误。**例如：若名称与其他分类冲突，表单验证提示；若保存失败，提交后提示"更新分类失败"。**

#### 3.2.3 删除分类 (FR-CAT-003)
*   **描述**: 用户可以删除一个或多个分类。
*   **触发**: 用户在分类项上点击"删除"按钮或图标，或通过多选操作。
*   **流程**:
    1.  弹出确认对话框 (`ConfirmDialog`)，询问用户是否确定删除。
    2.  **警告**: 明确告知用户删除分类将同时删除该分类下的所有标签。
    3.  用户确认后，调用 `tagStore.deleteCategory` Action，传递分类 ID。
    4.  `tagStore` Action 需要同时删除分类本身和其下的所有标签，并持久化。
    5.  成功后更新 UI。
    6.  处理错误。**例如：若删除操作在持久化时失败，提示"删除分类失败，请重试"。**

#### 3.2.4 查看分类列表 (FR-CAT-004)
*   **描述**: 系统应在侧边栏或其他指定区域显示当前库的分类列表。
*   **展示**:
    *   通常为树状或列表结构。
    *   显示分类名称。
    *   (可选) 显示该分类下的标签数量。
    *   (可选) 支持展开/折叠。
    *   提供添加、编辑、删除分类的操作入口。
    *   点击分类应能触发标签视图的过滤 (FR-SRCH-002)。
*   **实现**: UI 组件从 `tagStore` 获取分类数据并渲染。

### 3.3 标签管理 (FR-TAG)

#### 3.3.1 创建标签 (FR-TAG-001)
*   **描述**: 用户可以在指定的分类下创建新标签。
*   **触发**: 用户点击"添加标签"按钮（可能在全局工具栏或分类区域）。
*   **流程**:
    1.  打开创建/编辑标签对话框 (`TagDialog` 或 `ModernTagDialog`)，内嵌 `TagForm`。
    2.  用户必须输入标签名称 (主内容)。
    3.  用户可以选择标签所属的分类（默认为当前选中分类或"未分类"）。
    4.  用户可以添加一个或多个副标题 (subtitles)。
    5.  (可选) 用户可以设置其他属性（如权重、颜色 - 如果支持）。
    6.  表单提交验证 (名称不能为空，同一分类下名称是否唯一)。
    7.  调用 `tagStore.createTag` Action，传递标签数据。
    8.  `tagStore` 更新状态并持久化。
    9.  成功后关闭对话框，更新标签列表 UI。
    10. 处理错误。**例如：若名称已存在，表单验证提示；若保存失败，提交后提示"创建标签失败"。**
*   **UI**: 提供清晰的表单，分类选择应为下拉列表或类似控件，副标题支持动态添加/删除。

#### 3.3.2 编辑标签 (FR-TAG-002)
*   **描述**: 用户可以修改现有标签的名称、副标题、分类等信息。
*   **触发**: 用户在标签项上点击"编辑"按钮或图标。
*   **流程**:
    1.  打开编辑标签对话框，预填充分类当前信息。
    2.  用户修改信息。
    3.  表单提交验证。
    4.  调用 `tagStore.updateTag` Action，传递标签 ID 和更新后的数据。
    5.  `tagStore` 更新状态并持久化。
    6.  成功后关闭对话框，更新 UI。
    7.  处理错误。**例如：若名称在同分类下冲突，表单验证提示；若保存失败，提交后提示"更新标签失败"。**

#### 3.3.3 删除标签 (FR-TAG-003)
*   **描述**: 用户可以删除一个或多个标签。
*   **触发**: 用户在标签项上点击"删除"按钮或图标，或通过多选操作。
*   **流程**:
    1.  弹出确认对话框 (`ConfirmDialog`)。
    2.  用户确认后，调用 `tagStore.deleteTag` Action，传递标签 ID(s)。
    3.  `tagStore` 更新状态并持久化。
    4.  成功后更新 UI。
    5.  处理错误。**例如：若删除操作在持久化时失败，提示"删除标签失败，请重试"。**

#### 3.3.4 查看标签列表 (FR-TAG-004)
*   **描述**: 系统在主内容区域显示当前选中分类（或所有分类）下的标签。
*   **展示**:
    *   支持多种视图模式（如网格视图 `TagGrid`、列表视图 - 可配置）。
    *   每个标签项显示：主要名称、副标题（截断或完整显示）。
    *   提供编辑、删除标签的操作入口。
    *   (可选) 支持标签拖拽排序或修改分类。
    *   应能响应搜索和过滤结果 (FR-SRCH-001)。
*   **性能**: 对于大量标签，应使用虚拟滚动 (`vue3-virtual-scroll-list` 或 Naive UI 自带的虚拟列表) 或分页来保证性能。
*   **实现**: UI 组件从 `tagStore` 获取过滤/排序后的标签数据并渲染。

#### 3.3.5 批量操作 (FR-TAG-005) - (可选，基于现有代码推测)
*   **描述**: 用户可以选择多个标签进行批量操作，如批量删除、批量移动分类。
*   **触发**: 用户通过复选框或框选等方式选择多个标签。
*   **流程**:
    1.  提供批量操作的 UI 入口（如工具栏按钮）。
    2.  用户选择操作类型（删除、移动）。
    3.  如果移动，提供目标分类选择。
    4.  弹出确认对话框。
    5.  调用 `tagStore` 中相应的批量 Action (`batchDeleteTags`, `batchMoveTags`)。
    6.  `tagStore` 处理批量数据更新和持久化。
    7.  更新 UI。
*   **UI**: 需要支持标签的多选状态。

### 3.4 搜索与过滤 (FR-SRCH)

#### 3.4.1 按名称/副标题搜索标签 (FR-SRCH-001)
*   **描述**: 用户可以通过输入关键词搜索标签名称或副标题包含该关键词的标签。
*   **触发**: 用户在搜索框 (`TagSearchBar`) 中输入内容。
*   **流程**:
    1.  当用户输入时（可能有 debounce 延迟），更新 `tagStore.searchTerm` 状态。
    2.  `tagStore` 的 Getters (如 `filteredTags`) 应根据 `searchTerm` 和当前选中的分类 (`filterCategory`) 过滤标签列表。
    3.  标签视图 (`TagGrid` 等) 自动响应 Getter 的变化并更新显示。
*   **UI**: 提供清晰的搜索输入框，可能带有清除按钮。

#### 3.4.2 按分类过滤标签 (FR-SRCH-002)
*   **描述**: 用户可以通过选择分类来仅显示该分类下的标签。
*   **触发**: 用户在分类列表 (`CategoryList`) 中点击某个分类。
*   **流程**:
    1.  更新 `tagStore.filterCategory` 状态为选中的分类 ID（或 null/特殊值表示"所有分类"）。
    2.  `tagStore` 的 Getters (如 `filteredTags`) 根据 `filterCategory` 和 `searchTerm` 过滤标签。
    3.  标签视图自动更新。
*   **UI**: 当前选中的分类应有高亮状态。提供"显示所有分类"的选项。

#### 3.4.3 (可选) 高级过滤 (FR-SRCH-003)
*   **描述**: 提供更复杂的过滤选项，如按创建日期、更新日期、有无副标题等过滤。
*   **实现**: 可能需要扩展 `tagStore` 的状态和 Getters，并在 UI 上提供相应的过滤控件。

### 3.5 用户界面与交互 (FR-UI)

#### 3.5.1 整体布局 (FR-UI-001)
*   **描述**: 应用采用常见的三栏（或两栏）布局。
*   **组成**:
    *   **侧边栏 (`Sidebar`)**: 显示分类列表 (FR-CAT-004)，可能包含库切换入口。支持响应式收起/展开。
    *   **主内容区 (`MainContent`)**: 显示标签列表 (FR-TAG-004)，根据侧边栏选择和搜索条件进行过滤。
    *   **头部区域 (`ContentHeader` / `ToolHeader`)**: 可能包含全局操作按钮（添加标签、导入、导出、设置）、搜索框 (`TagSearchBar`)。
    *   **状态栏 (`StatusBar` - 可选)**: 显示当前库信息、标签总数、系统状态等。
*   **响应式**: 布局应能适应不同屏幕尺寸。在小屏幕上侧边栏可能默认收起或变为抽屉式。 (`ResponsiveLayout`, `useResponsive`)

#### 3.5.2 核心交互 (FR-UI-002)
*   **标签/分类 CRUD**: 通过对话框 (`Modal`, `ConfirmDialog`) 进行。表单 (`TagForm`, `CategoryForm`) 提供输入和验证。
*   **库切换/导入**: 通过专门的对话框 (`TagLibrarySwitcher`, `ImportTemplateDialog`) 完成。
*   **拖拽 (可选)**: 支持拖拽标签改变排序或移动到不同分类。
*   **反馈**: 操作（如保存、删除、导入）应有明确的反馈（如 Toast 通知 `NotificationSystem`，加载状态指示）。

#### 3.5.3 主题与外观 (FR-UI-003)
*   **描述**: 应用支持浅色/深色模式切换，并允许一定程度的主题定制。
*   **实现**:
    *   利用 Naive UI 的主题系统。
    *   提供设置选项 (FR-SET-003)。
    *   通过 CSS 变量和 Scoped SCSS 实现自定义样式。

### 3.6 设置 (FR-SET)

#### 3.6.1 显示设置 (FR-SET-001)
*   **描述**: 用户可以配置界面显示相关的选项。
*   **选项**:
    *   标签视图模式 (网格/列表)。
    *   每页显示数量 (如果使用分页)。
    *   默认分类展开状态。
    *   是否显示标签数量。
    *   标签排序方式 (名称、创建时间等)。
*   **实现**:
    *   设置项存储在 `settingsStore` 中。
    *   UI 组件读取 Store 状态来调整显示。
    *   设置页面提供控件修改这些选项。

#### 3.6.2 存储设置 (FR-SET-002)
*   **描述**: 用户可以管理数据存储选项。
*   **选项**:
    *   (未来可能) 选择存储后端 (当前固定为 Dexie/IndexedDB)。
    *   清除本地数据按钮 (带强烈警告和确认)。
    *   (未来可能) 配置自动备份。
*   **实现**: `settingsStore` 管理相关状态，操作通过 `StorageService` 或 `tagStore` 执行。

#### 3.6.3 主题设置 (FR-SET-003)
*   **描述**: 用户可以选择浅色/深色/自动模式。
*   **实现**: `settingsStore` 存储主题模式，应用根组件根据 Store 状态动态应用 Naive UI 主题或 CSS 类。

### 3.7 数据持久化 (FR-DATA)

#### 3.7.1 本地存储 (FR-DATA-001)
*   **描述**: 应用的所有核心数据（标签库、分类、标签、用户设置）默认使用 IndexedDB 持久化存储在用户本地浏览器。
*   **实现**:
    *   使用 **Dexie.js** 库封装 IndexedDB 操作。
    *   创建一个 `StorageService` 或在 `tagStore`/`settingsStore` 的 Actions 中直接调用 Dexie 进行 CRUD 操作。
    *   定义清晰的数据库 Schema (表结构、索引)。 参考 `src/utils/constants/storage.ts` 中的 `INDEXED_DB_CONFIG`。
    *   所有对 Pinia Store 状态的修改，如果需要持久化，都应同步调用 Dexie 进行存储。
    *   应用启动时，从 Dexie 加载数据初始化 Store。

#### 3.7.2 数据初始化与迁移 (FR-DATA-002)
*   **描述**: 应用首次启动或版本更新时，需要处理数据初始化或迁移。
*   **实现**:
    *   **首次启动**: 如果 IndexedDB 中没有数据，可以加载默认模板 (`default.json`) 初始化。
    *   **版本更新**: 如果数据库 Schema 发生变化，Dexie 的版本管理机制 (`upgrade` 回调) 应用于数据迁移。`DataMigrationTool` 类可以封装迁移逻辑。

### 3.8 (可选) 插件系统 (FR-PLUG)

*   **描述**: (如果决定保留) 系统支持加载外部或内置插件来扩展功能（如数据可视化、随机抽取器）。
*   **实现**:
    *   `PluginManager` Service 负责注册、加载、卸载插件。
    *   定义清晰的插件接口 (`BasePlugin`?) 和生命周期钩子。
    *   插件通过事件总线 (`EventBus`) 或注入的服务与核心应用交互。
    *   **重构注意**: 确保插件系统与 Composition API 和 Pinia 良好集成，避免直接操作 DOM 或依赖旧的实例属性。

## 4. 非功能需求 (Non-Functional Requirements)

### 4.1 性能 (NFR-PERF)
*   **NFR-PERF-001**: 标签列表在包含 1000+ 标签时，滚动和过滤操作应保持流畅（响应时间 < 100ms），需采用虚拟滚动或分页技术。
*   **NFR-PERF-002**: 应用初始加载时间（首次访问，不含模板数据加载）应在现代浏览器和网络条件下小于 2 秒。利用 Vite 的构建优化和代码分割。
*   **NFR-PERF-003**: Pinia Store 的 Getters 计算应高效，避免不必要的重复计算。

### 4.2 可维护性 (NFR-MAINT)
*   **NFR-MAINT-001**: 代码遵循统一的风格规范 (ESLint + Prettier 强制)。
*   **NFR-MAINT-002**: 遵循关注点分离原则，模块/组件职责清晰。
*   **NFR-MAINT-003**: 大量使用 TypeScript 强类型，避免 `any` 类型。
*   **NFR-MAINT-004**: 提供清晰的目录结构 (如 3. 建议架构)。
*   **NFR-MAINT-005**: 关键业务逻辑和工具函数应有单元测试 (Vitest)。

### 4.3 可用性 (NFR-USE)
*   **NFR-USE-001**: 提供现代、简洁、直观的用户界面，遵循常见的设计模式。
*   **NFR-USE-002**: 关键操作（删除、替换库）需要明确的二次确认。
*   **NFR-USE-003**: 提供清晰的加载状态和错误反馈。
*   **NFR-USE-004**: 应用支持响应式设计，在桌面和常见平板设备上体验良好。
*   **NFR-USE-005**: (可选) 考虑基本的 Web 可访问性 (WCAG) 标准，如键盘导航、足够的色彩对比度。

### 4.4 可靠性 (NFR-REL)
*   **NFR-REL-001**: 数据应可靠地存储在 IndexedDB 中，常规操作不应导致数据丢失。
*   **NFR-REL-002**: 错误处理机制健全，捕获预期和非预期错误，向用户提供有意义的信息（或记录到控制台）。
*   **NFR-REL-003**: 导入/导出功能应能正确处理有效数据，并对无效数据提供错误提示。

### 4.5 类型安全 (NFR-TYPE)
*   **NFR-TYPE-001**: 接口 (`interface` 或 `type`) 定义清晰，用于 Props、Store State、API 响应等。
*   **NFR-TYPE-002**: 类型检查和转换应严格，避免运行时错误。
*   **NFR-TYPE-003**: 接口 (`interface` 或 `type`) 定义清晰，用于 Props、Store State、API 响应等。

### 4.6 部署 (NFR-DEPLOY)
*   **NFR-DEPLOY-001**: 项目应能够构建并成功部署到 GitHub Pages。
*   **NFR-DEPLOY-002**: Vite 构建配置 (`vite.config.ts`) 中的 `base` 选项必须正确配置，以匹配 GitHub Pages 的仓库路径 (例如：`/Tag-Store/`)。
*   **NFR-DEPLOY-003**: 推荐使用 Hash Mode (`createWebHashHistory`) 的 Vue Router 以简化 GitHub Pages 部署。如果使用 History Mode (`createWebHistory`)，需要查阅并实施 GitHub Pages 针对单页应用的 404 处理方案 (通常涉及根目录下的 `404.html` 文件或自定义域名配置)。
*   **NFR-DEPLOY-004**: (推荐) 配置 GitHub Actions workflow，实现当代码合并到主分支 (如 `main` 或 `master`) 时，自动执行构建并将应用部署到 `gh-pages` 分支。

## 5. 技术栈选型 (确认)

*   **核心框架**: Vue 3 (Composition API, `<script setup>`)
*   **构建工具**: Vite (最新稳定版)
*   **语言**: TypeScript (严格模式)
*   **状态管理**: Pinia (最新稳定版)
*   **路由**: Vue Router (最新稳定版)
*   **UI 组件库**: Naive UI (最新稳定版)
*   **样式**: Scoped CSS + SCSS/Sass
*   **代码检查**: ESLint (v8 最新或 v9) + `@typescript-eslint` + `eslint-plugin-vue`
*   **代码格式化**: Prettier
*   **客户端存储**: Dexie.js (v3+)
*   **测试**: Vitest + Vue Test Utils

## 6. 数据模型 (Data Model)

### 6.1 Category (分类)
```typescript
interface Category {
  id: string; // 唯一标识符 (UUID)
  name: string; // 分类名称 (同一库内唯一)
  // 可选属性
  // keyword?: string; // 可选的补充说明或关键词
  color?: string; // #RRGGBB
  icon?: string; // 图标标识
}
```

### 6.2 Tag (标签)
```typescript
interface Tag {
  id: string; // 唯一标识符 (UUID)
  categoryId: string; // 所属分类 ID
  name: string; // 标签主名称 (同一分类下唯一)
  subtitles?: string[]; // 副标题/别名/说明
  keyword?: string; // 可选的补充说明或关键词 (例如，用于工具提示或英文标识)
  // 可选属性
  weight?: number; // 权重/排序值
  color?: string; // 标签颜色
}
```

### 6.3 Template (模板/库 JSON 结构)
```typescript
interface TagStoreTemplate {
  $schema?: string; // 可选，指向 schema 定义
  version?: string; // 可选，模板版本
  metadata?: {
    name?: string; // 模板名称
    description?: string;
    // 其他元数据
  };
  categories: Omit<Category, 'id'>[]; // 导入时 ID 会重新生成
  // 导入时通过 categoryName 关联，tags 数组中的对象遵循更新后的 Tag 接口 (包含 keyword)
  tags: Omit<Tag, 'id' | 'categoryId'> & { categoryName: string }[];
}
```

### 6.4 IndexedDB Schema (使用 Dexie)
```typescript
// TagDatabase.ts
import Dexie, { type Table } from 'dexie';
import type { Category, Tag } from '../types/data'; // Ensure this path is correct

export interface CategoryEntity extends Category {}
export interface TagEntity extends Tag {}

export class TagDatabase extends Dexie {
  categories!: Table<CategoryEntity, string>; // id 是主键
  tags!: Table<TagEntity, string>; // id 是主键

  constructor() {
    super('TagStoreDB');
    this.version(1).stores({
      categories: 'id, name', // 主键 id，索引 name
      // Include keyword in tag indexes if it needs to be searchable/queried efficiently
      tags: 'id, categoryId, name, keyword', // 主键 id，索引 categoryId, name, keyword
    });
  }
}

export const db = new TagDatabase();
```

## 7. 技术栈与架构
// ... existing code ...

## 8. 未来考虑 (可选)

*   云同步/备份功能。
*   更高级的搜索语法 (布尔逻辑、字段搜索)。
*   标签关系定义 (同义词、层级关系)。
*   多用户协作。
*   更丰富的插件生态。
*   移动端原生应用或 PWA 优化。

---
**文档结束** 