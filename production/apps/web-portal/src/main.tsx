import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider, detectBrowserLocale, translate } from '@inno/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@inno/ui/styles.css';
import './shell.css';
import { AppRoot } from './app/AppRoot';
import { applyProductDocumentBrand } from './app/branding';
import { initializeAuthentication } from './auth/keycloak';

applyProductDocumentBrand();

const bootstrapLocale = detectBrowserLocale();
document.documentElement.lang = bootstrapLocale === 'th-TH' ? 'th' : 'en';

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
  <I18nProvider locale={bootstrapLocale}>
    <div className="boot-screen" role="status">
      <span className="production-spinner" aria-hidden="true" />
      <span>{translate(bootstrapLocale, 'feedback.auth.connecting')}</span>
    </div>
  </I18nProvider>,
);

initializeAuthentication()
  .then((authenticated) => {
    if (!authenticated) {
      throw new Error(translate(bootstrapLocale, 'feedback.auth.notCompleted'));
    }

    root.render(
      <React.StrictMode>
        <I18nProvider locale={bootstrapLocale}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AppRoot />
            </BrowserRouter>
          </QueryClientProvider>
        </I18nProvider>
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    const message = error instanceof Error
      ? error.message
      : translate(bootstrapLocale, 'feedback.auth.initializeFailed');
    root.render(
      <I18nProvider locale={bootstrapLocale}>
        <div className="boot-screen boot-error">
          <div className="auth-error-card">
            <b>{translate(bootstrapLocale, 'feedback.auth.unableConnect')}</b>
            <span>{message}</span>
            <button type="button" onClick={() => window.location.reload()}>
              {translate(bootstrapLocale, 'common.actions.retry')}
            </button>
          </div>
        </div>
      </I18nProvider>,
    );
  });
