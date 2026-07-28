// Coalesce DOM-enhancement MutationObservers created by the legacy polish layers.
// React/Ionic initialize before this file is loaded, so their internal observers are untouched.
const NativeMutationObserver = window.MutationObserver;

if (NativeMutationObserver && !window.__tinyChatObserverThrottleInstalled) {
  window.__tinyChatObserverThrottleInstalled = true;

  class TinyChatMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.records = [];
      this.timer = null;
      this.native = new NativeMutationObserver((records) => {
        this.records.push(...records);
        if (this.timer) return;
        this.timer = window.setTimeout(() => {
          this.timer = null;
          const batch = this.records.splice(0);
          if (batch.length) this.callback(batch, this);
        }, 72);
      });
    }

    observe(target, options) {
      this.native.observe(target, options);
    }

    disconnect() {
      if (this.timer) window.clearTimeout(this.timer);
      this.timer = null;
      this.records.length = 0;
      this.native.disconnect();
    }

    takeRecords() {
      return [...this.records.splice(0), ...this.native.takeRecords()];
    }
  }

  window.MutationObserver = TinyChatMutationObserver;
}
