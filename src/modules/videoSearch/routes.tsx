import { Route } from 'react-router-dom'
import { registerBusinessModule } from '../registry'
import RouteGuard from '../../platform/identity/RouteGuard'
import VideoOpeningPage from './VideoOpeningPage'
import VideoSearchPage from './VideoSearchPage'

registerBusinessModule({
  key: 'video-search',
  routes: [
    <Route key="video-search-opening" path="/video-search/opening" element={<RouteGuard><VideoOpeningPage /></RouteGuard>} />,
    <Route key="video-search" path="/video-search" element={<RouteGuard><VideoSearchPage /></RouteGuard>} />,
  ],
})
