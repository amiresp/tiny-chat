import { SignalInterface } from '@alwatr/signal';
import { css, html, nothing, PropertyValueMap } from 'lit';
import { customElement } from 'lit/decorators/custom-element.js';
import { property, query } from 'lit/decorators.js';
import 'pwa-helper-components/pwa-install-button.js';

import { AppElement } from './app-debt/app-element';

import type { ListenerInterface } from '@alwatr/signal';
import type { TemplateResult, CSSResult } from 'lit';
import { createLogger } from '@alwatr/logger';
import { registerSW } from './utilities/register-sw';

interface chatInfo {
  id: string;
  name: string;
  color: string;
}

interface messageItem {
  id: string | any;
  name: string | any;
  message: string | any;
  destination: string | any;
  time: Date;
  sender?: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'app-index': AppIndex;
  }
}

/**
 * APP PWA Root Element
 *
 * ```html
 * <app-index></app-index>
 * ```
 */
@customElement('app-index')
export class AppIndex extends AppElement {
  static override styles = [
    ...(<CSSResult[]>AppElement.styles),
    css`
      :host {
        display: flex;
        height: 100%;
        width: 100%;
        /* overflow: hidden; */
        flex-wrap: wrap;
      }

      .page-container {
        position: relative;
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        height: auto;
        align-items: flex-end;
      }

      .status-handler {
        flex: 1 auto;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        font-size: 15px;
      }

      header {
        padding: 12px;
        background: rgba(208, 175, 255, 0.77);
        margin-bottom: 12px;
        box-shadow: rgb(169 169 169) 0px 0px 20px;
        height: 40px;
        display: flex;
        width: 100%;
        align-items: center;
      }

      .status-handler span {
        width: 100%;
        display: inline-block;
        text-align: center;
      }

      /* This will be displayed only on lazy loading. */
      [unresolved]::after {
        content: '...';
        display: block;
        font-size: 2em;
        padding-top: 30vh;
        letter-spacing: 3px;
        text-align: center;
      }

      ul {
        width: 100%;
        display: flex;
        list-style: none;
        padding: 0;
        flex-wrap: wrap;
      }

      .form-send-Message {
        width: 100%;
        display: flex;
        height: 40px;
        padding: 5px;
        padding-bottom: 5px;
      }

      .form-send-Message input {
        flex: 1 auto;
      }

      .form-send-Message button {
        width: 50px;
      }

      li {
        width: 100%;
        margin: 10px;
      }

      .your-key,
      .enter-key {
        display: flex;
        flex-direction: row-reverse;
        flex-wrap: wrap;
      }

      .your-key input,
      .enter-key input {
        width: 100%;
        max-width: 70px;
      }

      .inbox {
      }

      .outbox {
      }
    `,
  ];

  constructor() {
    super();
  }

  // protected socket = io();

  protected _hideNavigation = true;
  protected _appSettings = new SignalInterface('app-settings');
  protected _serviceWorkerUpdate = new SignalInterface('sw-update');
  protected _logger = createLogger('*');
  protected sww = new WebSocket('ws://192.168.1.2:3000');

  @property({ type: Boolean })
  activePage: boolean = false;

  @property({ type: String })
  statusSocket: String = '';

  @property({ type: Object })
  chatInfo: chatInfo = { id: '0', name: 'test', color: '#000' };

  @query('#inputBox')
  messageText!: HTMLInputElement;

  @property({ type: Array })
  messages: Array<messageItem> = [];

  protected _listenerList: Array<unknown> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this._logger.logMethodArgs('Connected Callback', 'COnnected CallBack');

    this.sww.onopen = function () {
      console.log('[open] Connection established');
      return true;
    };
    const that = this;
    this.sww.onmessage = function (e: MessageEvent<any>) {
      // console.log('Sending to server');
      const msg = JSON.parse(e.data);
      const localStorage = window.localStorage.getItem('userInfo');
      if (msg.type === 'userInfo') {
        window.localStorage.setItem('userInfo', JSON.stringify(msg.meta));
        that.chatInfo = msg.meta;
      } else if (msg.type === 'message') {
        if (localStorage) {
          let localStorageTemp = JSON.parse(localStorage);
          if (localStorageTemp) {
            // localStorageTemp.id;
            if (localStorageTemp.id !== msg.metadata.id) {
              that.checkNotification(msg.data.message);
              that.revercideMsg(msg.data);
            }
          }
        }
      }
      console.log(e.data);
      return true;
    };

