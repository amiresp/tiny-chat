import {CSSResult, CSSResultArray, LitElement, PropertyValues} from 'lit';
import {property} from 'lit/decorators/property.js';

import {sharedStyles} from './share-style';

export abstract class AppElement extends LitElement {
  @property({type: Boolean, reflect: true})
  debug: boolean;

  static override styles: CSSResult | CSSResultArray = [sharedStyles];

  private developmentMode: boolean;

  constructor() {
    super();
    this.developmentMode = true;
    this.debug = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
  }

  protected override shouldUpdate(_changedProperties: PropertyValues): boolean {
    this._log('shouldUpdate: %o', {
      hidden: !this.hasAttribute('hidden'),
      dir: !!this.dir,
    });
    return (
      super.shouldUpdate(_changedProperties) &&
      !this.hasAttribute('hidden') &&
      this.validateProperties(_changedProperties)
    );
  }

  protected override async performUpdate(): Promise<unknown> {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    return super.performUpdate();
  }

  protected validateProperties(
    _changedProperties?: Map<string | number | symbol, unknown>
  ): boolean {
    return true;
  }

  private __logger(message: unknown, ...restParam: unknown[]): unknown[] {
    // first args must be separated as keyPattern for fix issue of `this._log('a=%s', a)`
    const tagName = (this.tagName + '').toLowerCase();
    return [
      `%c<%s>%c ${message}`,
      'color: #4CAF50; font-size: 1.2em;',
      tagName,
      'color: inherit;font-size: 1em',
      ...restParam,
    ];
  }

  log(message: unknown, ...restParam: unknown[]): void {
    this.__logger('log', message, ...restParam);
  }

  protected _log(message: unknown, ...restParam: unknown[]): void {
    if ((this.debug && this.developmentMode) || 'pilasaDebugAll' in window) {
      console.log(...this.__logger(message, ...restParam));
    }
  }

  protected _warn(message: unknown, ...restParam: unknown[]): void {
    console.warn(...this.__logger(message, ...restParam));
  }

  protected _error(message: unknown, ...restParam: unknown[]): void {
    console.error(...this.__logger(message, ...restParam));
  }

  protected _fire(eventName: string, detail: unknown, bubbles = false): void {
    this._log('fire %s {%o}', eventName, detail);
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
        bubbles,
        composed: bubbles,
      })
    );
  }

  protected customDebounce(
    // eslint-disable-next-line @typescript-eslint/ban-types
    fn: Function,
    ms = 300
  ): (...args: unknown[]) => void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;
    let timeoutId: ReturnType<typeof setTimeout>;

    return function (...args: unknown[]): void {
      clearTimeout(timeoutId);

      fn = fn.bind(_this);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  }
}
