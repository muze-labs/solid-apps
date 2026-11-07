import sourceContactsList from '../list.html' with { type: 'text' };

export const contactList = {
  templates: { 'contacts-list': sourceContactsList },
  actions: {
    initializeList() {
      const model = this.api.model({ data: [], options: { search: '' } });
      const owner = this;
      model.addEffect(function () {
        return owner.api.effect(() => this.state.data);
      });
      model.addEffect(function (input) {
        return owner.api.effect(() => {
          const search = this.state.options.search;
          return owner.api
            .from(input.current)
            .where((row) => owner.actions.matchesPerson(row, search))
            .orderBy({ label: owner.actions.comparePeople })
            .toArray();
        });
      });
      this.runtime.people = model;
      this.runtime.listEffect = this.api.effect(() => {
        this.data.people = model.view.current;
        this.data.empty = model.view.current.length ? '' : 'No contacts yet.';
      });
    },
    refreshPeople() {
      this.runtime.people.state.data = this.api
        .from(this.runtime.store.collection.list())
        .where(this.api.isPerson)
        .select((node) => ({
          id: node.id,
          label: this.api.profileLabel(node),
          search: Object.values(this.api.readProfile(node))
            .join(' ')
            .toLowerCase()
        }))
        .toArray();
    },
    setSearch(value) {
      this.data.search = value;
      this.runtime.people.state.options.search = value;
      return this.actions.publish();
    },
    selectContact(id) {
      this.runtime.selected = id;
      const node = id ? this.runtime.store.collection.get(id) : null;
      this.data.visibility = { hidden: node ? null : '' };
      this.runtime.widget.show(node, {
        editable: true,
        sourceLabel: 'Your private address book',
        onSave: (edits) => this.actions.saveContact(id, edits)
      });
      return this.actions.publish();
    },
    publish() {
      return this.runtime.host.managed
        ?.publish()
        .catch((error) => this.runtime.host.message(error.message));
    },
    matchesPerson(row, search) {
      return row.search.includes(search.toLowerCase());
    },
    comparePeople(a, b) {
      return a.label.localeCompare(b.label);
    }
  },
  commands: {
    search(element) {
      this.actions.setSearch(element.value);
    },
    select(_element, id) {
      this.actions.selectContact(id);
    }
  }
};
