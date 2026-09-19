import { App, Empty, Input, Segmented, Spin, Tag } from 'antd'
import { SearchOutlined, StarFilled } from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import { mediaLibraryApi } from './api'
import MediaPoster from './MediaPoster'
import { MediaThemeProvider, MediaThemeToggle, useMediaTheme } from './MediaTheme'
import { episodeLabel } from './episode'
import type { MediaItem, MediaType } from './types'

export default function MediaLibraryPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { darkMode, setDarkMode } = useMediaTheme()
  const [type, setType] = useState<MediaType>('movie')
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')

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

  return <MediaThemeProvider darkMode={darkMode}><div className={`media-library-page${darkMode ? ' is-dark' : ''}`}>
    <SystemHeader actions={<MediaThemeToggle darkMode={darkMode} onChange={setDarkMode} />} />
    <main className="media-library-main">
      <div className="media-library-filters">
        <Segmented<MediaType> value={type} options={[{ label: '电影', value: 'movie' }, { label: '电视剧', value: 'tv' }]} onChange={setType} />
        <Input.Search allowClear value={searchText} prefix={<SearchOutlined />} placeholder="搜索影视名称" enterButton="搜索" onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) setQuery('') }} onSearch={(value) => setQuery(value.trim())} />
      </div>
      {loading
        ? <div className="media-library-loading"><Spin size="large" /></div>
        : items.length
          ? <section className="media-library-grid" aria-label={type === 'movie' ? '电影榜单' : '电视剧榜单'}>
            {items.map((item) => <button type="button" className="media-library-item" key={item.id} onClick={() => navigate(`/media-library/${item.id}`)}>
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
          : <Empty className="media-library-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? `未找到“${query}”` : '暂无影视数据'} />}
    </main>
    <SystemFooter />
  </div></MediaThemeProvider>
}
