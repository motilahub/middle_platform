import { Spin } from 'antd'
import { Navigate, Route, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth'
import { registerBusinessModule } from '../registry'
import VideoOpeningPage from './VideoOpeningPage'
import VideoSearchPage from './VideoSearchPage'

function RequireLogin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

registerBusinessModule({
  key: 'video-search',
  routes: [
    <Route key="video-search-opening" path="/video-search/opening" element={<VideoOpeningPage />} />,
    <Route key="video-search" path="/video-search" element={<RequireLogin><VideoSearchPage /></RequireLogin>} />,
  ],
})
