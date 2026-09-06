# AI 对话系统设计

## 1. 目标与边界

AI 对话是平台级的通用工作入口，负责把用户、模型供应商、会话历史和后续的知识/技能能力连接起来。前端统一使用 `@ant-design/x@1.x`，与当前 Ant Design 5、React 18 兼容。

当前先实现可用的 MVP：

- 新建、切换、删除会话；
- 左侧展示当前用户的历史会话；
- 在输入框右下方选择智能体和知识库，模型供应商与具体模型由智能体封装；
- 支持后台配置智能体的 System Prompt、模型和通用参数；
- 支持后台配置聊天主题（明亮、深色、自然）和动态效果开关；
- 文本消息持久化；
- 使用 OpenAI Chat Completions 兼容协议生成回复；
- 通过 SSE 增量返回回复，支持加载、错误和空状态；
- 支持文件、图片附件上传，附件消息持久化并在消息流中预览/下载；
- 支持浏览器语音识别输入，以及 `@` 文件、`@` Skill 建议；
- 支持创建知识库、录入首个文档、按当前问题检索并注入模型上下文；
- 所有会话和消息按当前登录用户隔离。

当前版本的语音输入是浏览器 Speech Recognition 转文字，附件以平台上传引用传给兼容文本模型；真正的视觉/音频多模态和向量检索仍作为后续增强项。

## 2. 前端交互设计

```text
AI Chat
├── 左侧会话栏
│   ├── 新会话
│   ├── 会话搜索（后续）
│   └── Conversations：标题、更新时间、删除
└── 右侧聊天区
    ├── 顶栏：会话标题
    ├── 中部：Bubble.List 消息流、空状态、加载和错误状态
    └── 底部：Sender 输入、语音/附件按钮、知识库和智能体选择
```

组件职责：

| 场景 | `@ant-design/x` 组件 |
| --- | --- |
| 历史会话 | `Conversations` |
| 消息气泡 | `Bubble` / `Bubble.List` |
| 输入框 | `Sender` |
| 首次进入引导 | `Welcome` |
| 快捷提问 | `Prompts`（后续） |
| 附件 | `Attachments` |
| `@` 建议 | `Suggestion` |
| 思考链 | `ThoughtChain`（后续，需模型协议支持） |

页面入口为 `/ai-chat`。AI 逻辑放在 `src/platform/ai-assistant` 和独立页面中，不写入工作台页面；工作台后续只增加一个跳转入口。

## 3. 第一版 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai/models` | 返回已启用供应商及其模型，不返回 API Key |
| `GET` | `/api/ai/agents` | 返回已启用智能体 |
| `GET` | `/api/ai/knowledge-bases` | 当前用户的知识库列表 |
| `POST` | `/api/ai/knowledge-bases` | 创建知识库 |
| `POST` | `/api/ai/knowledge-bases/:id/documents` | 录入知识库文档 |
| `GET` | `/api/ai/skills` | 返回内置 Skill |
| `POST` | `/api/ai/attachments` | 上传文件或图片（10MB 内） |
| `GET/POST/PUT/DELETE` | `/api/admin/ai-agents` | 管理智能体及模型绑定 |
| `GET/PUT` | `/api/admin/ai-chat-settings` | 管理欢迎词、推荐问题、对话轮数、机器人图标、主题和动态效果 |
| `GET` | `/api/ai/conversations` | 当前用户的会话列表 |
| `POST` | `/api/ai/conversations` | 创建会话 |
| `GET` | `/api/ai/conversations/:id` | 查询当前用户的会话 |
| `DELETE` | `/api/ai/conversations/:id` | 删除会话及其消息 |
| `GET` | `/api/ai/conversations/:id/messages` | 查询消息历史 |
| `POST` | `/api/ai/conversations/:id/messages` | 发送文本消息，响应为 SSE |

发送消息请求：

```json
{
  "content": "请总结这段内容",
  "agentId": 1,
  "attachments": [],
  "skill": "summarize",
  "knowledgeBaseId": 1
}
```

SSE 事件：

```text
event: message
data: {"conversationId":1,"messageId":2,"delta":"你好"}

event: done
data: {"messageId":2}

event: error
data: {"message":"模型服务暂时不可用"}
```

