import styles from '../dropdown.css' with { type: 'text' };

export const muzeSolidDesignDropdown = {
  styles: { 'muze-solid-design-dropdown': styles },
  shortcuts: {
    'muzeSolidDesignDropdown.arrowdown': function (event) {
      return this.actions.muzeSolidDesignMoveDropdown(event, 1);
    },
    'muzeSolidDesignDropdown.arrowup': function (event) {
      return this.actions.muzeSolidDesignMoveDropdown(event, -1);
    }
  },
  actions: {
    muzeSolidDesignMoveDropdown(event, direction) {
      const dropdown = event.target.closest('.muze-solid-design-dropdown');
      const menu = dropdown?.querySelector('[popover]');
      const trigger = dropdown?.querySelector('[popovertarget]');
      if (!menu || (event.target !== trigger && !menu.contains(event.target))) {
        return true;
      }
      menu.showPopover();
      const items = [];
      for (const item of menu.querySelectorAll('.ds-dropdown-link')) {
        if (!item.matches(':disabled') && item.getClientRects().length) {
          items.push(item);
        }
      }
      if (!items.length) {
        return;
      }
      const current = items.indexOf(document.activeElement);
      let next = current + direction;
      if (current === -1) {
        next = direction > 0 ? 0 : items.length - 1;
      }
      else if (next < 0) {
        next = items.length - 1;
      }
      else if (next >= items.length) {
        next = 0;
      }
      items[next].focus();
    }
  }
};
