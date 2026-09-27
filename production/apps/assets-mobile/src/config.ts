export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://172.10.1.58:5080/api/v1',
  keycloakUrl: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://172.10.1.58:8080',
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'inno-one',
  keycloakClientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'inno-one-assets-mobile',
};

export const discovery = {
  authorizationEndpoint:
    config.keycloakUrl + '/realms/' + config.keycloakRealm + '/protocol/openid-connect/auth',
  tokenEndpoint:
    config.keycloakUrl + '/realms/' + config.keycloakRealm + '/protocol/openid-connect/token',
  revocationEndpoint:
    config.keycloakUrl + '/realms/' + config.keycloakRealm + '/protocol/openid-connect/revoke',
  endSessionEndpoint:
    config.keycloakUrl + '/realms/' + config.keycloakRealm + '/protocol/openid-connect/logout',
};
