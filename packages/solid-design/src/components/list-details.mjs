import styles from '../list-details.css' with { type: 'text' };

export const muzeSolidDesignListDetails = {
  styles: { 'muze-solid-design-list-details': styles },
  commands: {
    muzeSolidDesignShowList(button) {
      const layout = button.closest('.muze-solid-design-list-details');
      layout
        .querySelector('.ds-panels-list')
        .scrollIntoView({ block: 'nearest' });
      layout.querySelector('input, button, a')?.focus({ preventScroll: true });
    }
  }
};
