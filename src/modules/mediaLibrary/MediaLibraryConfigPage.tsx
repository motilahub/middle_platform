import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Empty, Form, Grid, Image, Input, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import { CloudSyncOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { mediaLibraryApi } from './api'
import { episodeLabel } from './episode'
import type { DoubanSearchResult, MediaItem, MediaItemInput, MediaType } from './types'

const typeLabel = (type: MediaType) => type === 'movie' ? '电影' : '电视剧'

export default function MediaLibraryConfigPage() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const [form] = Form.useForm<MediaItemInput>()
  const formMediaType = Form.useWatch('mediaType', form)
  const [rows, setRows] = useState<MediaItem[]>([])
  const [type, setType] = useState<MediaType | 'all'>('all')
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [checked, setChecked] = useState<number[]>([])
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [doubanOpen, setDoubanOpen] = useState(false)
  const [doubanKeyword, setDoubanKeyword] = useState('')
  const [doubanResults, setDoubanResults] = useState<DoubanSearchResult[]>([])
  const [doubanSearching, setDoubanSearching] = useState(false)
  const [importingId, setImportingId] = useState<string>()
  const may = useCallback((operation: 'read' | 'create' | 'write' | 'unlink') => can('media.library.manage') || can(`media.library.${operation}`), [can])

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await mediaLibraryApi.adminList(type, query)) }
    catch (error) { message.error((error as Error).message) }
    finally { setLoading(false) }
  }, [message, query, type])

  useEffect(() => { void load() }, [load])

  const openCreate = () => {
    setSelected(null)
    form.resetFields()
    form.setFieldsValue({ mediaType: 'movie' })
    setEditorOpen(true)
  }

  const openEdit = (item: MediaItem) => {
    setSelected(item)
    form.setFieldsValue({
      mediaType: item.mediaType,
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      posterUrl: item.posterUrl,
      rating: item.rating,
      summary: item.summary,
      totalEpisodeCount: item.totalEpisodeCount,
      availableEpisodeCount: item.availableEpisodeCount,
      sourceUrl: item.sourceUrl,
    })
    setEditorOpen(true)
  }

  const save = async (values: MediaItemInput) => {
    setSaving(true)
    try {
      if (selected) await mediaLibraryApi.update(selected.id, values)
      else await mediaLibraryApi.create(values)
      setEditorOpen(false)
      await load()
      message.success('保存成功')
    } catch (error) { message.error((error as Error).message) }
    finally { setSaving(false) }
  }

  const remove = async (ids: number[]) => {
    try {
      const output = ids.length === 1 ? await mediaLibraryApi.delete(ids[0]) : await mediaLibraryApi.deleteMany(ids)
      setChecked((values) => values.filter((id) => !ids.includes(id)))
      await load()
      message.success(`已删除 ${output.deleted} 条影视`)
    } catch (error) { message.error((error as Error).message) }
  }

  const syncRankings = async () => {
    setSyncing(true)
    try {
      const output = await mediaLibraryApi.sync()
      const failed = output.sources.filter((source) => source.status === 'failed')
      if (failed.length) message.warning(failed.map((source) => source.message).join('；'))
      else message.success('榜单同步完成')
      await load()
    } catch (error) { message.error((error as Error).message) }
    finally { setSyncing(false) }
  }

  const searchDouban = async (value: string) => {
    const keyword = value.trim()
    if (!keyword) return message.warning('请输入影视名称')
    setDoubanSearching(true)
    try { setDoubanResults(await mediaLibraryApi.searchDouban(keyword)) }
    catch (error) { message.error((error as Error).message) }
    finally { setDoubanSearching(false) }
  }

  const importDouban = async (result: DoubanSearchResult) => {
    setImportingId(result.externalId)
    try {
      const output = await mediaLibraryApi.importDouban(result.externalId, result.mediaType)
      setDoubanResults((items) => items.map((item) => item.externalId === result.externalId ? { ...item, inLibrary: true } : item))
      await load()
      message.success(output.message)
    } catch (error) { message.error((error as Error).message) }
    finally { setImportingId(undefined) }
  }

  const columns = useMemo(() => [
    { title: '海报', width: 72, render: (_: unknown, row: MediaItem) => <Image className="media-admin-poster" width={38} height={54} preview={false} src={`/api/media-library/items/${row.id}/poster`} fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" /> },
    { title: '名称', dataIndex: 'title', ellipsis: true, render: (value: string, row: MediaItem) => <div className="media-admin-title"><strong>{value}</strong><span>{typeLabel(row.mediaType)}{row.year ? ` · ${row.year}` : ''}{` · ${(row.rating || 0).toFixed(1)} 分`}</span></div> },
    { title: '类型', dataIndex: 'mediaType', width: 90, responsive: ['md'] as Array<'md'>, render: typeLabel },
    { title: '年份', dataIndex: 'year', width: 90, responsive: ['md'] as Array<'md'>, render: (value?: number) => value || '-' },
    { title: '评分', dataIndex: 'rating', width: 90, responsive: ['md'] as Array<'md'>, render: (value?: number) => (value || 0).toFixed(1) },
    { title: '来源', width: 130, responsive: ['md'] as Array<'md'>, render: (_: unknown, row: MediaItem) => <Space size={4}>{row.isRanked && <Tag color="blue">榜单</Tag>}{row.addedManually && <Tag color="green">手工加入</Tag>}{!row.isRanked && !row.addedManually && <Tag>历史</Tag>}</Space> },
    { title: '集数', width: 150, responsive: ['md'] as Array<'md'>, render: (_: unknown, row: MediaItem) => episodeLabel(row) || '-' },
    { title: '操作', width: 190, fixed: 'right' as const, render: (_: unknown, row: MediaItem) => <Space size={0}><Button type="link" onClick={() => navigate(`/media-library/${row.id}`)}>查看</Button>{may('write') && <Button type="link" onClick={() => openEdit(row)}>编辑</Button>}{may('unlink') && <Popconfirm title="确认删除该影视？" description={row.isRanked ? '下次同步榜单时可能重新加入。' : undefined} onConfirm={() => void remove([row.id])}><Button type="link" danger>删除</Button></Popconfirm>}</Space> },
  ], [may, navigate, rows])

  return <div>
    <div className="page-title">
      <div><Typography.Title level={3}>影视库管理</Typography.Title><Typography.Text type="secondary">维护影视资料、豆瓣榜单和资源入口</Typography.Text></div>
      <Space wrap>
        {may('unlink') && <Popconfirm title={`确认删除选中的 ${checked.length} 条影视？`} disabled={!checked.length} onConfirm={() => void remove(checked)}><Button danger disabled={!checked.length}>删除选中</Button></Popconfirm>}
        {can('media.library.sync') && <Button icon={<CloudSyncOutlined />} loading={syncing} onClick={() => void syncRankings()}>同步榜单</Button>}
        {may('create') && <Button onClick={() => setDoubanOpen(true)}>从豆瓣添加</Button>}
        {may('create') && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建</Button>}
      </Space>
    </div>
    <div className="media-admin-filters">
      <Select value={type} onChange={setType} options={[{ value: 'all', label: '全部类型' }, { value: 'movie', label: '电影' }, { value: 'tv', label: '电视剧' }]} />
      <Input.Search allowClear value={searchText} prefix={<SearchOutlined />} placeholder="搜索已入库名称" enterButton="搜索" onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) setQuery('') }} onSearch={(value) => setQuery(value.trim())} />
    </div>
    <Table className="config-table" rowKey="id" loading={loading} columns={columns} dataSource={rows} scroll={screens.md ? { x: 1080 } : undefined} rowSelection={may('unlink') ? { selectedRowKeys: checked, preserveSelectedRowKeys: true, onChange: (keys) => setChecked(keys as number[]) } : undefined} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `共 ${total} 条` }} onRow={(record) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-popover,.ant-checkbox-wrapper')) return; if (may('write')) openEdit(record) } })} />

    <Drawer title={selected ? '编辑影视' : '新建影视'} width={560} open={editorOpen} onClose={() => setEditorOpen(false)} destroyOnClose extra={<Button type="primary" loading={saving} onClick={() => form.submit()}>保存</Button>}>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item name="mediaType" label="类型" rules={[{ required: true, message: '请选择类型' }]}><Select options={[{ value: 'movie', label: '电影' }, { value: 'tv', label: '电视剧' }]} /></Form.Item>
        <Form.Item name="title" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input maxLength={300} /></Form.Item>
        <Form.Item name="originalTitle" label="原名"><Input maxLength={300} /></Form.Item>
        <Space className="media-admin-form-row" align="start">
          <Form.Item name="year" label="年份"><InputNumber min={1800} max={2200} precision={0} /></Form.Item>
          <Form.Item name="rating" label="评分"><InputNumber min={0} max={10} precision={1} step={0.1} /></Form.Item>
          {formMediaType === 'tv' && <Form.Item name="totalEpisodeCount" label="总集数"><InputNumber min={1} max={9999} precision={0} /></Form.Item>}
          {formMediaType === 'tv' && <Form.Item name="availableEpisodeCount" label="已更新"><InputNumber min={1} max={9999} precision={0} /></Form.Item>}
        </Space>
        <Form.Item name="posterUrl" label="海报地址" rules={[{ type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://..." /></Form.Item>
        <Form.Item name="sourceUrl" label="来源链接" rules={[{ type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://..." /></Form.Item>
        <Form.Item name="summary" label="简介"><Input.TextArea rows={6} maxLength={5000} showCount /></Form.Item>
      </Form>
    </Drawer>

    <Drawer title="从豆瓣添加" width={680} open={doubanOpen} onClose={() => setDoubanOpen(false)} destroyOnClose>
      <Input.Search autoFocus allowClear value={doubanKeyword} placeholder="输入电影或电视剧名称" enterButton="搜索豆瓣" loading={doubanSearching} onChange={(event) => setDoubanKeyword(event.target.value)} onSearch={(value) => void searchDouban(value)} />
      <div className="media-douban-results">
        {doubanResults.length ? doubanResults.map((result) => <div className="media-douban-result" key={`${result.mediaType}-${result.externalId}`}>
          <img src={`/api/media-library/admin/poster?url=${encodeURIComponent(result.posterUrl || '')}`} alt="" />
          <div className="media-douban-result-copy">
            <strong>{result.title}</strong>
            <div><Tag>{typeLabel(result.mediaType)}</Tag>{result.year || '年份未知'}{` · ${(result.rating || 0).toFixed(1)} 分`}</div>
            {result.subtitle && <span>{result.subtitle}</span>}
          </div>
          <Button type={result.inLibrary ? 'default' : 'primary'} disabled={result.inLibrary} loading={importingId === result.externalId} onClick={() => void importDouban(result)}>{result.inLibrary ? '已入库' : '同步入库'}</Button>
        </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={doubanSearching ? '正在搜索' : '输入名称搜索豆瓣'} />}
      </div>
    </Drawer>
  </div>
}
