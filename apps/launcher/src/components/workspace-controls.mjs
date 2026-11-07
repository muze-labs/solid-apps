import styles from './workspace-controls.css' with { type: 'text' };
import sourceLauncherWorkspace from '../workspace.html' with { type: 'text' };

export const workspaceControls = {
  styles: { 'swb-workspace': styles },
  templates: { 'launcher-workspace': sourceLauncherWorkspace },
  commands: {
    workspaceChanged(element) {
      return this.actions.setResource(element.value);
    },
    restoreWorkspace(...values) {
      return this.actions.handleRestoreWorkspace(...values);
    },
    restoreInstance(_element, id) {
      return this.actions.handleRestoreInstance(id);
    },
    allowBrowse(element, id) {
      return this.actions.setBrowsePermission(id, element.checked);
    },
    closeInstance(_element, id) {
      return this.actions.handleCloseInstance(id);
    },
    saveWorkspace(...values) {
      return this.actions.handleSaveWorkspace(...values);
    },
    closeWorkspace(...values) {
      return this.actions.handleCloseWorkspace(...values);
    },
    reviewConflict(...values) {
      return this.actions.handleReviewConflict(...values);
    },
    keepLocalWorkspace(...values) {
      return this.actions.handleKeepLocalWorkspace(...values);
    },
    usePodWorkspace(...values) {
      return this.actions.handleUsePodWorkspace(...values);
    },
    closeLocally(...values) {
      return this.actions.handleCloseLocally(...values);
    }
  },
  actions: {
    workspaceMessage: function (message, remember = false) {
      this.data.workspaceMessage = message;
      this.data.conflictAction = {
        hidden: this.runtime.persistence?.conflict ? null : ''
      };
      if (remember) {
        try {
          sessionStorage.setItem(
            'solid-apps.workspace-message',
            JSON.stringify({
              owner: this.runtime.host.session?.webId || '',
              message
            })
          );
        }
        catch {}
      }
    },
    workspaceFailure: function (error) {
      if (!this.runtime.persistence?.reviewedDocument) {
        this.data.conflictReview = { hidden: '' };
      }
      this.actions.workspaceMessage(error.message || String(error), true);
      this.runtime.host.message(error.message || String(error));
    },
    workspaceOperation: async function (
      operation,
      {
        network = false,
        allowConflict = false,
        message = 'Preparing workspace…'
      } = {}
    ) {
      if (this.runtime.workspaceBusy) {
        return;
      }
      this.runtime.workspaceBusy = true;
      this.data.workspaceButtons = { disabled: '' };
      try {
        if (!this.runtime.workspace || !this.runtime.persistence) {
          throw new Error('launcher: Workspace is still loading.');
        }
        if (network && this.runtime.persistence.conflict && !allowConflict) {
          throw new Error(
            'launcher: Pod conflict. Choose Review Pod conflict below.'
          );
        }
        this.actions.workspaceMessage(message);
        await (network
          ? this.runtime.host.requireSession().perform(operation)
          : operation());
      }
      catch (error) {
        this.actions.workspaceFailure(error);
      }
      finally {
        this.runtime.workspaceBusy = false;
        this.data.workspaceButtons = { disabled: null };
      }
    },
    renderWorkspace: function () {
      this.data.workspaceEntries = this.api
        .from([...this.runtime.workspace.instances.values()])
        .where((record) => !record.embedded)
        .select((record) => ({
          id: record.entry.id,
          label: record.entry.label || record.entry.url,
          allowBrowse: record.entry.allowBrowse,
          status: record.restoreError
            ? 'Needs attention: ' + record.restoreError
            : record.registered
              ? record.ready
                ? 'Connected'
                : 'Restoring'
              : record.win && !record.win.closed
                ? 'Opening'
                : 'Saved'
        }))
        .toArray();
    },
    createWorkspace: function () {
      this.runtime.workspace?.dispose();
      this.runtime.workspace = new this.api.WorkspaceBroker({
        embeddedProviders: [
          {
            url: new URL('../profile/', location.href).href,
            capability: this.api.editProfileCapability
          },
          {
            url: new URL('../files/', location.href).href,
            capability: this.api.browseCapability
          }
        ],
        snapshot: this.runtime.persistence.snapshot,
        keys: this.runtime.persistence.keys,
        authorize: (...args) => this.actions.authorizeRoute(...args),
        onMessage: (...args) => this.actions.workspaceNotice(...args),
        onChange: (...args) => this.actions.stageWorkspace(...args)
      });
      this.runtime.host.capabilityBroker = this.runtime.workspace;
      this.runtime.workspace.presentation =
        this.runtime.host.preferences.launchTarget;
      this.data.resource =
        this.runtime.persistence.snapshot.launcher?.resource || '';
      this.actions.renderWorkspace();
    },
    preparePod: async function ({ forWrite = false } = {}) {
      const session = this.runtime.host.requireSession();
      const url = this.runtime.host.resource('workspace');
      if (
        this.runtime.persistence.session !== session ||
        this.runtime.persistence.url !== url ||
        !this.runtime.persistence.document ||
        (!this.runtime.persistence.prepared &&
          !this.runtime.persistence.conflict)
      ) {
        await this.runtime.persistence.bind(session, url, { forWrite });
        if (
          ![...this.runtime.workspace.instances.values()].some(
            (record) => record.win
          )
        ) {
          this.actions.createWorkspace();
        }
      }
      return { session, url };
    },
    saveWorkspace: async function (close = false) {
      this.actions.workspaceMessage('Collecting the latest app state…');
      await this.runtime.workspace.checkpoint();
      const { session, url } = await this.actions.preparePod({
        forWrite: true
      });
      this.actions.workspaceMessage(
        'Saving workspace to your Pod… Complete sign-in if requested.'
      );
      if (!(await this.runtime.persistence.save(session, url))) {
        throw new Error(
          'launcher: State changed during saving. Save again before closing.'
        );
      }
      this.actions.workspaceMessage('Workspace saved to your Solid Pod.', true);
      if (close) {
        this.runtime.persistence.skipExit = true;
        this.runtime.workspace.closeApps();
        this.actions.renderWorkspace();
        this.runtime.host.message('Workspace saved and managed apps closed.');
        this.actions.workspaceMessage(
          'Workspace saved and managed apps closed. You can close this tab.',
          true
        );
        window.close();
      }
    },
    attemptExit: function () {
      if (
        this.runtime.exitAttempted ||
        !this.runtime.persistence ||
        !this.runtime.host.session
      ) {
        return;
      }
      this.runtime.exitAttempted = true;
      this.runtime.persistence.attemptExit(
        this.runtime.host.session,
        this.runtime.host.resource('workspace')
      );
    },
    handleRestoreWorkspace() {
      this.runtime.workspace?.restore();
    },
    handleRestoreInstance(id) {
      const record = this.runtime.workspace.instances.get(id);
      this.runtime.workspace.open(record.entry.url, { id });
    },
    handleCloseInstance(id) {
      this.runtime.host.run(() => this.runtime.workspace.remove(id));
    },
    handleSaveWorkspace() {
      this.actions.workspaceOperation(() => this.actions.saveWorkspace(), {
        network: true
      });
    },
    handleCloseWorkspace() {
      this.actions.workspaceOperation(() => this.actions.saveWorkspace(true), {
        network: true
      });
    },
    handleReviewConflict() {
      this.actions.workspaceOperation(
        async () => {
          const { local, remote } =
            await this.runtime.persistence.reviewConflict(
              this.runtime.host.requireSession(),
              this.runtime.host.resource('workspace')
            );
          if (!this.runtime.persistence.conflict) {
            this.data.conflictReview = { hidden: '' };
            this.actions.workspaceMessage(
              'Latest Pod version loaded. You can retry Save & close.',
              true
            );
            return;
          }
          this.data.localVersion = JSON.stringify(local, null, 2);
          this.data.podVersion = JSON.stringify(remote, null, 2);
          this.data.conflictReview = { hidden: null };
          this.actions.workspaceMessage(
            'Review both versions, then choose which workspace to keep.'
          );
        },
        {
          network: true,
          allowConflict: true,
          message: 'Reading the latest Pod version…'
        }
      );
    },
    handleKeepLocalWorkspace() {
      this.actions.workspaceOperation(
        async () => {
          await this.runtime.persistence.resolveConflict(
            this.runtime.host.requireSession(),
            this.runtime.host.resource('workspace'),
            'local'
          );
          this.data.conflictReview = { hidden: '' };
          await this.actions.saveWorkspace();
        },
        { network: true, allowConflict: true }
      );
    },
    handleUsePodWorkspace() {
      this.actions.workspaceOperation(async () => {
        this.runtime.workspace.closing = true;
        try {
          await this.runtime.persistence.resolveConflict(
            this.runtime.host.requireSession(),
            this.runtime.host.resource('workspace'),
            'pod'
          );
        }
        catch (error) {
          this.runtime.workspace.closing = false;
          throw error;
        }
        this.runtime.workspace.closeApps();
        this.actions.createWorkspace();
        this.data.conflictReview = { hidden: '' };
        this.runtime.workspace.restore();
        this.actions.workspaceMessage(
          'Using the Pod workspace. Restore apps if popups were blocked.',
          true
        );
      });
    },
    handleCloseLocally() {
      this.actions.workspaceOperation(async () => {
        await this.runtime.workspace.checkpoint();
        await this.runtime.persistence.work.catch(() => {});
        await this.runtime.persistence.persist();
        this.runtime.persistence.skipExit = true;
        this.runtime.workspace.closeApps();
        this.actions.renderWorkspace();
        this.runtime.host.message(
          'Locally saved workspace retained; managed apps closed.'
        );
        this.actions.workspaceMessage(
          'Locally saved workspace retained; managed apps closed. ' +
            'You can close this tab.',
          true
        );
        window.close();
      });
    },
    setResource(value) {
      if (this.runtime.workspace) {
        this.runtime.workspace.launcherState.resource = value;
        return this.runtime.host.run(() => this.runtime.workspace.changed());
      }
    },
    setBrowsePermission(id, allowed) {
      return this.runtime.host.run(() =>
        this.runtime.workspace.allow(id, allowed)
      );
    },
    authorizeRoute(requester, entry, capability) {
      return (
        requester === 'launcher' &&
        entry.allowBrowse &&
        capability === this.api.browseCapability
      );
    },
    workspaceNotice(message) {
      return this.actions.workspaceMessage(message);
    },
    async stageWorkspace(snapshot, keys) {
      if (this.runtime.workspace?.closing) {
        return;
      }
      await this.runtime.persistence.stage(snapshot, keys);
      this.actions.renderWorkspace();
    }
  }
};
