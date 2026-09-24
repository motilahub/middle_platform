import { App, Button, Divider, Empty, Input, Pagination, Select, Spin, Tag } from 'antd'
import { DownOutlined, SearchOutlined, StarFilled, UpOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import { mediaLibraryApi } from './api'
import MediaPoster from './MediaPoster'
import { MediaThemeProvider, MediaThemeToggle, useMediaTheme } from './MediaTheme'
import { episodeLabel } from './episode'
import type { MediaCatalogFilters, MediaCatalogType, MediaItem } from './types'

const PAGE_SIZE = 20

function csv(value: string | null) {
  return [...new Set((value || '').split(',').map((item) => item.trim()).filter(Boolean))]
}

export default function MediaLibraryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { message } = App.useApp()
  const { darkMode, setDarkMode } = useMediaTheme()
  const listRef = useRef<HTMLElement>(null)
  const type = (['movie', 'tv', 'anime'].includes(searchParams.get('type') || '') ? searchParams.get('type') : 'all') as MediaCatalogType
  const query = searchParams.get('q') || ''
  const genresParam = searchParams.get('genres') || ''
  const countriesParam = searchParams.get('countries') || ''
  const genres = useMemo(() => csv(genresParam), [genresParam])
  const countries = useMemo(() => csv(countriesParam), [countriesParam])
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined
  const sort = searchParams.get('sort') === 'newest' ? 'newest' : 'default'
  const requestedPage = Number(searchParams.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState(query)
  const [catalogFilters, setCatalogFilters] = useState<MediaCatalogFilters>({ genres: [], countries: [], years: [] })
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftGenres, setDraftGenres] = useState(genres)
  const [draftCountries, setDraftCountries] = useState(countries)
  const [draftYear, setDraftYear] = useState<number | undefined>(year)

  useEffect(() => { setSearchText(query) }, [query])
  useEffect(() => { setDraftGenres(genres); setDraftCountries(countries); setDraftYear(year) }, [searchParams.toString()])
  useEffect(() => { void mediaLibraryApi.catalogFilters().then(setCatalogFilters).catch((error) => message.error((error as Error).message)) }, [message])

  const updateFilters = useCallback((changes: Record<string, string | undefined>, resetPage = true) => {
    const params = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    if (resetPage) params.delete('page')
    setSearchParams(params)
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await mediaLibraryApi.catalog({ type, q: query, genres, countries, year, sort, page, pageSize: PAGE_SIZE })
      setItems(response.items)
      setTotal(response.total)
    } catch (error) { message.error((error as Error).message) } finally { setLoading(false) }
  }, [countries, genres, message, page, query, sort, type, year])

  useEffect(() => { void load() }, [load])
  const activeFilterCount = genres.length + countries.length + (year ? 1 : 0)
  const applyDraftFilters = () => updateFilters({ genres: draftGenres.join(',') || undefined, countries: draftCountries.join(',') || undefined, year: draftYear ? String(draftYear) : undefined })
  const resetDraftFilters = () => { setDraftGenres([]); setDraftCountries([]); setDraftYear(undefined) }
  const toggleDraftValue = (values: string[], value: string, setValues: (next: string[]) => void) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  const filterButtons = (values: string[], selected: string[], setValues: (next: string[]) => void) => <div className="media-catalog-filter-buttons">{values.map((value) => <Button key={value} size="small" type={selected.includes(value) ? 'primary' : 'default'} aria-pressed={selected.includes(value)} onClick={() => toggleDraftValue(selected, value, setValues)}>{value}</Button>)}</div>
  const filterMenu = <div className="media-catalog-filter-menu">
    <div className="media-catalog-filter-section"><strong>地区</strong>{filterButtons(catalogFilters.countries, draftCountries, setDraftCountries)}</div>
    <Divider />
    <div className="media-catalog-filter-section"><strong>类型</strong>{filterButtons(catalogFilters.genres, draftGenres, setDraftGenres)}</div>
    <Divider />
    <div className="media-catalog-filter-section"><strong>年份</strong><Select allowClear value={draftYear} placeholder="全部年份" options={catalogFilters.years.map((value) => ({ label: `${value} 年`, value }))} onChange={setDraftYear} /></div>
    <div className="media-catalog-filter-actions"><Button onClick={resetDraftFilters}>重置</Button><Button type="primary" onClick={applyDraftFilters}>确定</Button></div>
  </div>

  return <MediaThemeProvider darkMode={darkMode}><div className={`media-library-page${darkMode ? ' is-dark' : ''}`}>
    <SystemHeader actions={<MediaThemeToggle darkMode={darkMode} onChange={setDarkMode} />} />
    <main className="media-library-main">
      <div className="media-catalog-search"><Input.Search allowClear size="large" value={searchText} prefix={<SearchOutlined />} placeholder="搜索电影、电视剧、动漫名称" enterButton="搜索" onChange={(event) => setSearchText(event.target.value)} onSearch={(value) => updateFilters({ q: value.trim() })} /></div>
      <div className="media-catalog-toolbar">
        <div className="media-catalog-tabs" role="tablist">
          {[['all', '全部'], ['movie', '电影'], ['tv', '电视剧'], ['anime', '动漫']].map(([value, label]) => <Tag.CheckableTag key={value} checked={sort !== 'newest' && type === value} onChange={() => updateFilters({ type: value === 'all' ? undefined : value, sort: undefined })}>{label}</Tag.CheckableTag>)}
          <Tag.CheckableTag checked={sort === 'newest'} onChange={() => updateFilters({ sort: sort === 'newest' ? undefined : 'newest' })}>最近上新</Tag.CheckableTag>
        </div>
        <Button onClick={() => setFilterOpen((open) => !open)}>筛选{activeFilterCount ? `（${activeFilterCount}）` : ''} {filterOpen ? <UpOutlined /> : <DownOutlined />}</Button>
      </div>
      {filterOpen && filterMenu}
      {loading ? <div className="media-library-loading"><Spin size="large" /></div> : items.length ? <><section ref={listRef} className="media-library-grid" aria-label="影视搜索结果">
        {items.map((item) => <button type="button" className="media-library-item" key={item.id} onClick={() => navigate(`/media-library/${item.publicId}`, { state: { libraryReturnTo: `${location.pathname}${location.search}` } })}>
          <div className="media-library-poster"><MediaPoster item={item} />{item.ranking && sort !== 'newest' && <b>#{item.ranking}</b>}</div>
          <div className="media-library-item-body"><h2>{item.title}</h2><div className="media-library-meta"><span><StarFilled /> {(item.rating || 0).toFixed(1)}</span>{item.year && <span>{item.year}</span>}{item.contentCategory === 'anime' ? <Tag bordered={false}>动漫</Tag> : <Tag bordered={false}>{item.mediaType === 'movie' ? '电影' : '电视剧'}</Tag>}{item.mediaType === 'tv' && episodeLabel(item) && <Tag bordered={false}>{episodeLabel(item)}</Tag>}</div></div>
        </button>)}
      </section><Pagination className="media-library-pagination" current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} hideOnSinglePage onChange={(nextPage) => { updateFilters({ page: String(nextPage) }, false); requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }} /></> : <Empty className="media-library-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? `未找到“${query}”` : '暂无影视数据'} />}
    </main>
    <SystemFooter />
  </div></MediaThemeProvider>
}
