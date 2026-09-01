import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppRoutes from './app/routes'

export default function App() {
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}><AntApp><AppRoutes /></AntApp></ConfigProvider>
}
