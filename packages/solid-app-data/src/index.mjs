import oldm from './oldm.mjs';
import { oidcStore } from '@muze-nl/metro-oidc';
import { client as metroClient } from '@muze-nl/metro-core';
import { isExpired } from '@muze-nl/metro-oauth2/oauth2';
import {
  authorizationTransport,
  refreshAuthorizationUrl
} from './authorization.mjs';
import { tokenStore } from '@muze-nl/metro-oauth2/tokenstore';
import { solidApi } from '@muze-labs/metro-solid';
import { createSolidMetroClient, authorizePopup } from '@muze-labs/jsfs-solid';
export { oldm };
export { SolidAdapter, createSolidMetroClient } from '@muze-labs/jsfs-solid';
export const prefixes = {
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  schema: 'https://schema.org/',
  dcterms: 'http://purl.org/dc/terms/',
  pim: 'http://www.w3.org/ns/pim/space#',
  lm: 'https://purl.org/pdsinterop/link-metadata#',
  apps: 'https://vocab.muze.nl/solid-apps#'
};
export const many = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export const valueAt = (subject, iri) =>
  subject?.[subject.graph?.propertyName(iri) ?? iri];
export const idOf = (value) => value?.id ?? String(value ?? '');
export function httpUrl(input, base) {
  const url = new URL(input, base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'solid-app-data: Use an HTTP or HTTPS URL without credentials.'
    );
  }
  return url.href;
}
export function documentUrl(input) {
  const url = new URL(httpUrl(input));
  url.hash = '';
  return url.href;
}
export function requireOk(response) {
  if (response.status < 200 || response.status >= 300) {
    const error = new Error(
      response.status === 412
        ? 'This resource changed elsewhere. Reload before saving.'
        : `Request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }
  return response;
}
export async function loadDocument(client, url, { allowMissing = false } = {}) {
  url = documentUrl(url);
  const response = await client.get(url, {
    headers: { Accept: 'text/turtle' }
  });
  if (allowMissing && response.status === 404) {
    return {
      url,
      missing: true,
      etag: null,
      graph: oldm.context({ prefixes }).parse('', url, 'text/turtle')
    };
  }
  requireOk(response);
  return {
    url,
    missing: false,
    etag: response.headers.get('ETag'),
    graph: oldm
      .context({ prefixes })
      .parse(await response.text(), url, 'text/turtle')
  };
}
export async function copyDocument(document) {
  return {
    ...document,
    graph: oldm
      .context({ prefixes })
      .parse(await document.graph.write(), document.url, 'text/turtle')
  };
}
export async function saveDocument(client, document) {
  if (!document.missing && !document.etag) {
    throw new Error(
      'solid-app-data: This server supplied no ETag. Safe editing requires a conditional write.'
    );
  }
  const response = requireOk(
    await client.put(document.url, {
      body: await document.graph.write(),
      headers: {
        'Content-Type': 'text/turtle',
        [document.missing ? 'If-None-Match' : 'If-Match']: document.missing
          ? '*'
          : document.etag
      }
    })
  );
  return { ...document, missing: false, etag: response.headers.get('ETag') };
}
export async function connectSession(
  webId,
  popup,
  {
    interactive = true,
    onAuthenticationRequired,
    onAuthenticationRestored = () => {}
  } = {}
) {
  webId = httpUrl(webId);
  const discovery = solidApi(webId);
  const profile = await discovery.discoverWebId(webId);
  let authPopup = popup;
  let active = true;
  let operations = 0;
  let interactiveOperations = 0;
  const recoveryEnabled = typeof onAuthenticationRequired === 'function';
  let pendingAuthorization = null;
  let cancellationGeneration = 0;
  const base = profile.storage[0] || documentUrl(webId);
  const account = profile.issuer + '|' + webId;
  const oauth = tokenStore(account);
  function signInRequired() {
    const error = new Error(
      'solid-app-data: Sign in again to continue. Your edits are retained.'
    );
    error.code = 'sign_in_required';
    return error;
  }
  function requireActive() {
    if (!active) {
      throw new Error(
        'solid-app-data: This Solid session has been logged out.'
      );
    }
  }
  const options = {
    client: authorizationTransport(profile.issuer, oauth.tokens, base),
    configureMetro: true,
    issuer: profile.issuer,
    webid: webId,
    oidc: Boolean(profile.issuer),
    oldm: false,
    forceAuthorizationForWrites: true,
    client_info: {
      client_name: 'Muze Solid Apps',
      redirect_uris: [new URL('../redirect.html', location.href).href]
    },
    authorize_callback: async (url) => {
      requireActive();
      if (interactiveOperations === 0 && (operations > 0 || !interactive)) {
        onAuthenticationRequired?.({ pending: false });
        throw signInRequired();
      }
      if ((!authPopup || authPopup.closed) && recoveryEnabled) {
        authPopup = await new Promise((resolve, reject) => {
          pendingAuthorization = { resolve, reject };
          onAuthenticationRequired({ pending: true });
        });
        pendingAuthorization = null;
        requireActive();
      }
      if (!authPopup || authPopup.closed) {
        authPopup = window.open('', '_blank', 'popup,width=520,height=720');
      }
      if (!authPopup || authPopup.closed) {
        throw new Error(
          'solid-app-data: Sign-in popup was blocked. Allow popups and retry.'
        );
      }
      const authorizationWindow = authPopup;
      try {
        return await authorizePopup(
          refreshAuthorizationUrl(url, profile.issuer),
          { popup: authorizationWindow }
        );
      }
      finally {
        authorizationWindow.close();
        if (authPopup === authorizationWindow) {
          authPopup = null;
        }
      }
    }
  };
  function cancellationError() {
    const error = new Error(
      'solid-app-data: Sign-in cancelled. Your edits are retained.'
    );
    error.code = 'cancelled';
    return error;
  }
  function sessionClient(forceAuthorization = false) {
    return metroClient(base).with(async (request) => {
      const generation = cancellationGeneration;
      function requireCurrentAttempt() {
        requireActive();
        if (generation !== cancellationGeneration) {
          throw cancellationError();
        }
      }
      // Metro's authorization callback has no request cancellation context.
      // Scope this transport gate to the original request. A late token response
      // cannot dispatch its write after cancellation, or cancel a later retry.
      const transport = options.client.with(async (outgoing, next) => {
        requireCurrentAttempt();
        const response = await next(outgoing);
        const metadata = oidcStore(profile.issuer).get('openid_configuration');
        if (outgoing.url === metadata?.token_endpoint) {
          requireCurrentAttempt();
        }
        return response;
      });
      const authorized = createSolidMetroClient(base, {
        ...options,
        client: transport,
        force_authorization: forceAuthorization
      });
      return recoverRequest(request, (retry) => authorized.fetch(retry));
    });
  }
  const client = sessionClient();
  async function recoverRequest(request, next) {
    requireActive();
    const retry = request.clone();
    try {
      const response = await next(request);
      if (response.ok && session.hasUsableAccessToken) {
        onAuthenticationRestored();
      }
      return response;
    }
    catch (error) {
      if (!['refresh_rejected', 'authorization_changed'].includes(error.code)) {
        throw error;
      }
      // The refresh failed before the authorized resource request was sent.
      // Retry this request once, preserving its body and conditional headers.
      requireActive();
      return next(retry);
    }
  }
  const session = {
    webId,
    profile: profile.profile,
    storage: profile.storage,
    issuer: profile.issuer,
    client,
    solid: solidApi(client),
    preferencesUrl: idOf(
      many(valueAt(profile.profile, prefixes.pim + 'preferencesFile'))[0]
    ),
    get hasUsableAccessToken() {
      const token = oauth.tokens.get('access_token');
      return Boolean(token && !isExpired(token));
    },
    useSharedAuthorization() {
      if (!session.hasUsableAccessToken || !pendingAuthorization) {
        return false;
      }
      const error = new Error(
        'solid-app-data: Authorization renewed elsewhere.'
      );
      error.code = 'authorization_changed';
      pendingAuthorization.reject(error);
      pendingAuthorization = null;
      return true;
    },
    cancelSignIn() {
      cancellationGeneration += 1;
      pendingAuthorization?.reject(cancellationError());
      pendingAuthorization = null;
      authPopup?.close();
      authPopup = null;
    },
    async signIn(popup) {
      requireActive();
      authPopup = popup;
      pendingAuthorization?.resolve(popup);
      // A forced authorized GET validates renewal even for a public profile.
      // It does not reload app state or replay any application operation.
      return session.perform(async () => {
        const probe = sessionClient(true);
        requireOk(await probe.get(documentUrl(webId)));
      });
    },
    logout() {
      session.cancelSignIn();
      active = false;
      authPopup?.close();
      authPopup = null;
      if (!profile.issuer) {
        return;
      }
      // Match Metro-OIDC's issuer + WebID account scope. Use the libraries'
      // public stores rather than depending on their localStorage key layout.
      const account = profile.issuer + '|' + webId;
      const oauth = tokenStore(account);
      for (const name of [
        'access_token',
        'refresh_token',
        'authorization_code',
        'code_verifier'
      ]) {
        oauth.tokens.delete(name);
      }
      oauth.state.delete();
      const identity = oidcStore(account);
      // The OIDC store exposes get/set/has; null clears the cached values.
      for (const name of ['id_token', 'id_token_claims', 'pending_nonce']) {
        identity.set(name, null);
      }
    },
    async perform(operation, { interactive = true } = {}) {
      requireActive();
      operations += 1;
      if (interactive) {
        interactiveOperations += 1;
      }
      try {
        return await operation();
      }
      finally {
        operations -= 1;
        if (interactive) {
          interactiveOperations -= 1;
        }
        if (operations === 0) {
          authPopup?.close();
          authPopup = null;
        }
      }
    }
  };
  return session;
}