    setInterval(() => {
      switch (this.sww.readyState) {
        // connecting
        case 0:
          this.statusSocket = 'درحال اتصال';
          break;
        // open
        case 1:
          this.statusSocket = 'انلاین';
          break;
        // CLOSING
        case 2:
          this.statusSocket = 'درحال بسته شدن';
          break;
        // CLOSED
        case 3:
          this.statusSocket = 'بسته شده';
          break;
        default:
          this.statusSocket = '...';
          break;
      }
    }, 1000);
    // registerTranslation(en, fa);
    registerSW();

    // this._appSettings.dispatch('test_new');
  }

  checkNotification(message: string): void {
    if (!('Notification' in window)) {
      alert('This browser does not support system notifications!');
    } else if (Notification.permission === 'granted') {
      this.sendNotification(message);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission((permission) => {
        if (permission === 'granted') {
          this.sendNotification(message);
        }
      });
    }
  }

  protected sendNotification(message: string): void {
    const notification = new Notification('چت آسان', {
      // icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
      body: `${message}`,
    });
    notification.onclick = () =>
      function () {
        window.open('http://localhost:3000/');
      };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this._listenerList.forEach((listener) =>
      (listener as ListenerInterface<keyof AlwatrSignals>).remove()
    );
  }

  getParameterByName(name: string, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  gotoChat(chatNumber: Event): void {
    const chatNumber_val = (chatNumber.target as HTMLInputElement).value;
    history.pushState(
      null,
      'FeaturePoints Login',
      `http://192.168.1.2:8000/?chat=${chatNumber_val}`
    );
  }

  revercideMsg(msg: messageItem): void {
    const localStorage = window.localStorage.getItem('userInfo');
    if (localStorage) {
      let localStorageTemp = JSON.parse(localStorage);
      if (localStorageTemp) {
        // const msg = {
        //   id: localStorageTemp.id,
        //   name: localStorageTemp.name,
        //   message: this.messageText.value,
        //   destination: this.getParameterByName('chat'),
        //   time: new Date(),
        // };
        console.log('new message', msg);
        const data = this.messages;
        data.push(msg);
        this.messages = [...data];
      }
    }
  }

  sendMessage(): void {
    setTimeout(() => {
      const localStorage = window.localStorage.getItem('userInfo');
      if (localStorage) {
        let localStorageTemp = JSON.parse(localStorage);
        if (localStorageTemp) {
          const msg = {
            id: localStorageTemp.id,
            name: localStorageTemp.name,
            message: this.messageText.value,
            destination: this.getParameterByName('chat'),
            time: new Date(),
          };
          this.sww.send(JSON.stringify(msg));
          const data = this.messages;
          data.push(msg);
          this.messages = [...data];
          this.messageText.value = '';
        }
      }
    }, 200);
    // }
  }

  override render(): TemplateResult {
    return html`
      ${this._renderHeader()}
      <main class="page-container">
        <ul id="messages">
          ${this.messages?.map(
            (item) =>
              html`<li class="${item.sender ? 'inbox' : 'outbox'}">
                ${item.message}
              </li>`
          )}
        </ul>
        <div class="form-send-Message">
          <input id="inputBox" />
          <button @click=${this.sendMessage}>SEND</button>
        </div>
      </main>
    `;
  }

  protected _renderHeader(): TemplateResult | typeof nothing {
    this.activePage = true;
    return html`
      <header>
        <div class="your-key">
          کد مخاطبتان را وارد کنید:
          <input type="text" @change=${this.gotoChat} />
        </div>
        <div class="status-handler">
          وضعیت شما
          <span data-status="${this.statusSocket}">${this.statusSocket}</span>
        </div>

        <div class="enter-key">
          کد شما
          <input
            type="text"
            id="my-chat-id"
            ?disabled="${true}"
            value="${this.chatInfo.id}"
          />
        </div>
      </header>
    `;
  }

  protected override async firstUpdated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
  ): Promise<void> {
    super.firstUpdated(_changedProperties);

    console.log();
  }
}
