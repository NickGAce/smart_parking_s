import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { AppProviders } from './app/providers/app-providers';
import { LoadingFallback } from './app/router/loading-fallback';
import { appRouter } from './app/router/app-router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={appRouter} fallbackElement={<LoadingFallback />} />
    </AppProviders>
  </StrictMode>,
);
