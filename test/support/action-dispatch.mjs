import assert from 'node:assert/strict';

export async function checkCurrentActions(page) {
  const result = await page.evaluate(async () => {
    const route = location.pathname.split('/').filter(Boolean).at(-1);
    const name = route === 'workbench' ? 'launcher' : route;
    const owner =
      globalThis['muzeSolid' + name[0].toUpperCase() + name.slice(1) + 'App'];
    const host = owner.runtime.host;
    function check(condition, message) {
      if (!condition) {
        throw new Error('action-dispatch-test: ' + name + ': ' + message);
      }
    }
    const previousMessage = host.view.data.message;
    const message = host.message;
    const originalMessage =
      host.view.components.sessionServices.actions.message;
    try {
      host.view.actions.message = function (text, extra) {
        check(this === host.view, 'host action context');
        return [text, extra];
      };
      check(
        JSON.stringify(message('changed', 7)) === '["changed",7]',
        'existing host method forwards arguments and return value'
      );
    }
    finally {
      host.view.actions.message = originalMessage;
    }
    message(previousMessage);
    check(
      host.view.data.message === previousMessage,
      'original host action restored'
    );

    const preferences = host.view.runtime.preferences;
    const view = preferences.app;
    const originalShow = view.components.preferencesForm.actions.show;
    const loaded = view.runtime.loaded;
    const originalShowDefinition =
      view.definition.components.preferencesForm.actions.show;
    const previousLanguage = view.data.language;
    view.data.language = 'nl';
    try {
      view.actions.show = function () {
        check(this === view, 'Preferences action context');
        return this.data.language;
      };
      check(
        preferences.show() === 'nl',
        'existing Preferences widget follows override'
      );
      check(view.runtime.loaded === loaded, 'Preferences baseline retained');
      check(
        view.definition.components.preferencesForm.actions.show ===
          originalShowDefinition,
        'component original remains inspectable'
      );
    }
    finally {
      view.actions.show = originalShow;
    }
    preferences.show();
    check(view.container.open, 'original Preferences opening restored');
    check(view.data.language === 'nl', 'unsaved form choice retained');
    await view.actions.muzeSolidDesignCloseDialog(view.container);
    view.data.language = previousLanguage;

    const originalListener =
      host.view.components.account.actions.accountRemoved;
    let events = 0;
    try {
      host.view.actions.accountRemoved = function (event) {
        check(
          this === host.view && event.key === 'fixture-action-dispatch',
          'existing event connection forwards event/context'
        );
        events += 1;
      };
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'fixture-action-dispatch'
        })
      );
      check(events === 1, 'existing listener dispatches once to replacement');
    }
    finally {
      host.view.actions.accountRemoved = originalListener;
    }
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'fixture-action-dispatch'
      })
    );
    check(events === 1, 'original event handler restored');

    if (owner.runtime.widget) {
      const widget = owner.runtime.widget;
      const original = owner.components.profileEditing.actions.profileDraft;
      const draft = JSON.stringify(widget.draft());
      const originalDefinition =
        owner.components.profileEditing.actions.profileDraft;
      try {
        owner.actions.profileDraft = function () {
          check(this === owner, 'profile action context');
          return { marker: 'replacement', previous: original.call(this) };
        };
        check(
          widget.draft().marker === 'replacement',
          'existing shared Profile widget follows override'
        );
        check(
          owner.components.profileEditing.actions.profileDraft ===
            originalDefinition,
          'profile component original retained'
        );
      }
      finally {
        owner.actions.profileDraft = original;
      }
      check(
        JSON.stringify(widget.draft()) === draft,
        'original draft result restored'
      );
      const originalShow = owner.components.profileDetails.actions.showProfile;
      const subject = owner.runtime.profile.subject;
      const settings = owner.runtime.profile.options;
      try {
        owner.actions.showProfile = function (value, options) {
          check(
            this === owner && value === subject && options === settings,
            'existing Profile show arguments/context'
          );
          return 'replacement';
        };
        check(
          widget.show(subject, settings) === 'replacement',
          'existing Profile show uses replacement'
        );
      }
      finally {
        owner.actions.showProfile = originalShow;
      }
      widget.show(subject, settings);
      check(
        owner.runtime.profile.subject === subject &&
          JSON.stringify(widget.draft()) === draft,
        'original Profile show restored'
      );
    }

    if (host.managed) {
      const callback = host.managed.getState;
      const baseline = await callback();
      const original =
        owner.components[name === 'contacts' ? 'contactSession' : 'lifecycle']
          .actions.captureState;
      try {
        owner.actions.captureState = async function () {
          check(this === owner, 'managed callback context');
          return { ...original.call(this), opaque: 'replacement' };
        };
        check(
          (await callback()).opaque === 'replacement',
          'existing managed callback uses replacement promise'
        );
        owner.actions.captureState = async function () {
          throw new Error('action-dispatch-test: rejected replacement');
        };
        let error;
        try {
          await callback();
        }
        catch (failure) {
          error = failure;
        }
        check(
          error?.message === 'action-dispatch-test: rejected replacement',
          'existing managed callback retains asynchronous failure'
        );
      }
      finally {
        owner.actions.captureState = original;
      }
      check(
        JSON.stringify(await callback()) === JSON.stringify(baseline),
        'original managed state restored without data loss'
      );
    }
    else if (owner.runtime.workspace) {
      const broker = owner.runtime.workspace;
      const original =
        owner.components.workspaceControls.actions.authorizeRoute;
      const record = { allowBrowse: true };
      const capability = owner.api.browseCapability;
      const baseline = broker.authorize('launcher', record, capability);
      try {
        owner.actions.authorizeRoute = function (requester, entry, requested) {
          check(
            this === owner &&
              requester === 'launcher' &&
              entry === record &&
              requested === capability,
            'existing broker arguments/context'
          );
          return 'replacement';
        };
        check(
          broker.authorize('launcher', record, capability) === 'replacement',
          'existing broker follows current action'
        );
      }
      finally {
        owner.actions.authorizeRoute = original;
      }
      check(
        broker.authorize('launcher', record, capability) === baseline,
        'original broker authority decision restored'
      );
    }
    return name;
  });
  assert.ok(['launcher', 'contacts', 'files', 'profile'].includes(result));
}

