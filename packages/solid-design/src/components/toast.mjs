import template from '../toast.html' with { type: 'text' };
import styles from '../toast.css' with { type: 'text' };

export const muzeSolidDesignToast = {
  templates: { 'muze-solid-design-toast': template },
  styles: { 'muze-solid-design-toast': styles },
  behaviors: {
    muzeSolidDesignToast(element) {
      this.runtime.muzeSolidDesignToastElement = element;
      const rememberFocus = (event) => {
        if (!element.contains(event.relatedTarget)) {
          this.runtime.muzeSolidDesignToastReturn = event.relatedTarget;
        }
      };
      element.addEventListener('focusin', rememberFocus);
      return () => {
        clearTimeout(this.runtime.muzeSolidDesignToastTimer);
        element.removeEventListener('focusin', rememberFocus);
      };
    }
  },
  commands: {
    muzeSolidDesignDismissToast() {
      this.actions.muzeSolidDesignHideToast();
    }
  },
  actions: {
    muzeSolidDesignNotify(text) {
      clearTimeout(this.runtime.muzeSolidDesignToastTimer);
      if (!text) {
        this.actions.muzeSolidDesignHideToast();
        return;
      }
      this.data.muzeSolidDesignNotice.text = text;
      this.data.muzeSolidDesignNotice.visibility = {
        hidden: null,
        inert: null,
        'data-muze-solid-design-toast-closing': null
      };
      this.runtime.muzeSolidDesignToastTimer = setTimeout(
        this.actions.muzeSolidDesignExpireToast,
        8000
      );
    },
    muzeSolidDesignExpireToast() {
      const element = this.runtime.muzeSolidDesignToastElement;
      if (element?.matches(':hover, :focus-within')) {
        this.runtime.muzeSolidDesignToastTimer = setTimeout(
          this.actions.muzeSolidDesignExpireToast,
          1000
        );
        return;
      }
      this.actions.muzeSolidDesignHideToast();
    },
    muzeSolidDesignHideToast() {
      clearTimeout(this.runtime.muzeSolidDesignToastTimer);
      const element = this.runtime.muzeSolidDesignToastElement;
      if (element?.contains(document.activeElement)) {
        this.runtime.muzeSolidDesignToastReturn?.focus({ preventScroll: true });
      }
      if (
        !element || element.hidden ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        this.actions.muzeSolidDesignFinishToast();
        return;
      }
      this.data.muzeSolidDesignNotice.visibility = {
        hidden: null,
        inert: '',
        'data-muze-solid-design-toast-closing': ''
      };
      this.runtime.muzeSolidDesignToastTimer = setTimeout(
        this.actions.muzeSolidDesignFinishToast,
        300
      );
    },
    muzeSolidDesignFinishToast() {
      this.data.muzeSolidDesignNotice.visibility = {
        hidden: '',
        inert: null,
        'data-muze-solid-design-toast-closing': null
      };
      this.data.muzeSolidDesignNotice.text = '';
    }
  }
};
