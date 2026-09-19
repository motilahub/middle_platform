import { Route } from 'react-router-dom'
import { registerBusinessModule } from '../registry'
import MediaDetailPage from './MediaDetailPage'
import MediaLibraryPage from './MediaLibraryPage'

registerBusinessModule({
  key: 'media-library',
  routes: [
    <Route key="media-library-detail" path="/media-library/:id" element={<MediaDetailPage />} />,
    <Route key="media-library" path="/media-library" element={<MediaLibraryPage />} />,
  ],
})
