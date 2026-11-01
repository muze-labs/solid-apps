import {
  oldm,
  idOf,
  prefixes,
  valueAt,
  loadDocument,
  copyDocument,
  saveDocument,
  httpUrl
} from '@muze-labs/solid-app-data';
export const defaults = Object.freeze({
  theme: 'system',
  textScale: '100',
  density: 'comfortable',
  language: 'en',
  launchTarget: 'tab',
  contactsResource: '',
  launcherResource: '',
  filesRoot: ''
});
const namespace = prefixes.apps;
function readLaunchTarget(subject) {
  let value = valueAt(subject, namespace + 'launchTarget');
  if (value === undefined) {
    return defaults.launchTarget;
  }
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error('solid-preferences: App launch target has multiple values.');
    }
    value = value[0];
  }
  if (
    !(typeof value === 'string' || value instanceof String) ||
    value.language ||
    (value.type && String(value.type) !==
      'http://www.w3.org/2001/XMLSchema#string') ||
    !['tab', 'window'].includes(String(value))
  ) {
    throw new Error('solid-preferences: Unsupported app launch target.');
  }
  return String(value);
}
export function readPreferences(document) {
  const subject = document.graph.get(document.url + '#solid-apps');
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      key === 'launchTarget'
        ? readLaunchTarget(subject)
        : idOf(valueAt(subject, namespace + key) ?? fallback)
    ])
  );
}
export function validatePreferences(settings) {
  if (!['tab', 'window'].includes(settings.launchTarget)) {
    throw new Error('solid-preferences: Choose new tabs or new windows.');
  }
  if (!['system', 'light', 'dark'].includes(settings.theme)) {
    throw new Error('solid-preferences: Choose a supported theme.');
  }
  if (!['90', '100', '110', '120'].includes(settings.textScale)) {
    throw new Error('solid-preferences: Choose a supported text size.');
  }
  if (!['comfortable', 'compact'].includes(settings.density)) {
    throw new Error('solid-preferences: Choose a supported density.');
  }
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(settings.language)) {
    throw new Error('solid-preferences: Use a language tag such as en or nl.');
  }
  for (const key of ['contactsResource', 'launcherResource', 'filesRoot']) {
    if (!settings[key]) {
      continue;
    }
    const url = new URL(httpUrl(settings[key]));
    if (url.hash) {
      throw new Error(
        'solid-preferences: Storage locations cannot contain a fragment.'
      );
    }
    if (key === 'filesRoot' && !url.pathname.endsWith('/')) {
      throw new Error('solid-preferences: The files root must end with /.');
    }
  }
  return settings;
}
export async function loadPreferences(session) {
  if (!session.preferencesUrl) {
    throw new Error(
      'solid-preferences: Your profile does not link to a preferences file (pim:preferencesFile).'
    );
  }
  const document = await loadDocument(session.client, session.preferencesUrl, {
    allowMissing: true
  });
  return { document, settings: readPreferences(document) };
}
export async function savePreferences(session, document, settings) {
  validatePreferences(settings);
  readLaunchTarget(document.graph.get(document.url + '#solid-apps'));
  const draft = await copyDocument(document);
  const id = draft.url + '#solid-apps';
  const node =
    draft.graph.get(id) ||
    draft.graph.set(id, namespace + 'theme', settings.theme);
  for (const key of Object.keys(defaults)) {
    const property = draft.graph.propertyName(namespace + key);
    if (settings[key]) {
      draft.graph.set(
        id,
        namespace + key,
        ['contactsResource', 'launcherResource', 'filesRoot'].includes(key)
          ? draft.graph.addNamedNode(settings[key])
          : oldm.literal(String(settings[key]))
      );
    }
    else {
      delete node[property];
    }
  }
  const saved = await saveDocument(session.client, draft);
  return { document: saved, settings: readPreferences(saved) };
}
export function applyPreferences(settings, root = document.documentElement) {
  root.lang = settings.language;
  root.style.fontSize = settings.textScale + '%';
  root.dataset.density = settings.density;
  const body = root.ownerDocument.body;
  body.classList.remove('ds-darkmode-auto', 'ds-lightmode', 'ds-darkmode');
  body.classList.add(
    settings.theme === 'system'
      ? 'ds-darkmode-auto'
      : settings.theme === 'dark'
        ? 'ds-darkmode'
        : 'ds-lightmode'
  );
}
