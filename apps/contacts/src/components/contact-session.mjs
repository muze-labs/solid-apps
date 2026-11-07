import styles from './contact-session.css' with { type: 'text' };
export const contactSession = {
  styles: { 'swb-contact-layout': styles },
  actions: {
    async initialize() {
      this.actions.initializeList();
      this.runtime.widget = this.api.profileView(
        this.container.querySelector('.contact-profile'),
        {
          app: this,
          emptyText: 'Select a contact to view their profile.',
          onChange: (...args) => this.actions.publish(...args)
        }
      );
      await this.runtime.host.run(async () => {
        this.runtime.store = await this.api.openCollection('contacts', {
          scalarPredicates: this.api.scalarPredicates
        });
        this.actions.refreshPeople();
      });
      this.runtime.host.onConnect = () =>
        this.runtime.host.message(
          'Connected. Choose Sync with Solid to attach your address book.'
        );
      this.runtime.appState = new this.api.AppState();
      this.runtime.host.manage({
        getState: (...args) => this.actions.captureState(...args),
        restoreState: (...args) => this.actions.restoreState(...args)
      });
    },
    captureState() {
      const state = this.runtime.appState;
      state.set(this.api.apps + 'selected', this.runtime.selected, 'iri');
      state.set(this.api.apps + 'filter', this.data.search);
      this.api.writeDraft(state, this.runtime.widget.draft());
      return state.snapshot();
    },
    restoreState(snapshot) {
      const state = this.runtime.appState;
      state.restore(snapshot);
      this.actions.setSearch(state.read(this.api.apps + 'filter'));
      this.actions.selectContact(
        state.read(this.api.apps + 'selected', 'iri') || null
      );
      this.runtime.widget.restoreDraft(this.api.readDraft(state));
    },
    cleanup() {
      this.runtime.widget.destroy();
      this.api.destroy(this.runtime.listEffect);
      for (const signal of this.runtime.people.effects.slice(1)) {
        this.api.destroy(signal);
      }
    }
  }
};
