import styles from '../dialog.css' with { type: 'text' };

export const muzeSolidDesignDialog = {
  styles: { 'muze-solid-design-dialog': styles },
  behaviors: {
    muzeSolidDesignDialog(dialog) {
      const cancel = (event) => {
        event.preventDefault();
        this.actions.muzeSolidDesignCloseDialog(dialog);
      };
      dialog.addEventListener('cancel', cancel);
      return () => {
        dialog.removeEventListener('cancel', cancel);
        for (const animation of dialog.getAnimations()) {
          animation.cancel();
        }
      };
    }
  },
  commands: {
    muzeSolidDesignCloseDialog(button) {
      return this.actions.muzeSolidDesignCloseDialog(button.closest('dialog'));
    }
  },
  actions: {
    muzeSolidDesignOpenDialog(dialog) {
      if (dialog.open) {
        return;
      }
      dialog.showModal();
      return this.actions.muzeSolidDesignAnimateDialog(dialog, true);
    },
    muzeSolidDesignCloseDialog(dialog) {
      if (!dialog.open) {
        return Promise.resolve();
      }
      this.runtime.muzeSolidDesignClosing ||= new WeakMap();
      const closing = this.runtime.muzeSolidDesignClosing;
      if (closing.has(dialog)) {
        return closing.get(dialog);
      }
      const completed = this.actions
        .muzeSolidDesignAnimateDialog(dialog, false)
        .then(() => {
          dialog.close();
          closing.delete(dialog);
        });
      closing.set(dialog, completed);
      return completed;
    },
    async muzeSolidDesignAnimateDialog(dialog, opening) {
      const surfaceStyle = getComputedStyle(dialog);
      const currentSurface = {
        opacity: surfaceStyle.opacity,
        transform: surfaceStyle.transform
      };
      const backdropColor = getComputedStyle(
        dialog,
        '::backdrop'
      ).backgroundColor;
      for (const animation of dialog.getAnimations()) {
        animation.cancel();
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      const collapsed = { opacity: 0, transform: 'scale(0.7)' };
      const expanded = { opacity: 1, transform: 'scale(1)' };
      const options = { duration: 300, easing: 'ease', fill: 'both' };
      const surface = dialog.animate(
        opening ? [collapsed, expanded] : [currentSurface, collapsed],
        options
      );
      const backdrop = dialog.animate(
        opening
          ? [
              { backgroundColor: 'transparent' },
              { backgroundColor: backdropColor }
            ]
          : [
              { backgroundColor: backdropColor },
              { backgroundColor: 'transparent' }
            ],
        { ...options, pseudoElement: '::backdrop' }
      );
      let deadline;
      try {
        // Background tabs may defer animation finish events. Always release
        // native modality even when those events are not delivered promptly.
        await Promise.race([
          Promise.all([surface.finished, backdrop.finished]),
          new Promise((resolve) => {
            deadline = setTimeout(resolve, 350);
          })
        ]);
      }
      catch {
        // Closing during entry cancels that entry animation. Native close and
        // focus restoration still complete through the caller's close action.
      }
      finally {
        clearTimeout(deadline);
        surface.cancel();
        backdrop.cancel();
      }
    }
  }
};
