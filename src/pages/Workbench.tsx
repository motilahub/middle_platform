import { Empty, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { DashboardApp } from '../types'

export default function Workbench() {
  const [apps, setApps] = useState<DashboardApp[] | null>(null)
  useEffect(() => { api.visibleApps().then(setApps) }, [])
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
  return <div className="workbench"><section className="app-grid">
    {apps === null ? <Spin size="large" /> : apps.length ? apps.map((app) => <button className="app-tile" key={app.id} onClick={() => open(app.url)}><div className="app-icon">{app.imgThumbnail || app.img ? <img src={app.imgThumbnail || app.img} alt="" /> : <span>{app.name.slice(0, 1)}</span>}</div><div className="app-name">{app.name}</div></button>) : <Empty description="暂无可访问应用" />}
  </section></div>
}
