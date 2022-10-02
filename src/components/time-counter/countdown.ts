import {html, PropertyValues, TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {AppElement} from '../../app-debt/app-element';
import {countDownStyle} from './style';

@customElement('time-counter')
export class TimeCounter extends AppElement {
  static override styles = [AppElement.styles, countDownStyle];

  @property({type: Number}) hours: number;
  @property({type: Number}) minutes: number;
  @property({type: Number}) seconds: number;
  @property({type: Boolean}) active: boolean;
  @property({type: Boolean}) reset: boolean;

  protected _playing: boolean | undefined;
  protected _showHour: boolean | undefined;
  protected _remainingSeconds: number;
  protected _displayTime: [number, number, number];
  protected _countDown: number | NodeJS.Timeout;

  constructor() {
    super();

    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
    this.active = true;
    this.reset = false;
    this._remainingSeconds = 0;
    this._displayTime = [0, 0, 0];
    this._countDown = setInterval(() => {
      this._countDownCallback();
    }, 1000);
  }

  protected addLeadingZero(number: number): string {
    return number < 10 ? `0${number}` : number + '';
  }

  protected override update(changedProperties: PropertyValues): void {
    this._log('update');

    if (changedProperties.has('reset') && this.reset) {
      this._reset();
    }

    super.update(changedProperties);
  }

  protected override render(): TemplateResult {
    this._log('render');
    return html`
      <div id="timer">
        ${this._showHour
          ? html`
              <span class="hours"
                >${this.addLeadingZero(this._displayTime[0])}</span
              ><span class="separator">:</span>
            `
          : ''}
        <span class="minutes"
          >${this.addLeadingZero(this._displayTime[1])}</span
        >
        <span class="separator">:</span>
        <span class="seconds"
          >${this.addLeadingZero(this._displayTime[2])}</span
        >
      </div>
    `;
  }

  protected override firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    this._log('firstUpdated');

    this._playing = this.active;
    this._initialTimerValue();
  }

  protected _countDownCallback(): void {
    this._log('_countDown: count is %s', this._remainingSeconds);

    if (this._remainingSeconds === 0) {
      return this._pause();
    }

    if (this._playing) {
      this._remainingSeconds--;
      this._calculateDisplayTime();
    }

    this.requestUpdate();
  }

  protected _play(): void {
    this._log('_play');

    this._playing = true;
    this.requestUpdate();
  }

  protected _pause(): void {
    this._log('_pause');

    this._playing = false;
    clearInterval(this._countDown as number);
    this._fire('time-is-ended', false);
    this.requestUpdate();
  }

  protected _reset(): void {
    this._log('_reset');

    this._playing = true;
    this._initialTimerValue();
    clearInterval(this._countDown as number);
    this._countDown = setInterval(() => {
      this._countDownCallback();
    }, 1000);
  }

  protected _calculateDisplayTime(): void {
    this._displayTime[0] = Math.floor(this._remainingSeconds / 3600);
    this._displayTime[1] =
      Math.floor(this._remainingSeconds / 60) - this._displayTime[0] * 60;
    this._displayTime[2] = this._remainingSeconds % 60;
  }

  protected _initialTimerValue(): void {
    this._log('_initialTimerValue');

    const initialHours = this.hours ? this.hours * 3600 : 0;
    const initialMinutes = this.minutes ? this.minutes * 60 : 0;
    const initialSeconds = this.seconds ? this.seconds : 0;

    if (initialHours) {
      this._showHour = true;
    }

    this._remainingSeconds = initialHours + initialMinutes + initialSeconds;
    this._calculateDisplayTime();

    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'time-counter': TimeCounter;
  }
}
