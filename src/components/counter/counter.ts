import {html, PropertyValueMap, TemplateResult} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

import {AppElement} from '../../app-debt/app-element';
import {spinnerStyle} from './style';

/**
 * @fires {CustomEvent} value-change - This event will fire when the Number is Chnange.
 */
@customElement('web-counter')
export class WebCounter extends AppElement {
  @query('#upper')
  upperButton!: HTMLButtonElement;

  @query('#lower')
  lowerButton!: HTMLButtonElement;

  @query('#teament')
  teamentInput!: HTMLSpanElement;

  @property({type: Number})
  max: number;

  @property({type: Number})
  min: number;

  @property({type: String})
  name: string;

  // static override styles = [AppElement.styles, spinnerStyle];
  static override styles = [spinnerStyle];

  constructor() {
    super();
    this.max = 2;
    this.min = 0;
    this.name = 'Nset';
  }

  override connectedCallback(): void {
    super.connectedCallback();
  }

  override render(): TemplateResult {
    return html`
      <div class="spinner-number">
        <button id="upper">
          <svg
            style="width: 18px; height: 18px; fill: var(--color-icon-primary);"
            viewBox="0 0 24 24"
          >
            <path
              fill-rule="evenodd"
              d="M13 4h-2v7H4v2h7v7h2v-7h7v-2h-7V4z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </button>
        <span id="teament"></span>
        <button id="lower">
          <svg
            viewBox="0 0 24 24"
            style="width: 18px; height: 18px; fill: var(--color-icon-primary);"
          >
            <path d="M20 11v2H4v-2h16z"></path>
          </svg>
        </button>
      </div>
    `;
  }

  protected override firstUpdated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
  ): void {
    super.firstUpdated(_changedProperties);
    this.teamentInput.textContent = `${this.min}`;
    this.upperButton.addEventListener('click', () => {
      if (Number(this.teamentInput.textContent) !== this.max) {
        this.teamentInput.textContent = `${
          Number(this.teamentInput?.textContent) + 1
        }`;
        this._fire('value-change', [this.name, this.teamentInput.textContent]);
      }
    });

    this.lowerButton.addEventListener('click', () => {
      if (
        Number(this.teamentInput.textContent) !== 0 &&
        Number(this.teamentInput.textContent) !== this.min
      ) {
        this.teamentInput.textContent = `${
          Number(this.teamentInput?.textContent) - 1
        }`;
        this._fire('value-change', [this.name, this.teamentInput.textContent]);
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'web-counter': WebCounter;
  }
}
