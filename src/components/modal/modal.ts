// import {SignalInterface} from '@alwatr/signal';
import {html, PropertyValues, TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {AppElement} from '../../app-debt/app-element';
import {modalStyle} from './style';

/**
 * @fires {CustomEvent} modal-fire - This event will fire when the Number is Chnange.
 */
@customElement('web-modal')
export class WebModal extends AppElement {
  @property({type: Boolean, reflect: true})
  open: boolean;

  @property({type: Boolean})
  forceSubmit: boolean;

  // static override styles = [AppElement.styles, modalStyle];
  static override styles = [modalStyle];

  constructor() {
    super();
    this.open = false;
    this.forceSubmit = false;
  }

  // protected _modalSettings = new SignalInterface('modal-settings');

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('animationend', () => {
      if (!this.open) {
        this.removeAttribute('closing');
      }
    });
  }

  protected closeHandler(): void {
    this.setAttribute('closing', '');
    requestAnimationFrame(() => {
      this.open = false;
      const data = {open: false};
      // console.log(`modal setting`, data);
      // this._modalSettings.dispatch(data);
      this._fire('modal-fire', data);
    });
  }

  override render(): TemplateResult {
    return html`
      <div class="backdrop"></div>
      <div class="modal-wrapper">
        <div class="modal-header">
          <slot name="modal-header_content"></slot>
          <button
            class="close-button"
            @click=${this.forceSubmit ? null : this.closeHandler}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 8 8"
              aria-hidden="true"
              fill="currentColor"
            >
              <path
                d="M5.188 4l2.14-2.14A.84.84 0 106.141.672L4 2.812 1.86.672A.84.84 0 00.672 1.86L2.812 4 .672 6.14A.84.84 0 101.86 7.328L4 5.188l2.14 2.14A.84.84 0 107.328 6.14z"
              ></path>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <slot name="modal-body_content"></slot>
        </div>

        <div class="modal-footer">
          <slot name="modal-footer_content"></slot>
        </div>
      </div>
    `;
  }

  protected override updated(changedProperties: PropertyValues): void {
    // this._log('updated');

    if (
      changedProperties.has('open') &&
      changedProperties.get('open') != null
    ) {
      if (!this.open) {
        // this._fire('closed', true);
        const data = {open: false};
        // this._modalSettings.dispatch(data);
        this._fire('modal-fire', data);
      } else {
        const data = {open: true};
        this._fire('opened', data);
        // this._modalSettings.dispatch(data);
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'web-modal': WebModal;
  }
}