export async function checkRetainedProfileDraft(page) {
  assert.equal(
    await page.evaluate(async () => {
      const owner = globalThis.muzeSolidContactsApp;
      const widget = owner.runtime.widget;
      const draft = widget.draft();
      if (draft?.values.notes !== 'Unsaved workspace draft') {
        throw new Error(
          'action-dispatch-test: Expected the real unsaved draft'
        );
      }
      const state = await owner.runtime.host.managed.getState();
      const originalDraft =
        owner.components.profileEditing.actions.profileDraft;
      const originalRestore =
        owner.components.profileEditing.actions.profileRestoreDraft;
      let read = 0;
      let restored = 0;
      try {
        owner.actions.profileDraft = function () {
          read += 1;
          return originalDraft.call(this);
        };
        owner.actions.profileRestoreDraft = function (value) {
          restored += 1;
          return originalRestore.call(this, value);
        };
        widget.restoreDraft(widget.draft());
        if (read !== 1 || restored !== 1) {
          throw new Error(
            'action-dispatch-test: Existing draft methods bypass replacement'
          );
        }
      }
      finally {
        owner.actions.profileDraft = originalDraft;
        owner.actions.profileRestoreDraft = originalRestore;
      }
      return (
        JSON.stringify(widget.draft()) === JSON.stringify(draft) &&
        JSON.stringify(await owner.runtime.host.managed.getState()) ===
          JSON.stringify(state)
      );
    }),
    true,
    'Live draft action replacement/removal retains unsaved edits and native app state'
  );
}
