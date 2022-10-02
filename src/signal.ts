export {};
interface modalInterface {
  open: boolean;
}

interface gameOptionInterface {
  team: number;
  period: number;
  time: number;
}

declare global {
  type settingsNames = 'spies' | 'players' | 'time';
  type settings = Record<settingsNames, number>;
  interface AlwatrSignals {
    readonly 'hide-navigation': boolean;
    readonly 'app-settings': Array<void> | undefined;
    readonly 'app-words': string[];
    readonly 'sw-update': void;
    readonly 'modal-settings': modalInterface | undefined;
    readonly 'game-options': gameOptionInterface | undefined;
  }
}
