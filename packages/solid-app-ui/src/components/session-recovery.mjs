export const sessionRecovery = {
  behaviors: {
    muzeSolidUiRecoveryDialog(dialog) {
      const cancelled = (event) => {
        this.runtime.session?.cancelSignIn();
        // CloseWatcher can emit a non-cancellable request without prior user
        // activation. Native close then owns completion; do not queue a second
        // close that could dismiss a subsequently reopened recovery dialog.
        if (event.cancelable) {
          event.preventDefault();
          this.actions.muzeSolidDesignCloseDialog(dialog);
        }
      };
      dialog.addEventListener('cancel', cancelled);
      return () => {
        dialog.removeEventListener('cancel', cancelled);
        this.runtime.session?.cancelSignIn();
      };
    }
  },
  commands: {
    async muzeSolidUiSignInAgain() {
      // Reserve the window in the click handler, before any asynchronous work.
      const popup = window.open(
        '',
        'solid-apps-auth',
        'popup,width=520,height=720'
      );
      this.data.muzeSolidUiRecoveryButton = { disabled: '' };
      this.data.muzeSolidUiRecoveryError = '';
      try {
        if (!popup) {
          throw new Error(
            'solid-app-ui: Allow the sign-in popup, then try again.'
          );
        }
        await this.runtime.session.signIn(popup);
        this.data.muzeSolidUiRecoveryVisibility = { hidden: '' };
        await this.actions.muzeSolidDesignCloseDialog(
          this.runtime.root.querySelector('.muze-solid-ui-recovery-dialog')
        );
        this.actions.notify('Signed in again. Your edits are retained.');
        try {
          await this.runtime.preferences.recover(this.runtime.session);
        }
        catch (error) {
          this.actions.message(error.message);
        }
      }
      catch (error) {
        if (error.code !== 'cancelled') {
          this.data.muzeSolidUiRecoveryError = error.message;
        }
      }
      finally {
        popup?.close();
        this.data.muzeSolidUiRecoveryButton = { disabled: null };
      }
    },
    muzeSolidUiCancelSignIn() {
      this.runtime.session?.cancelSignIn();
      return this.actions.muzeSolidDesignCloseDialog(
        this.runtime.root.querySelector('.muze-solid-ui-recovery-dialog')
      );
    }
  },
  actions: {
    muzeSolidUiAuthenticationRestored() {
      this.data.muzeSolidUiRecoveryVisibility = { hidden: '' };
    },
    muzeSolidUiSharedAuthorization() {
      const session = this.runtime.session;
      const resumed = session.useSharedAuthorization();
      const wasRequired =
        this.data.muzeSolidUiRecoveryVisibility.hidden === null;
      if (resumed) {
        this.actions.muzeSolidDesignCloseDialog(
          this.runtime.root.querySelector('.muze-solid-ui-recovery-dialog')
        );
      }
      this.actions.muzeSolidUiAuthenticationRestored();
      if (wasRequired) {
        this.actions.run(() =>
          session.perform(() => this.runtime.preferences.recover(session), {
            interactive: false
          })
        );
      }
    },
    muzeSolidUiAuthenticationRequired({ pending }) {
      this.data.muzeSolidUiRecoveryVisibility = { hidden: null };
      if (pending) {
        this.data.muzeSolidUiRecoveryError = '';
        this.actions.muzeSolidDesignOpenDialog(
          this.runtime.root.querySelector('.muze-solid-ui-recovery-dialog')
        );
      }
    }
  }
};