模型供应商模块只通过受控服务向 AI 模块提供模型调用能力，AI 模块不能读取 `api_key_encrypted` 或自行解密。

## 4. 数据模型

### 4.1 `ai_conversations`

- `id`：会话 ID；
- `user_id`：所属用户，删除用户时级联删除；
- `title`：会话标题，默认取第一条消息的前 80 个字符；
- `model_provider_id`、`model_name`：最近一次使用的模型；
- `agent_id`：最近一次使用的智能体；
- `status`：`active` 或 `archived`；
- `created_at`、`updated_at`：排序和审计时间。

### 4.2 `ai_messages`

- `conversation_id`：所属会话；
- `role`：`user`、`assistant` 或 `system`；
- `content`：文本内容，允许附件消息为空；
- `status`：`pending`、`completed` 或 `failed`；
- `model`：生成该消息的模型；
- `token_usage`：预留供应商返回的 token 统计；
- `error_message`：失败原因；
- `attachments`：平台附件引用数组；
- `created_at`：消息顺序依据。

知识库表：

- `ai_knowledge_bases`：用户可见的知识库；
- `ai_knowledge_documents`：知识库文档正文，当前使用受限关键词检索。

### 4.3 `ai_agents`

- `code`、`name`：智能体标识和显示名称；
- `model_provider_id`、`model_name`：智能体绑定的模型供应商和具体模型；
- `system_prompt`：每轮对话前注入的系统提示词；
- `settings`：温度、上下文轮数等通用 JSON 配置；
- `enabled`、`is_default`：可用状态和默认智能体标记。

后续扩展表：

- `ai_message_attachments`：文件、图片和语音引用，文件本体进入平台文件中心；
- `ai_skills`、`ai_conversation_skills`：Skill 注册、版本和授权；
- `ai_knowledge_bases`、`ai_knowledge_sources`：知识库及索引任务；
- `ai_message_parts`：文本、图片、音频、工具调用等多模态消息分片。

## 5. 后续版本规划

### 已完成：输入增强

- `Attachments` 接入文件上传、图片预览和下载；
- 输入框支持 `@` 文件和 `@` Skill 建议；
- 浏览器语音录入转文字；
- 已预留取消生成和重新生成的交互位置。

### 已完成：知识库与 Skill MVP

- 会话选择知识库，检索结果作为受控上下文注入；
- 内置 Skill 通过提示约束执行，后续再扩展权限、版本和输入输出 Schema；
- 增加工具调用确认、审计和超时控制；
- 为不同模型声明文本、视觉、音频和工具调用能力矩阵。

### 第四版：实时多模态

- 图片/音频直接发送给支持的模型；
- WebSocket 或 Realtime 协议支持实时语音对话；
- 后台异步任务处理大文件解析、向量化和长文档总结。

## 6. 权限与安全

- API 必须经过登录态校验，会话和消息查询按 `user_id` 限制；
- API Key 仅存在模型供应商模块的加密字段中，前端只能看到供应商、模型和能力信息；
- 生产环境对供应商地址执行 HTTP/HTTPS、公网 DNS 和超时校验；
- 文件上传、知识库检索和 Skill 调用必须增加大小限制、MIME 校验、权限校验和审计记录；
- 生成内容应保留供应商、模型、耗时和 token 使用量，便于成本统计和问题追踪。

## 7. 当前实施清单

- [x] 引入与 Ant Design 5 兼容的 `@ant-design/x@1.6.1`；
- [x] 会话和消息表及用户隔离；
- [x] 会话 CRUD、模型清单和 SSE 文本对话 API；
- [x] 使用 `Conversations`、`Bubble.List`、`Sender` 完成第一版页面；
- [x] 文件、图片、语音、`@` 文件、`@` Skill；
- [x] 知识库创建、文档录入、选择和基础检索上下文；
- [x] 智能体配置、默认“通用助手”和 `@` 智能体选择；
- [x] AI Chat 欢迎词、推荐问题、对话轮数和机器人图标配置；
- [ ] 工具调用、实时语音和多模态消息。
