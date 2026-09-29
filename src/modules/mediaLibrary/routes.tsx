import { Route } from 'react-router-dom'
import { registerBusinessModule } from '../registry'
import RouteGuard from '../../platform/identity/RouteGuard'
import MediaDetailPage from './MediaDetailPage'
import MediaLibraryPage from './MediaLibraryPage'

registerBusinessModule({
  key: 'media-library',
  routes: [
    <Route key="media-library-detail" path="/media-library/:id" element={<RouteGuard><MediaDetailPage /></RouteGuard>} />,
    <Route key="media-library" path="/media-library" element={<RouteGuard><MediaLibraryPage /></RouteGuard>} />,
  ],
})
