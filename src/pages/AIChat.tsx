import { DeleteOutlined, FileAddOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PaperClipOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import { App, Button, Drawer, Form, Image, Input, Layout, Select, Space, Spin, Typography, type UploadFile } from 'antd'
import { Attachments, Bubble, Conversations, Prompts, Sender, Suggestion, Welcome, type Conversation } from '@ant-design/x'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../platform/ai-assistant/api'
import { AiAttachment, AiConversation, AiKnowledgeBase, AiMessage, AiSkill } from '../platform/ai-assistant/types'
import type { User } from '../types'
import { useAuth } from '../auth'
import { useSystemSettings } from '../system-settings'
import UserMenu from '../platform/identity/UserMenu'

type BubbleItem = NonNullable<React.ComponentProps<typeof Bubble.List>['items']>[number]

const STARTER_PROMPTS = [
  '帮我梳理今天最重要的三件事',
  '为我制定一个可执行的学习计划',
  '把一段复杂内容解释得简单一点',
  '帮我写一封专业、简洁的邮件',
  '分析一个问题时应该从哪些角度入手',
  '给我几个提升工作效率的实用建议',
  '帮我把想法整理成清晰的提纲',
  '如何快速入门一个新的技术领域',
  '帮我比较两个方案的优缺点',
  '为一个新项目列出启动清单',
  '如何把目标拆解成可衡量的结果',
  '帮我准备一次重要的汇报',
]

function pickRandom(items: string[], count: number) {
  if (count <= 0) return []
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }
  return shuffled.slice(0, count)
}

function getFollowupSuggestions(messages: AiMessage[], count: number) {
  if (count <= 0) return []
  const latest = [...messages].reverse().find((item) => item.content.trim() && item.status !== 'failed')
  if (!latest) return []
  const text = latest.content.replace(/\s+/g, ' ').trim()
  const excerpt = text.length > 24 ? `${text.slice(0, 24)}…` : text
  const suggestions = text.match(/计划|方案|步骤|安排/) ? [
    '请把这个方案拆成具体步骤',
    '这个计划有哪些风险和依赖',
    '帮我补充一个时间表和优先级',
    '这个方案还可以怎样简化',
    '请给出验证方案是否有效的指标',
  ] : text.match(/代码|接口|程序|开发|技术/) ? [
    '请给出一个最小可运行示例',
    '这个实现有哪些边界情况',
    '帮我列一份针对它的测试清单',
    '如何提升这段实现的可维护性',
    '这个接口需要如何处理异常',
  ] : text.match(/数据|报表|指标|分析/) ? [
    '请指出最值得关注的关键指标',
    '这些数据可能有哪些异常原因',
    '如何把结果做成清晰的可视化',
    '请给出进一步分析的切入点',
    '哪些结论还需要更多数据验证',
  ] : text.match(/总结|文档|报告|结论/) ? [
    '请提炼成三条核心结论',
    '帮我整理成可执行的行动清单',
    '还有哪些问题需要进一步确认',
    '请把这份内容改写得更简洁',
    '帮我拟一个适合分享的标题',
  ] : [
    `围绕“${excerpt}”继续展开`,
    '请给出一个具体例子',
    '请整理成可执行的清单',
    '这个话题还有哪些容易忽略的地方',
    '请从另一个角度重新分析',
  ]
  return suggestions.slice(0, count)
}

function toBubbleItems(messages: AiMessage[], user: User | null, robotIcon: string): BubbleItem[] {
  return messages.map((message) => ({
    key: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    placement: message.role === 'user' ? 'end' : 'start',
    content: <div className="ai-message-content">
      {message.content || (message.status === 'pending' ? '正在生成…' : message.errorMessage || '未返回内容')}
      {message.attachments?.length ? <div className="ai-message-attachments">{message.attachments.map((attachment) => attachment.mime.startsWith('image/') ? <a key={attachment.url} href={attachment.originalUrl || attachment.url} download={attachment.name} title="下载原图"><Image src={attachment.url} alt={attachment.name} width={96} height={72} preview={{ src: attachment.originalUrl || attachment.url }} /></a> : <Typography.Link key={attachment.url} href={attachment.originalUrl || attachment.url} target="_blank" rel="noreferrer">{attachment.name}</Typography.Link>)}</div> : null}
    </div>,
    loading: message.status === 'pending' && !message.content,
    typing: message.status === 'pending' && !!message.content,
    avatar: message.role === 'user'
      ? user?.avatar ? <img className="ai-user-avatar" src={user.avatar} alt={user.name} /> : <span className="ai-user-avatar-fallback">{user?.name?.slice(0, 1) || <UserOutlined />}</span>
      : <img className="ai-bot-avatar" src={robotIcon} alt="AI" />,
    variant: message.role === 'user' ? 'filled' : 'borderless',
  }))
}

