import { httpUrl } from './index.mjs';

function launchValue(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`solid-app-data/launch: ${name} must be a full URL.`);
  }
  try {
    return httpUrl(value);
  }
  catch (cause) {
    throw new Error(
      `solid-app-data/launch: ${name} must be an HTTP(S) URL without credentials.`,
      { cause }
    );
  }
}

function parameterLocation(value) {
  if (!['fragment', 'query'].includes(value)) {
    throw new Error('solid-app-data/launch: Unsupported parameter location.');
  }
  return value;
}

function launchParts(applicationUrl, location = 'fragment') {
  const url = new URL(applicationUrl);
  if (parameterLocation(location) === 'query') {
    return {
      url,
      prefix: null,
      query: url.search.slice(1),
      params: url.searchParams
    };
  }
  const fragment = url.hash.slice(1);
  const separator = fragment.indexOf('?');
  let prefix = null;
  let query = fragment;
  if (separator !== -1) {
    prefix = fragment.slice(0, separator);
    query = fragment.slice(separator + 1);
  }
  return { url, prefix, query, params: new URLSearchParams(query) };
}

export function parseLaunchUrl(
  applicationUrl,
  { parameterLocation: location = 'fragment' } = {}
) {
  const { url, prefix, query, params } = launchParts(applicationUrl, location);
  const context = { webId: '', resource: '' };
  const hasContext = params.has('webid') || params.has('resource');
  if (hasContext && /%(?![0-9a-f]{2})/i.test(query)) {
    throw new Error('solid-app-data/launch: Malformed launch URL encoding.');
  }
  for (const [key, property] of [
    ['webid', 'webId'],
    ['resource', 'resource']
  ]) {
    const values = params.getAll(key);
    if (values.length > 1) {
      throw new Error(`solid-app-data/launch: Duplicate ${key} parameter.`);
    }
    if (values.length) {
      context[property] = launchValue(values[0], key);
    }
  }
  if (prefix !== null) {
    url.hash = prefix;
  }
  return { context, url: url.href };
}

export function readLaunchContext(applicationUrl, options) {
  return parseLaunchUrl(applicationUrl, options).context;
}

function removeContext(params) {
  params.delete('webid');
  params.delete('resource');
}

function fragmentValue(prefix, params) {
  const query = params.toString();
  if (prefix !== null) {
    if (query) {
      return prefix + '?' + query;
    }
    return prefix;
  }
  return query;
}

export function launchUrl(
  applicationUrl,
  { webId = '', resource = '', parameterLocation: location = 'fragment' } = {}
) {
  const parts = launchParts(launchValue(applicationUrl, 'Application'), location);
  const { url } = parts;
  let { prefix, params } = parts;
  if (
    location === 'fragment' && prefix === null && url.hash &&
    !params.has('webid') && !params.has('resource')
  ) {
    prefix = url.hash.slice(1);
    params = new URLSearchParams();
  }
  if (webId !== '') {
    params.set('webid', launchValue(webId, 'WebID'));
  }
  else {
    params.delete('webid');
  }
  if (resource) {
    params.set('resource', launchValue(resource, 'Resource'));
  }
  else {
    params.delete('resource');
  }
  if (location === 'query') {
    url.search = params.toString();
    const fragment = launchParts(url.href);
    if (fragment.params.has('webid') || fragment.params.has('resource')) {
      removeContext(fragment.params);
      url.hash = fragmentValue(fragment.prefix, fragment.params);
    }
  }
  else {
    if (url.searchParams.has('webid') || url.searchParams.has('resource')) {
      removeContext(url.searchParams);
    }
    url.hash = fragmentValue(prefix, params);
  }
  return url.href;
}
