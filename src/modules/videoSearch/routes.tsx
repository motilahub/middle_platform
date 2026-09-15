import { Route } from 'react-router-dom'
import { registerBusinessModule } from '../registry'
import VideoOpeningPage from './VideoOpeningPage'
import VideoSearchPage from './VideoSearchPage'

registerBusinessModule({
  key: 'video-search',
  routes: [
    <Route key="video-search-opening" path="/video-search/opening" element={<VideoOpeningPage />} />,
    <Route key="video-search" path="/video-search" element={<VideoSearchPage />} />,
  ],
})
