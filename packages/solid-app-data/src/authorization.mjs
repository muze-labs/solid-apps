import { client } from '@muze-nl/metro-core';
import { oidcStore } from '@muze-nl/metro-oidc';

// Metro 0.9.x does not expose structured token-endpoint errors. Classify only
// invalid_grant on a refresh request; network errors and access denial pass on.
export function authorizationTransport(issuer, tokens, base) {
  return client(base).with(async (request, next) => {
    const metadata = oidcStore(issuer).get('openid_configuration');
    if (request.method !== 'POST' || request.url !== metadata?.token_endpoint) {
      return next(request);
    }
    const form = new URLSearchParams(await request.clone().text());
    const response = await next(request);
    if (form.get('grant_type') !== 'refresh_token' || response.status !== 400) {
      return response;
    }
    let problem;
    try {
      problem = await response.clone().json();
    }
    catch {
      return response;
    }
    if (problem?.error !== 'invalid_grant') {
      return response;
    }
    const current = tokens.get('refresh_token');
    const value = typeof current === 'object' ? current?.value : current;
    if (value === form.get('refresh_token')) {
      tokens.delete('refresh_token');
      tokens.delete('access_token');
    }
    const error = new Error('solid-app-data: Refresh authorization expired.');
    error.code = 'refresh_rejected';
    throw error;
  });
}

// The OIDC public scope option is fixed before lazy discovery. Decorate only
// the authorization request, after Metro has discovered provider capabilities.
export function refreshAuthorizationUrl(input, issuer) {
  const url = new URL(input);
  const metadata = oidcStore(issuer).get('openid_configuration');
  if (metadata?.scopes_supported?.includes('offline_access')) {
    const scopes = new Set((url.searchParams.get('scope') || '').split(' '));
    scopes.add('offline_access');
    url.searchParams.set('scope', [...scopes].join(' ').trim());
    url.searchParams.set('prompt', 'consent');
  }
  return url;
}
