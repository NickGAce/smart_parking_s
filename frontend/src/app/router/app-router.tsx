import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '../layouts/app-layout';
import { HomePage } from '../../pages/home-page';
import { NotFoundPage } from '../../pages/not-found-page';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
]);
