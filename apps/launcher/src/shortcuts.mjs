import {
  oldm, prefixes, valueAt, idOf, httpUrl
} from '@muze-labs/solid-app-data';
import {
  launchUrl, readLaunchContext
} from '@muze-labs/solid-app-data/launch.mjs';

export const locationPredicate = prefixes.apps + 'launchParameterLocation';
export const overridePredicate = locationPredicate + 'Override';
export const anonymousPredicate = prefixes.apps + 'anonymousLaunch';
const booleanType = 'http://www.w3.org/2001/XMLSchema#boolean';

function readAnonymous(subject) {
  let value = valueAt(subject, anonymousPredicate);
  if (value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error('launcher/shortcuts: Anonymous launch has multiple values.');
    }
    value = value[0];
  }
  if (typeof value === 'boolean' || value instanceof Boolean) {
    return value.valueOf();
  }
  if (
    value instanceof String && String(value.type) === booleanType &&
    !value.language && ['true', 'false', '1', '0'].includes(String(value))
  ) {
    return ['true', '1'].includes(String(value));
  }
  throw new Error('launcher/shortcuts: Anonymous launch must be a boolean.');
}

function readMode(subject, predicate) {
  let value = valueAt(subject, predicate);
  if (value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error('launcher/shortcuts: Launch mode has multiple values.');
    }
    value = value[0];
  }
  if (
    !(typeof value === 'string' || value instanceof String) ||
    value.language ||
    (value.type && String(value.type) !==
      'http://www.w3.org/2001/XMLSchema#string')
  ) {
    throw new Error('launcher/shortcuts: Launch mode must be a plain literal.');
  }
  const mode = String(value);
  if (!['fragment', 'query'].includes(mode)) {
    throw new Error('launcher/shortcuts: Unsupported launch mode.');
  }
  return mode;
}

export function shortcutLaunch(subject, webId) {
  const override = readMode(subject, overridePredicate);
  const anonymous = readAnonymous(subject);
  const location = override || readMode(subject, locationPredicate) || 'fragment';
  const url = httpUrl(idOf(valueAt(subject, prefixes.schema + 'url')));
  const fragment = readLaunchContext(url);
  const query = readLaunchContext(url, { parameterLocation: 'query' });
  if (fragment.resource && query.resource && fragment.resource !== query.resource) {
    throw new Error('launcher/shortcuts: The URL names two different resources.');
  }
  const resource = fragment.resource || query.resource;
  let href = url;
  if (anonymous || webId) {
    let launchWebId = webId;
    if (anonymous) {
      launchWebId = '';
    }
    href = launchUrl(url, {
      webId: launchWebId, resource, parameterLocation: location
    });
  }
  else if (resource || fragment.webId || query.webId) {
    href = null;
  }
  return { href, override, location, anonymous };
}

export function applyAnonymousLaunch(subject, anonymous) {
  if (!subject?.graph || typeof anonymous !== 'boolean') {
    throw new Error('launcher/shortcuts: Choose a boolean anonymous setting.');
  }
  readAnonymous(subject);
  if (anonymous) {
    subject.graph.set(subject.id, anonymousPredicate,
      oldm.literal('true', { type: booleanType }));
  }
  else {
    subject.graph.delete(subject.id, anonymousPredicate);
  }
  subject.graph.set(
    subject.id, prefixes.dcterms + 'modified', new Date().toISOString()
  );
}

export function applyLaunchOverride(subject, mode) {
  if (!subject?.graph) {
    throw new Error('launcher/shortcuts: Application description not found.');
  }
  if (!['', 'fragment', 'query'].includes(mode)) {
    throw new Error('launcher/shortcuts: Choose a supported launch mode.');
  }
  // Do not overwrite unsupported structured or multiple user settings.
  readMode(subject, overridePredicate);
  if (mode) {
    subject.graph.set(subject.id, overridePredicate, oldm.literal(mode));
  }
  else {
    subject.graph.delete(subject.id, overridePredicate);
  }
  subject.graph.set(
    subject.id, prefixes.dcterms + 'modified', new Date().toISOString()
  );
}
