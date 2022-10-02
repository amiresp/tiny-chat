import {css} from 'lit';

const reset = css`
  audio,
  canvas,
  progress,
  video {
    vertical-align: baseline;
  }

  audio:not([controls]) {
    display: none;
    height: 0;
  }

  b,
  strong {
    font-weight: 700;
  }

  img {
    max-width: 100%;
    border: 0;
  }

  svg:not(:root) {
    overflow: hidden;
  }

  figure {
    margin: 1em 40px;
  }

  hr {
    height: 1px;
    border-width: 0;
    box-sizing: content-box;
  }

  pre {
    overflow: auto;
  }

  code,
  kbd,
  pre,
  samp {
    font-family: monospace, monospace;
    font-size: 1em;
  }

  input,
  label,
  select,
  textarea {
    font-family: inherit;
    line-height: normal;
  }

  textarea {
    overflow: auto;
    height: auto;
    font: inherit;
    color: inherit;
  }

  textarea::placeholder {
    padding-left: 2px;
  }

  form,
  input,
  optgroup,
  select {
    margin: 0;
    font: inherit;
    color: inherit;
  }

  html input[type='button'],
  input[type='reset'],
  input[type='submit'] {
    cursor: pointer;
    -webkit-appearance: button;
  }

  .ion-tappable,
  [tappable],
  [tappable] div,
  [tappable] ion-icon,
  [tappable] ion-label,
  [tappable] span,
  a,
  a div,
  a ion-icon,
  a ion-label,
  a span,
  button,
  button div,
  button ion-icon,
  button ion-label,
  button span,
  input,
  textarea {
    touch-action: manipulation;
  }

  a ion-label,
  button ion-label {
    pointer-events: none;
  }

  button {
    border: 0;
    border-radius: 0;
    font-family: inherit;
    font-style: inherit;
    font-variant: inherit;
    line-height: 1;
    text-transform: none;
    cursor: pointer;
    -webkit-appearance: button;
  }

  [tappable] {
    cursor: pointer;
  }

  a[disabled],
  button[disabled],
  html input[disabled] {
    cursor: default;
  }

  button::-moz-focus-inner,
  input::-moz-focus-inner {
    padding: 0;
    border: 0;
  }

  input[type='checkbox'],
  input[type='radio'] {
    padding: 0;
    box-sizing: border-box;
  }

  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    height: auto;
  }

  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-decoration {
    -webkit-appearance: none;
  }

  table {
    border-collapse: collapse;
    border-spacing: 0;
  }

  td,
  th {
    padding: 0;
  }

  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  a {
    background-color: transparent;
    color: var(--ion-color-primary, #3880ff);
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 16px;
    margin-bottom: 10px;
    font-weight: 500;
    line-height: 1.2;
  }

  h1 {
    margin-top: 20px;
    font-size: 26px;
  }

  h2 {
    margin-top: 18px;
    font-size: 24px;
  }

  h3 {
    font-size: 22px;
  }

  h4 {
    font-size: 20px;
  }

  h5 {
    font-size: 18px;
  }

  h6 {
    font-size: 16px;
  }

  small {
    font-size: 75%;
  }

  sub,
  sup {
    position: relative;
    font-size: 75%;
    line-height: 0;
    vertical-align: baseline;
  }

  sup {
    top: -0.5em;
  }

  sub {
    bottom: -0.25em;
  }
`;

export default reset;
