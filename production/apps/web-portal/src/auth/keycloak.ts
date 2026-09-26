import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'inno-one',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'inno-one-web',
});

let initPromise: Promise<boolean> | undefined;

export function initializeAuthentication(): Promise<boolean> {
  initPromise ??= keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  });
  return initPromise;
}

export async function getAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    await keycloak.login();
    throw new Error('Authentication redirect started');
  }

  try {
    await keycloak.updateToken(30);
  } catch {
    await keycloak.login();
    throw new Error('Token refresh failed');
  }

  if (!keycloak.token) {
    throw new Error('No access token available');
  }

  return keycloak.token;
}

export async function logout(): Promise<void> {
  await keycloak.logout({ redirectUri: window.location.origin });
}