export default function AIChat() {
  const { user, logout, can } = useAuth()
  const { settings, defaultLogo: fallbackLogo } = useSystemSettings()
  const defaultLogo = settings.systemLogo || fallbackLogo
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640)
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [agents, setAgents] = useState<import('../platform/ai-assistant/types').AiAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number>()
  const [knowledgeBases, setKnowledgeBases] = useState<AiKnowledgeBase[]>([])
  const [skills, setSkills] = useState<AiSkill[]>([])
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number>()
  const [selectedSkill, setSelectedSkill] = useState<string>()
  const [attachmentItems, setAttachmentItems] = useState<UploadFile[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false)
  const [knowledgeForm] = Form.useForm<{ name: string; description?: string; title?: string; content?: string }>()
  const abortRef = useRef<AbortController | null>(null)
  const assistantRef = useRef<number | null>(null)

  const loadConversation = useCallback(async (id: number) => {
    setActiveId(id)
    try {
      const [conversationMessages, conversation] = await Promise.all([aiApi.messages(id), aiApi.conversation(id)])
      setMessages(conversationMessages)
      setSelectedAgentId(conversation.agentId)
    } catch (error) {
      message.error((error as Error).message)
    }
  }, [message])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [conversationList, agentList, skillList, knowledgeBaseList] = await Promise.all([aiApi.conversations(), aiApi.agents(), aiApi.skills(), aiApi.knowledgeBases()])
      setConversations(conversationList)
      setAgents(agentList)
      setKnowledgeBases(knowledgeBaseList)
      setSkills(skillList)
      if (conversationList.length) await loadConversation(conversationList[0].id)
      else setActiveId(null)
      const defaultAgent = agentList.find((agent) => agent.isDefault) || agentList[0]
      if (defaultAgent) setSelectedAgentId((current) => current || defaultAgent.id)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [loadConversation, message])

  useEffect(() => { void load() }, [load, user?.id])

  const createConversation = async () => {
    try {
      const conversation = await aiApi.createConversation({ agentId: selectedAgentId })
      setConversations((current) => [conversation, ...current])
      setActiveId(conversation.id)
      setMessages([])
      if (window.innerWidth <= 640) setCollapsed(true)
    } catch (error) { message.error((error as Error).message) }
  }

  const deleteConversation = (conversation: AiConversation) => {
    modal.confirm({ title: '删除会话', content: `确定删除“${conversation.title}”吗？`, okText: '删除', cancelText: '取消', okButtonProps: { danger: true }, onOk: async () => {
      await aiApi.deleteConversation(conversation.id)
      const remaining = conversations.filter((item) => item.id !== conversation.id)
      setConversations(remaining)
      if (activeId === conversation.id) {
        setActiveId(remaining[0]?.id || null)
        setMessages([])
        if (remaining[0]) await loadConversation(remaining[0].id)
      }
    } })
  }

  const parseStream = async (response: Response, assistantId: number) => {
    if (!response.body) throw new Error('服务器未返回流式响应')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() || ''
      for (const event of events) {
        const eventName = event.match(/^event:\s*(.+)$/m)?.[1]
        const data = event.match(/^data:\s*(.+)$/m)?.[1]
        if (!data) continue
        const payload = JSON.parse(data) as { delta?: string; message?: string; messageId?: number }
        if (eventName === 'message' && payload.delta) {
          setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + payload.delta, status: 'pending' } : item))
        }
        if (eventName === 'error') throw new Error(payload.message || '模型服务异常')
        if (eventName === 'done') setMessages((current) => current.map((item) => item.id === (payload.messageId || assistantId) ? { ...item, status: 'completed' } : item))
      }
      if (done) {
        const eventName = buffer.match(/^event:\s*(.+)$/m)?.[1]
        const data = buffer.match(/^data:\s*(.+)$/m)?.[1]
        if (eventName && data) {
          const payload = JSON.parse(data) as { delta?: string; message?: string; messageId?: number }
          if (eventName === 'message' && payload.delta) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + payload.delta, status: 'pending' } : item))
          if (eventName === 'error') throw new Error(payload.message || '模型服务异常')
          if (eventName === 'done') setMessages((current) => current.map((item) => item.id === (payload.messageId || assistantId) ? { ...item, status: 'completed' } : item))
        }
        break
      }
    }
  }

  const readAttachment = async (file: UploadFile): Promise<AiAttachment> => {
    if (file.url) return { name: file.name, url: file.url, mime: file.type || 'application/octet-stream', size: file.size || 0 }
    const source = file.originFileObj
    if (!source) throw new Error(`无法读取附件：${file.name}`)
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(`无法读取附件：${file.name}`)); reader.readAsDataURL(source) })
    return aiApi.uploadAttachment({ name: file.name, dataUrl })
  }

  const send = async (content: string) => {
    if ((!content.trim() && !attachmentItems.length) || sending) return
    try {
      const attachments = await Promise.all(attachmentItems.map(readAttachment))
      setAttachmentItems([])
      if (!activeId) {
        const conversation = await aiApi.createConversation({ agentId: selectedAgentId })
        setConversations((current) => [conversation, ...current])
        setActiveId(conversation.id)
        await sendToConversation(conversation.id, content, attachments)
        return
      }
      await sendToConversation(activeId, content, attachments)
    } catch (error) { message.error((error as Error).message) }
  }

  const sendToConversation = async (conversationId: number, content: string, attachments: AiAttachment[]) => {
    setInput('')
    setSelectedSkill(undefined)
    setSending(true)
    const temporaryUserId = -Date.now()
    const temporaryAssistantId = temporaryUserId - 1
    const abortController = new AbortController()
    abortRef.current = abortController
    assistantRef.current = temporaryAssistantId
    setMessages((current) => [...current, { id: temporaryUserId, conversationId, role: 'user', content, attachments, status: 'completed', createdAt: new Date().toISOString() }, { id: temporaryAssistantId, conversationId, role: 'assistant', content: '', status: 'pending', createdAt: new Date().toISOString() }])
    try {
      const response = await aiApi.sendMessage(conversationId, { content, agentId: selectedAgentId, attachments, skill: selectedSkill, knowledgeBaseId: selectedKnowledgeBaseId }, abortController.signal)
      await parseStream(response, temporaryAssistantId)
      const [updatedMessages, updatedConversation] = await Promise.all([aiApi.messages(conversationId), aiApi.conversation(conversationId)])
      setMessages(updatedMessages)
      setConversations((current) => current.map((item) => item.id === conversationId ? updatedConversation : item))
    } catch (error) {
      if (abortController.signal.aborted) {
        setMessages((current) => current.map((item) => item.id === temporaryAssistantId ? { ...item, status: 'failed', errorMessage: '已停止生成' } : item))
        return
      }
      setMessages((current) => current.map((item) => item.id === temporaryAssistantId ? { ...item, status: 'failed', errorMessage: (error as Error).message, content: '' } : item))
      message.error((error as Error).message)
    } finally { if (abortRef.current === abortController) abortRef.current = null; if (assistantRef.current === temporaryAssistantId) assistantRef.current = null; setSending(false) }
  }

  const cancelGeneration = () => { abortRef.current?.abort(); const assistantId = assistantRef.current; if (assistantId) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, status: 'failed', errorMessage: '已停止生成' } : item)) }

  const conversationItems: Conversation[] = useMemo(() => conversations.map((conversation) => ({ key: String(conversation.id), label: conversation.title, timestamp: new Date(conversation.updatedAt).getTime() })), [conversations])
  const robotIcon = settings.aiChatRobotIcon || defaultLogo
  const bubbleItems = toBubbleItems(messages, user, robotIcon)
  const starterPromptSuggestions = useMemo(
    () => pickRandom(STARTER_PROMPTS, settings.aiChatFirstPromptCount || 0),
    [activeId, settings.aiChatFirstPromptCount],
  )
  const followupPromptSuggestions = useMemo(
    () => getFollowupSuggestions(messages, settings.aiChatFollowupCount || 0),
    [messages, settings.aiChatFollowupCount],
  )
  const mentionMatch = input.match(/(?:^|\s)([@/])([^\s]*)$/)
  const mentionTrigger = mentionMatch?.[1]
  const mentionQuery = mentionMatch?.[2]?.toLowerCase() || ''
  const mentionItems = (mentionTrigger === '/' ? skills.map((skill) => ({ value: `skill:${skill.key}`, label: `/${skill.name}`, icon: <RobotOutlined />, extra: skill.description })) : [
    ...attachmentItems.map((item) => ({ value: `file:${item.name}`, label: `文件：${item.name}`, icon: <FileAddOutlined /> })),
    ...knowledgeBases.map((knowledgeBase) => ({ value: `knowledge:${knowledgeBase.id}`, label: `知识库：${knowledgeBase.name}`, icon: <FileAddOutlined />, extra: knowledgeBase.description })),
    ...agents.map((agent) => ({ value: `agent:${agent.id}`, label: `智能体：${agent.name}`, icon: <RobotOutlined />, extra: agent.description })),
  ]).filter((item) => !mentionQuery || item.label.toLowerCase().includes(mentionQuery))
  const selectMention = (value: string) => { const agent = value.startsWith('agent:') ? agents.find((item) => `agent:${item.id}` === value) : undefined; const target = value.startsWith('skill:') ? skills.find((skill) => `skill:${skill.key}` === value) : undefined; const knowledgeBase = value.startsWith('knowledge:') ? knowledgeBases.find((item) => `knowledge:${item.id}` === value) : undefined; if (agent) setSelectedAgentId(agent.id); if (target) setSelectedSkill(target.key); if (knowledgeBase) setSelectedKnowledgeBaseId(knowledgeBase.id); const label = agent?.name || target?.name || knowledgeBase?.name || value.replace('file:', ''); setInput(input.replace(/(?:^|\s)([@/])([^\s]*)$/, (match) => `${match.startsWith(' ') ? ' ' : ''}${match.trimStart().startsWith('/') ? '/' : '@'}${label} `)) }
  const validateAttachment = (file: UploadFile) => {
    if ((file.size || 0) > 10 * 1024 * 1024) { message.error(`${file.name} 超过 10MB`); return false }
    return false
  }
  const composer = <Suggestion open={Boolean(mentionTrigger) && mentionItems.length > 0} items={mentionItems} onSelect={selectMention}>{({ onKeyDown }) => <Sender value={input} onChange={setInput} onKeyDown={onKeyDown} onSubmit={(value) => { void send(value) }} onCancel={cancelGeneration} loading={sending} disabled={!agents.length} submitType="enter" placeholder={agents.length ? '输入消息，@ 知识库、文件或智能体，/ 搜索 Skill' : '请先配置智能体'} allowSpeech footer={() => <div className="ai-composer-tools"><Space.Compact className="ai-knowledge-tools"><Select aria-label="知识库" className="ai-knowledge-select" allowClear disabled={!knowledgeBases.length} value={selectedKnowledgeBaseId} placeholder="知识库（可选）" options={knowledgeBases.map((item) => ({ value: item.id, label: item.name }))} onChange={setSelectedKnowledgeBaseId} /></Space.Compact><Select aria-label="智能体" className="ai-agent-select" value={selectedAgentId} placeholder="选择智能体" options={agents.map((agent) => ({ value: agent.id, label: `${agent.name}${agent.isDefault ? '（默认）' : ''}`, disabled: !agent.enabled }))} onChange={setSelectedAgentId} /></div>} actions={(_origin, { components: { SpeechButton, SendButton, LoadingButton } }) => <Space size={4} align="center"><Attachments className="ai-inline-attachments" accept="*" maxCount={5} items={attachmentItems} beforeUpload={validateAttachment} onChange={({ fileList }) => setAttachmentItems(fileList)}><Button type="text" size="small" icon={<PaperClipOutlined />} aria-label="添加附件" /></Attachments><SpeechButton />{sending ? <LoadingButton /> : <SendButton />}</Space>} autoSize={{ minRows: 2, maxRows: 6 }} />}</Suggestion>

  const saveKnowledgeBase = async () => {
    try {
      const values = await knowledgeForm.validateFields()
      const knowledgeBase = await aiApi.createKnowledgeBase({ name: values.name, description: values.description })
      if (values.content?.trim()) await aiApi.createKnowledgeDocument(knowledgeBase.id, { title: values.title?.trim() || '未命名文档', content: values.content.trim() })
      setKnowledgeBases((current) => [knowledgeBase, ...current])
      setSelectedKnowledgeBaseId(knowledgeBase.id)
      knowledgeForm.resetFields()
      setKnowledgeModalOpen(false)
      message.success('知识库已创建')
    } catch (error) { if (!(error as { errorFields?: unknown }).errorFields) message.error((error as Error).message) }
  }

  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  const followupPrompts = followupPromptSuggestions.map((label, index) => ({ key: `followup-${index}`, label: <span title={label}>{label}</span> }))
  const starterPrompts = starterPromptSuggestions.map((label, index) => ({ key: `starter-${index}`, label: <span title={label}>{label}</span> }))
  const theme = settings.aiChatTheme || 'light'
  const effectsClass = settings.aiChatEffects ? 'ai-effects-enabled' : 'ai-effects-disabled'
  return <Layout className={`ai-chat-page ai-theme-${theme} ${effectsClass} ${collapsed ? 'ai-chat-collapsed' : 'ai-chat-expanded'} ${settings.showAiChatHeader ? '' : 'ai-chat-header-hidden'}`} style={{ '--ai-brand-title': settings.systemTitle } as React.CSSProperties}>
    {!collapsed && <><div className="ai-chat-sider-mask" role="presentation" onClick={() => setCollapsed(true)} /><Layout.Sider width={280} theme="light" className="ai-chat-sider"><div className="ai-chat-sider-head"><button type="button" className="ai-chat-brand" onClick={() => navigate('/')} aria-label="返回首页"><img src={defaultLogo} alt="" /><strong>{settings.systemTitle}</strong></button><Button type="primary" onClick={createConversation}>新会话</Button></div><Conversations items={conversationItems} activeKey={activeId ? String(activeId) : undefined} onActiveChange={(key) => { void loadConversation(Number(key)); if (window.innerWidth <= 640) setCollapsed(true) }} menu={(item) => ({ items: [{ key: 'delete', label: '删除会话', icon: <DeleteOutlined />, danger: true }], onClick: ({ key }) => { if (key === 'delete') { const conversation = conversations.find((value) => String(value.id) === item.key); if (conversation) deleteConversation(conversation) } } })} /></Layout.Sider></>}
    <Layout className="ai-chat-main">
      {settings.showAiChatHeader && <header className="ai-chat-header">
        <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed((value) => !value)} aria-label="切换会话栏" />
        {user && can('platform.app.read') && <Button type="text" onClick={() => navigate('/config/dashboard')}>控制台</Button>}
        {user && <UserMenu user={user} onLogout={async () => { await logout(); navigate('/login', { replace: true }) }} />}
      </header>}
      <main className="ai-chat-content">{messages.length ? <><Bubble.List items={bubbleItems} autoScroll />{followupPrompts.length > 0 && !sending && <Prompts items={followupPrompts} onItemClick={({ data }) => setInput(followupPromptSuggestions[Number(data.key.replace('followup-', ''))] || '')} wrap />}</> : <div className="ai-welcome"><Welcome variant="borderless" description={settings.aiChatWelcome || '发送文本、文件或语音输入，开始一段新的对话。'} /><Prompts items={starterPrompts} onItemClick={({ data }) => setInput(starterPromptSuggestions[Number(data.key.replace('starter-', ''))] || '')} wrap /></div>}</main>
      <div className="ai-chat-sender" role="region" aria-label="聊天输入区"><div className="ai-composer-input">{composer}</div></div><Drawer title="新建知识库" width={480} open={knowledgeModalOpen} onClose={() => setKnowledgeModalOpen(false)} destroyOnClose extra={<Space><Button onClick={() => setKnowledgeModalOpen(false)}>取消</Button><Button type="primary" onClick={() => { void saveKnowledgeBase() }}>创建</Button></Space>}><Form form={knowledgeForm} layout="vertical"><Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入知识库名称' }]}><Input maxLength={120} /></Form.Item><Form.Item name="description" label="描述"><Input maxLength={500} /></Form.Item><Form.Item name="title" label="初始文档标题"><Input maxLength={200} /></Form.Item><Form.Item name="content" label="初始文档内容"><Input.TextArea rows={6} maxLength={200000} showCount /></Form.Item></Form></Drawer>
    </Layout>
  </Layout>
}
