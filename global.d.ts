export {};

declare global {
  /**
   * React Native / Metro compile-time dev flag.
   * In Jest/unit tests we also set it manually on `global`.
   */
  // eslint-disable-next-line no-var
  var __DEV__: boolean | undefined;
}

