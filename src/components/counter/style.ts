import {css} from 'lit';

export const spinnerStyle = css`
  :host {
    position: relative;
    display: block;
    /* height: 44px; */
    --color-icon-primary: rgb(239, 64, 86);
    --height-element: 35px;
    font-family: var(--ion-default-font);
  }

  span {
    font-family: var(--ion-default-font);
  }
  .spinner-number {
    height: 100%;
    display: flex;
    width: 102px;
    max-width: 102px;
    min-height: var(--height-element);
    max-height: var(--height-element);
    align-items: center;
  }

  button {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 25px;
    flex: auto;
  }
`;
