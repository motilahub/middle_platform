import { AudioOutlined, DeleteOutlined, FileAddOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PaperClipOutlined, PlusOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import { App, Button, Form, Image, Input, Layout, Modal, Select, Space, Spin, Typography, type UploadFile } from 'antd'
import { Attachments, Bubble, Conversations, Prompts, Sender, Suggestion, Welcome, type Conversation } from '@ant-design/x'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../platform/ai-assistant/api'
import { AiAttachment, AiConversation, AiKnowledgeBase, AiMessage, AiSkill } from '../platform/ai-assistant/types'
import type { User } from '../types'
import { useAuth } from '../auth'
import { useSystemSettings } from '../system-settings'

type BubbleItem = NonNullable<React.ComponentProps<typeof Bubble.List>['items']>[number]

function toBubbleItems(messages: AiMessage[], user: User | null, robotIcon: string): BubbleItem[] {
  return messages.map((message) => ({
    key: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    placement: message.role === 'user' ? 'end' : 'start',
    content: <div className="ai-message-content">
      {message.content || (message.status === 'pending' ? '正在生成…' : message.errorMessage || '未返回内容')}
      {message.attachments?.length ? <div className="ai-message-attachments">{message.attachments.map((attachment) => attachment.mime.startsWith('image/') ? <Image key={attachment.url} src={attachment.url} alt={attachment.name} width={96} height={72} preview /> : <Typography.Link key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</Typography.Link>)}</div> : null}
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
  const { user } = useAuth()
  const { settings, defaultLogo } = useSystemSettings()
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

  const activeConversation = conversations.find((conversation) => conversation.id === activeId)

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
      const [conversationList, agentList, skillList] = await Promise.all([aiApi.conversations(), aiApi.agents(), aiApi.skills()])
      setConversations(conversationList)
      setAgents(agentList)
      setKnowledgeBases([])
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
    setMessages((current) => [...current, { id: temporaryUserId, conversationId, role: 'user', content, attachments, status: 'completed', createdAt: new Date().toISOString() }, { id: temporaryAssistantId, conversationId, role: 'assistant', content: '', status: 'pending', createdAt: new Date().toISOString() }])
    try {
      const response = await aiApi.sendMessage(conversationId, { content, agentId: selectedAgentId, attachments, skill: selectedSkill, knowledgeBaseId: selectedKnowledgeBaseId })
      await parseStream(response, temporaryAssistantId)
      const [updatedMessages, updatedConversation] = await Promise.all([aiApi.messages(conversationId), aiApi.conversation(conversationId)])
      setMessages(updatedMessages)
      setConversations((current) => current.map((item) => item.id === conversationId ? updatedConversation : item))
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === temporaryAssistantId ? { ...item, status: 'failed', errorMessage: (error as Error).message, content: '' } : item))
      message.error((error as Error).message)
    } finally { setSending(false) }
  }

  const conversationItems: Conversation[] = useMemo(() => conversations.map((conversation) => ({ key: String(conversation.id), label: conversation.title, timestamp: new Date(conversation.updatedAt).getTime() })), [conversations])
  const robotIcon = settings.aiChatRobotIcon || defaultLogo
  const bubbleItems = toBubbleItems(messages, user, robotIcon)
  const activeAgent = agents.find((agent) => agent.id === selectedAgentId)
  const promptSuggestions = ['请帮我总结这段内容', '帮我制定一个执行计划', '解释一下这个问题']
  const mention = input.match(/(?:^|\s)@([^\s]*)$/)?.[1] || ''
  const mentionItems = [...attachmentItems.map((item) => ({ value: `file:${item.name}`, label: `文件：${item.name}`, icon: <FileAddOutlined /> })), ...agents.map((agent) => ({ value: `agent:${agent.id}`, label: `智能体：${agent.name}`, icon: <RobotOutlined />, extra: agent.description })), ...skills.map((skill) => ({ value: `skill:${skill.key}`, label: `Skill：${skill.name}`, icon: <RobotOutlined />, extra: skill.description }))]
  const selectMention = (value: string) => { const agent = value.startsWith('agent:') ? agents.find((item) => `agent:${item.id}` === value) : undefined; const target = value.startsWith('skill:') ? skills.find((skill) => `skill:${skill.key}` === value) : undefined; if (agent) setSelectedAgentId(agent.id); if (target) setSelectedSkill(target.key); setInput(input.replace(/(?:^|\s)@([^\s]*)$/, (match) => `${match.startsWith(' ') ? ' ' : ''}@${agent?.name || target?.name || value.replace('file:', '')} `)) }
  const composer = <Suggestion open={/(?:^|\s)@[^\s]*$/.test(input) && mentionItems.length > 0} items={mentionItems} onSelect={selectMention}>{({ onKeyDown }) => <Sender value={input} onChange={setInput} onKeyDown={onKeyDown} onSubmit={(value) => { void send(value) }} loading={sending} disabled={!agents.length} submitType="enter" placeholder={agents.length ? '输入消息，@ 文件、智能体或 Skill' : '请先配置智能体'} allowSpeech actions={(_origin, { components: { SpeechButton, SendButton, LoadingButton } }) => <Space size={4}><Attachments className="ai-inline-attachments" accept="*" maxCount={5} items={attachmentItems} beforeUpload={validateAttachment} onChange={({ fileList }) => setAttachmentItems(fileList)}><Button type="text" size="small" icon={<PaperClipOutlined />} aria-label="添加附件" /></Attachments><SpeechButton />{sending ? <LoadingButton /> : <SendButton />}</Space>} autoSize={{ minRows: 2, maxRows: 6 }} />}</Suggestion>

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

  const validateAttachment = (file: UploadFile) => {
    if ((file.size || 0) > 10 * 1024 * 1024) { message.error(`${file.name} 超过 10MB`); return false }
    return false
  }

  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  const followupPrompts = promptSuggestions.slice(0, settings.aiChatFollowupCount || 0).map((label, index) => ({ key: `followup-${index}`, label }))
  const theme = settings.aiChatTheme || 'light'
  const effectsClass = settings.aiChatEffects ? 'ai-effects-enabled' : 'ai-effects-disabled'
  return <Layout className={`ai-chat-page ai-theme-${theme} ${effectsClass} ${collapsed ? 'ai-chat-collapsed' : 'ai-chat-expanded'}`}>
    <button type="button" className="ai-chat-brand" onClick={() => navigate('/')} aria-label="返回首页"><img src={defaultLogo} alt="" /><strong>AI 对话</strong></button>
    {!collapsed && <><div className="ai-chat-sider-mask" role="presentation" onClick={() => setCollapsed(true)} /><Layout.Sider width={280} theme="light" className="ai-chat-sider"><div className="ai-chat-sider-head"><Typography.Title level={4}>AI 对话</Typography.Title><Button type="primary" icon={<PlusOutlined />} onClick={createConversation}>新会话</Button></div><Conversations items={conversationItems} activeKey={activeId ? String(activeId) : undefined} onActiveChange={(key) => { void loadConversation(Number(key)); if (window.innerWidth <= 640) setCollapsed(true) }} menu={(item) => ({ items: [{ key: 'delete', label: '删除会话', icon: <DeleteOutlined />, danger: true }], onClick: ({ key }) => { if (key === 'delete') { const conversation = conversations.find((value) => String(value.id) === item.key); if (conversation) deleteConversation(conversation) } } })} /></Layout.Sider></>}
    <Layout className="ai-chat-main"><header className="ai-chat-header"><Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed((value) => !value)} aria-label="切换会话栏" /><div className="ai-chat-title"><Typography.Title level={4}>{activeConversation?.title || '新会话'}</Typography.Title><Typography.Text type="secondary">对话内容仅对当前登录用户可见</Typography.Text></div><Button type="text" onClick={() => navigate('/')}>返回工作台</Button></header><main className="ai-chat-content">{messages.length ? <><Bubble.List items={bubbleItems} autoScroll />{followupPrompts.length > 0 && !sending && <Prompts items={followupPrompts} onItemClick={({ data }) => setInput(String(data.label || ''))} wrap />}</> : <div className="ai-welcome"><Welcome icon={settings.aiChatRobotIcon ? <img className="ai-welcome-icon" src={settings.aiChatRobotIcon} alt="AI" /> : <img className="ai-welcome-icon" src={defaultLogo} alt="AI" />} title={activeAgent?.name || settings.aiChatWelcome || '开始一段新的对话'} description={settings.aiChatWelcome || '发送文本、文件或语音输入，开始一段新的对话。'} /><Prompts items={promptSuggestions.slice(0, settings.aiChatFirstPromptCount || 0).map((label, index) => ({ key: String(index), label }))} onItemClick={({ data }) => setInput(String(data.label || ''))} wrap /></div>}</main><footer className="ai-chat-sender"><div className="ai-composer-input">{composer}</div><Typography.Text type="secondary" className="ai-composer-hint"><AudioOutlined /> 支持浏览器语音输入</Typography.Text><div className="ai-composer-tools"><Space.Compact className="ai-knowledge-tools"><Select aria-label="知识库" className="ai-knowledge-select" allowClear disabled={!knowledgeBases.length} value={selectedKnowledgeBaseId} placeholder="知识库（可选）" options={knowledgeBases.map((item) => ({ value: item.id, label: item.name }))} onChange={setSelectedKnowledgeBaseId} /><Button aria-label="新建知识库" icon={<PlusOutlined />} onClick={() => setKnowledgeModalOpen(true)} /></Space.Compact><Select aria-label="智能体" className="ai-agent-select" value={selectedAgentId} placeholder="选择智能体" options={agents.map((agent) => ({ value: agent.id, label: `${agent.name}${agent.isDefault ? '（默认）' : ''}`, disabled: !agent.enabled }))} onChange={setSelectedAgentId} /></div></footer><Modal title="新建知识库" open={knowledgeModalOpen} onOk={() => { void saveKnowledgeBase() }} onCancel={() => setKnowledgeModalOpen(false)} okText="创建" cancelText="取消"><Form form={knowledgeForm} layout="vertical"><Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入知识库名称' }]}><Input maxLength={120} /></Form.Item><Form.Item name="description" label="描述"><Input maxLength={500} /></Form.Item><Form.Item name="title" label="初始文档标题"><Input maxLength={200} /></Form.Item><Form.Item name="content" label="初始文档内容"><Input.TextArea rows={6} maxLength={200000} showCount /></Form.Item></Form></Modal></Layout>
  </Layout>
}
