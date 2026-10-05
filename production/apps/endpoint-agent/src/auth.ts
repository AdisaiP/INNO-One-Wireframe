import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'inno-one',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'inno-one-web',
});

let initPromise: Promise<boolean> | undefined;

export function initializeAuthentication() {
  initPromise ??= keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  });
  return initPromise;
}

export async function getAccessToken() {
  if (!keycloak.authenticated) {
    await keycloak.login();
    throw new Error('AUTH_REDIRECT');
  }
  await keycloak.updateToken(30);
  if (!keycloak.token) throw new Error('NO_ACCESS_TOKEN');
  return keycloak.token;
}

export async function logout() {
  await keycloak.logout({ redirectUri: window.location.origin });
}
