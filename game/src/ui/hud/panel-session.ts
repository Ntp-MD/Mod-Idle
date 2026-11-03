/** Optional live session information shared by the menu's working windows. */
export const PANEL_SESSION = Symbol('panel-session');

export interface PanelSession {
  readonly state: string;
  readonly running: boolean;
  readonly speed: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly writable: boolean;
  readonly blocked: boolean;
  format: (value: number) => string;
  onpause: () => void;
  onhistory: () => void;
}
