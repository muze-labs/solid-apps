import oldm from './oldm.mjs';
import { oidcStore } from '@muze-nl/metro-oidc';
import { tokenStore } from '@muze-nl/metro-oauth2/tokenstore';
import { solidApi } from '@muze-labs/metro-solid';
import {
  createSolidMetroClient,
  authorizePopup,
  oidcIdToken
} from '@muze-labs/jsfs-solid';
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
  { interactive = true } = {}
) {
  webId = httpUrl(webId);
  const discovery = solidApi(webId);
  const profile = await discovery.discoverWebId(webId);
  let authPopup = popup;
  let active = true;
  let interactiveAllowed = interactive;
  function requireActive() {
    if (!active) {
      throw new Error(
        'solid-app-data: This Solid session has been logged out.'
      );
    }
  }
  const options = {
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
      if (!interactiveAllowed) {
        throw new Error(
          'solid-app-data: Sign-in required. Click Connect Solid to continue.'
        );
      }
      // A cached ID token does not guarantee resource authorization. Own the
      // popup opened here too, rather than letting the helper lose its handle.
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
        return await authorizePopup(url, { popup: authorizationWindow });
      }
      finally {
        authorizationWindow.close();
        if (authPopup === authorizationWindow) {
          authPopup = null;
        }
      }
    }
  };
  const client = createSolidMetroClient(
    profile.storage[0] || documentUrl(webId),
    options
  ).with((request, next) => {
    requireActive();
    return next(request);
  });
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
    logout() {
      active = false;
      interactiveAllowed = false;
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
      const previousInteractive = interactiveAllowed;
      interactiveAllowed = interactive;
      try {
        if (
          interactive &&
          profile.issuer &&
          !oidcIdToken({ issuer: profile.issuer, webid: webId }) &&
          (!authPopup || authPopup.closed)
        ) {
          authPopup = window.open(
            '',
            'solid-apps-auth',
            'popup,width=520,height=720'
          );
        }
        return await operation();
      }
      finally {
        authPopup?.close();
        authPopup = null;
        interactiveAllowed = previousInteractive;
      }
    }
  };
  return session;
}
