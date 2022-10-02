import {css} from 'lit';

export const countDownStyle = css`
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
    /* pointer-events: none; */
    font-family: var(--text-font-family);
  }
`;
