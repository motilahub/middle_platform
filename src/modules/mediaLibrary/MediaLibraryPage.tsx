import { App, Empty, Input, Pagination, Segmented, Spin, Tag } from 'antd'
import { SearchOutlined, StarFilled } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import { mediaLibraryApi } from './api'
import MediaPoster from './MediaPoster'
import { MediaThemeProvider, MediaThemeToggle, useMediaTheme } from './MediaTheme'
import { episodeLabel } from './episode'
import type { MediaItem, MediaType } from './types'

const PAGE_SIZE = 20

export default function MediaLibraryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { message } = App.useApp()
  const { darkMode, setDarkMode } = useMediaTheme()
  const listRef = useRef<HTMLElement>(null)
  const type: MediaType = searchParams.get('type') === 'tv' ? 'tv' : 'movie'
  const query = searchParams.get('q') || ''
  const requestedPage = Number(searchParams.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState(query)

  useEffect(() => { setSearchText(query) }, [query])

  const updateFilters = (nextType: MediaType, nextQuery: string, nextPage = 1) => {
    const params = new URLSearchParams()
    if (nextType === 'tv') params.set('type', 'tv')
    if (nextQuery) params.set('q', nextQuery)
    if (nextPage > 1) params.set('page', String(nextPage))
    setSearchParams(params)
  }

  const load = useCallback(async (nextType: MediaType, nextQuery: string) => {
    setLoading(true)
    try {
      setItems(await mediaLibraryApi.list(nextType, nextQuery))
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => { void load(type, query) }, [load, query, type])
  const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / PAGE_SIZE)))
  const pageItems = useMemo(() => items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [items, currentPage])

  const changePage = (nextPage: number) => {
    updateFilters(type, query, nextPage)
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return <MediaThemeProvider darkMode={darkMode}><div className={`media-library-page${darkMode ? ' is-dark' : ''}`}>
    <SystemHeader actions={<MediaThemeToggle darkMode={darkMode} onChange={setDarkMode} />} />
    <main className="media-library-main">
      <div className="media-library-filters">
        <Segmented<MediaType> value={type} options={[{ label: '电影', value: 'movie' }, { label: '电视剧', value: 'tv' }]} onChange={(value) => updateFilters(value, query)} />
        <Input.Search allowClear value={searchText} prefix={<SearchOutlined />} placeholder="搜索影视名称" enterButton="搜索" onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) updateFilters(type, '') }} onSearch={(value) => updateFilters(type, value.trim())} />
      </div>
      {loading
        ? <div className="media-library-loading"><Spin size="large" /></div>
        : items.length
          ? <><section ref={listRef} className="media-library-grid" aria-label={type === 'movie' ? '电影榜单' : '电视剧榜单'}>
              {pageItems.map((item) => <button type="button" className="media-library-item" key={item.id} onClick={() => navigate(`/media-library/${item.id}`, { state: { libraryReturnTo: `${location.pathname}${location.search}` } })}>
                <div className="media-library-poster">
                  <MediaPoster item={item} />
                  {item.ranking && <b>#{item.ranking}</b>}
                </div>
                <div className="media-library-item-body">
                  <h2>{item.title}</h2>
                  <div className="media-library-meta">
                    <span><StarFilled /> {(item.rating || 0).toFixed(1)}</span>
                    {item.year && <span>{item.year}</span>}
                    {item.mediaType === 'tv' && episodeLabel(item) && <Tag bordered={false}>{episodeLabel(item)}</Tag>}
                  </div>
                </div>
              </button>)}
            </section>
            <Pagination className="media-library-pagination" current={currentPage} pageSize={PAGE_SIZE} total={items.length} showSizeChanger={false} hideOnSinglePage onChange={changePage} /></>
          : <Empty className="media-library-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? `未找到“${query}”` : '暂无影视数据'} />}
    </main>
    <SystemFooter />
  </div></MediaThemeProvider>
}
