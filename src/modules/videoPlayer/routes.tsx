import { Route } from 'react-router-dom'
import { registerBusinessModule } from '../registry'
import VideoPlayerPage from './VideoPlayerPage'

registerBusinessModule({
  key: 'video-player',
  routes: [<Route key="video-player" path="/video-player" element={<VideoPlayerPage />} />],
})
