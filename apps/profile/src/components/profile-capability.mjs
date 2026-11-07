export const muzeSolidProfileCapability = {
  actions: {
    async muzeSolidProfileReceive(event) {
      if (this.runtime.muzeSolidProfileRequest) {
        return this.runtime.host.managed.respond(event.id, {
          error: {
            code: 'busy',
            message: 'Profile is handling another request.'
          }
        });
      }
      const subject = event.input?.['@id'];
      if (
        event.capability !== this.api.editProfileCapability ||
        typeof subject !== 'string' ||
        Object.keys(event.input).some((name) => name !== '@id')
      ) {
        return this.runtime.host.managed.respond(event.id, {
          error: { code: 'invalid', message: 'Unsupported profile request.' }
        });
      }
      this.runtime.muzeSolidProfileRequest = event;
      await this.actions.muzeSolidProfileOpen();
    },
    async muzeSolidProfileOpen() {
      const request = this.runtime.muzeSolidProfileRequest;
      if (!request) {
        return;
      }
      const session = this.runtime.host.session;
      if (!session) {
        this.runtime.host.message('Connect to Solid to edit your profile.');
        this.runtime.host.managed.presentationReady();
        return;
      }
      if (request.input['@id'] !== session.webId) {
        await this.runtime.host.managed.respond(request.id, {
          error: {
            code: 'denied',
            message: 'Connect as the requested profile owner.'
          }
        });
        this.runtime.muzeSolidProfileRequest = null;
        return;
      }
      await this.runtime.host.run(
        () => this.actions.showRemote(session.webId),
        { network: true }
      );
      this.runtime.host.managed.presentationReady();
    },
    async muzeSolidProfileComplete(url) {
      const request = this.runtime.muzeSolidProfileRequest;
      if (!request) {
        return;
      }
      await this.runtime.host.managed.respond(request.id, {
        result: { '@id': url }
      });
      this.runtime.muzeSolidProfileRequest = null;
    },
    muzeSolidProfileCancel(event) {
      if (this.runtime.muzeSolidProfileRequest?.id === event.id) {
        this.runtime.muzeSolidProfileRequest = null;
      }
    },
    muzeSolidProfileCanClose() {
      if (this.runtime.profile.saving) {
        return { allowed: false, saving: true };
      }
      return { allowed: !this.runtime.widget.draft(), saving: false };
    }
  }
};
