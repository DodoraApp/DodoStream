import { LOCAL_SERVER_PORT, startLocalServer, stopLocalServer } from '@/api/local-server/server';
import { useLocalServerStore } from '@/store/local-server.store';

jest.mock('@/api/local-server/server', () => ({
  startLocalServer: jest.fn().mockResolvedValue(undefined),
  stopLocalServer: jest.fn().mockResolvedValue(undefined),
  LOCAL_SERVER_PORT: 7676,
}));

// Verify the mock stays in sync with the real constant.
expect(LOCAL_SERVER_PORT).toBe(7676);

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useLocalServerStore', () => {
  beforeEach(() => {
    useLocalServerStore.setState({ isRunning: false });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('has a 6-digit pin, isRunning false, and port 7676', () => {
      // Arrange
      const state = useLocalServerStore.getState();

      // Assert
      expect(state.pin).toMatch(/^\d{6}$/);
      expect(state.isRunning).toBe(false);
      expect(state.port).toBe(7676);
    });
  });

  describe('generatePin', () => {
    it('sets a new 6-digit pin and it differs from previous pin', () => {
      // Arrange
      const oldPin = useLocalServerStore.getState().pin;
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.987654);

      // Act
      useLocalServerStore.getState().generatePin();
      const newPin = useLocalServerStore.getState().pin;

      // Assert
      expect(newPin).toMatch(/^\d{6}$/);
      expect(newPin).not.toBe(oldPin);

      randomSpy.mockRestore();
    });

    it('when not running, does not call stopLocalServer or startLocalServer', () => {
      // Arrange
      useLocalServerStore.setState({ isRunning: false });

      // Act
      useLocalServerStore.getState().generatePin();

      // Assert
      expect(stopLocalServer).not.toHaveBeenCalled();
      expect(startLocalServer).not.toHaveBeenCalled();
    });

    it('when running, calls stopLocalServer then startLocalServer with new pin', async () => {
      // Arrange
      useLocalServerStore.setState({ isRunning: true });
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.444444);

      // Act
      useLocalServerStore.getState().generatePin();
      const generatedPin = useLocalServerStore.getState().pin;
      await flushMicrotasks();

      // Assert
      expect(stopLocalServer).toHaveBeenCalledTimes(1);
      expect(startLocalServer).toHaveBeenCalledTimes(1);
      expect(startLocalServer).toHaveBeenCalledWith(generatedPin);

      const stopOrder = (stopLocalServer as jest.Mock).mock.invocationCallOrder[0];
      const startOrder = (startLocalServer as jest.Mock).mock.invocationCallOrder[0];
      expect(stopOrder).toBeLessThan(startOrder);

      randomSpy.mockRestore();
    });

    it('when running and stop/restart fails, sets isRunning to false', async () => {
      // Arrange
      useLocalServerStore.setState({ isRunning: true });
      (stopLocalServer as jest.Mock).mockRejectedValueOnce(new Error('stop failed'));

      // Act
      useLocalServerStore.getState().generatePin();
      await flushMicrotasks();

      // Assert
      expect(useLocalServerStore.getState().isRunning).toBe(false);
    });
  });

  describe('startServer', () => {
    it('calls startLocalServer with current pin and sets isRunning to true', async () => {
      // Arrange
      const pin = useLocalServerStore.getState().pin;

      // Act
      await useLocalServerStore.getState().startServer();

      // Assert
      expect(startLocalServer).toHaveBeenCalledWith(pin);
      expect(useLocalServerStore.getState().isRunning).toBe(true);
    });

    it('propagates error when startLocalServer throws and leaves isRunning false', async () => {
      // Arrange
      useLocalServerStore.setState({ isRunning: false });
      const error = new Error('start failed');
      (startLocalServer as jest.Mock).mockRejectedValueOnce(error);

      // Act / Assert
      await expect(useLocalServerStore.getState().startServer()).rejects.toThrow('start failed');
      expect(useLocalServerStore.getState().isRunning).toBe(false);
    });
  });

  describe('stopServer', () => {
    it('calls stopLocalServer and sets isRunning to false', async () => {
      // Arrange
      useLocalServerStore.setState({ isRunning: true });

      // Act
      await useLocalServerStore.getState().stopServer();

      // Assert
      expect(stopLocalServer).toHaveBeenCalledTimes(1);
      expect(useLocalServerStore.getState().isRunning).toBe(false);
    });

    it('resets isRunning even when stopLocalServer throws', async () => {
      // Arrange
      useLocalServerStore.setState({ isRunning: true });
      const error = new Error('stop failed');
      (stopLocalServer as jest.Mock).mockRejectedValueOnce(error);

      // Act
      await useLocalServerStore.getState().stopServer();

      // Assert — stopServer is failsafe: always resets isRunning
      expect(useLocalServerStore.getState().isRunning).toBe(false);
    });
  });

  describe('persistence', () => {
    it('partialize persists only pin (not isRunning, not port)', () => {
      // Arrange
      const state = useLocalServerStore.getState();

      // Act
      const partialized = useLocalServerStore.persist.getOptions().partialize?.(state);

      // Assert
      expect(partialized).toEqual({ pin: state.pin });
      expect(partialized).not.toHaveProperty('isRunning');
      expect(partialized).not.toHaveProperty('port');
    });

    it('isRunning can be reset independently and is not persisted state', async () => {
      // Arrange
      await useLocalServerStore.getState().startServer();
      expect(useLocalServerStore.getState().isRunning).toBe(true);

      // Act
      useLocalServerStore.setState({ isRunning: false });

      // Assert
      expect(useLocalServerStore.getState().isRunning).toBe(false);
    });
  });
});
