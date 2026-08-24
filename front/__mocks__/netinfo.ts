const NetInfo = {
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    }),
  ),
  addEventListener: jest.fn(() => jest.fn()),
};

export default NetInfo;
export type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
};
