import { Button, Typography } from 'antd'
import { CloseCircleOutlined, CloseOutlined, LinkOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'

export default function VideoOpeningPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const failed = params.get('status') === 'failed'
  const message = params.get('message') || '暂时无法获取网盘链接'

  return <main className={`video-opening-page${failed ? ' is-failed' : ''}`}>
    <section className="video-opening-content" aria-live="polite">
      <div className="video-opening-visual" aria-hidden="true">
        {failed ? <CloseCircleOutlined /> : <><span className="video-opening-ring" /><LinkOutlined /></>}
      </div>
      <Typography.Title level={3}>{failed ? '链接获取失败' : '正在获取网盘链接'}</Typography.Title>
      <Typography.Text type="secondary">{failed ? message : '解析完成后将自动跳转'}</Typography.Text>
      {failed && <Button icon={<CloseOutlined />} onClick={() => window.close()}>关闭页面</Button>}
    </section>
  </main>
}
