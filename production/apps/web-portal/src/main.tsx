import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@inno/ui/styles.css';
import './shell.css';
import { AppRoot } from './app/AppRoot';
import { initializeAuthentication } from './auth/keycloak';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

root.render(
  <div className="boot-screen" role="status">
    <span className="production-spinner" aria-hidden="true" />
    <span>Connecting to organization sign-in…</span>
  </div>,
);

initializeAuthentication()
  .then((authenticated) => {
    if (!authenticated) {
      throw new Error('Organization sign-in was not completed.');
    }

    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRoot />
          </BrowserRouter>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unable to initialize organization sign-in.';
    root.render(
      <div className="boot-screen boot-error">
        <div className="auth-error-card">
          <b>Unable to connect to organization sign-in</b>
          <span>{message}</span>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>,
    );
  });
