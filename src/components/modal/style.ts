import {css} from 'lit';

export const modalStyle = css`
  :host {
    z-index: 200;
    position: fixed;
    top: 0;
    right: 0;
    bottom: var(--overlay-viewport-bottom);
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
    /* pointer-events: none; */
    -webkit-tap-highlight-color: transparent;
    --overlay-viewport-bottom: 0;
    --modal-wrapper-width: auto;
    --modal-wrapper-direction: row;
    --var-footer-display: flex;
    --var-body-height: auto;
    --var-body-overflow: auto;
    font-family: var(--text-font-family);
    display: none;
  }

  .backdrop {
    background-color: #050913c4;
    width: 100%;
    height: 100%;
    bottom: 0;
    left: 0;
    position: fixed;
  }

  .modal-wrapper {
    min-width: 12em;
    box-shadow: 0 0 0 1px #193b670d;
    padding: 1.5rem;
    box-sizing: border-box;
    background: #fff;
    border-radius: 4px;
    overflow: auto;
    z-index: 99;
    width: var(--modal-wrapper-width);
    height: auto;
    max-height: 100%;
  }

  .modal-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #dddddd;
    padding-bottom: 12px;
    margin-bottom: 15px;
    max-height: 65px;
  }

  .modal-body {
    padding: 0;
    margin: 15px 0;
    width: 100%;
    height: --var-body-height;
    overflow: --var-body-overflow;
  }

  .modal-footer {
    border-top: 1px solid #dddddd;
    padding-top: 12px;
    width: 100%;
    height: auto;
    max-height: 65px;
  }

  .close-button {
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
  }

  .close-button svg {
    width: 10px;
    height: 10px;
  }

  :host([dir='rtl']) .modal-header ::slotted([slot='modal-header_content']) {
    margin: 0;
    font-size: 20px;
  }

  :host([closing]) {
    animation: 0.1s 0.03s dialog-exit cubic-bezier(0.55, 0.055, 0.675, 0.19)
      both;
    display: flex;
  }

  :host([open]) {
    animation: dialog-enter;
    animation-duration: 0.2s;
    opacity: 1;
    display: flex;
  }

  :host([open]) .modal-wrapper {
    animation: dialog-enter-wrapper;
    animation-duration: 0.2s;
    opacity: 1;
  }

  :host([closing]) .modal-wrapper {
    animation: dialog-exit;
    animation-duration: 0.2s;
    opacity: 1;
  }

  .modal-footer {
    display: var(--var-footer-display);
  }

  @keyframes dialog-exit {
    100% {
      opacity: 0;
      /* transform: scale(2); */
    }
  }

  @keyframes dialog-enter {
    0% {
      opacity: 0;
      /* transform: scale(0); */
    }
    100% {
      opacity: 1;
      /* transform: scale(1); */
    }
  }

  @keyframes dialog-enter-wrapper {
    0% {
      transform: scale(0.5);
    }
    100% {
      /* opacity: 1; */
      transform: scale(1);
    }
  }

  @media screen and (max-width: 720px) {
    .modal-wrapper {
      width: 90%;
      max-width: 90%;
      max-height: 80vh;
    }
  }
`;
