// ============================================
// WRT Garage — K-Line Driver Header
// Physical layer for Honda PGM-FI K-Line
// ============================================
#ifndef KLINE_DRIVER_H
#define KLINE_DRIVER_H

#include <Arduino.h>
#include "config.h"

class KLineDriver {
public:
  KLineDriver();

  void begin();

  // Initialization sequences
  bool fastInit();
  bool fiveBaudInit();
  bool autoDetectInit();

  // Data transfer
  bool sendBytes(const uint8_t* data, size_t len);
  int  readBytes(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs = KLINE_TIMEOUT_MS);
  bool sendAndReceive(const uint8_t* txData, size_t txLen, uint8_t* rxBuffer, size_t* rxLen, uint32_t timeoutMs = KLINE_TIMEOUT_MS);

  // Honda protocol framing
  bool sendHondaRequest(uint8_t tableId, uint8_t subId, const uint8_t* extra = nullptr, size_t extraLen = 0);
  int  readHondaResponse(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs = KLINE_TIMEOUT_MS);

  // Utilities
  uint8_t calcChecksum(const uint8_t* data, size_t len);
  bool    isConnected() { return _connected; }
  void    disconnect();
  void    flushRx();

private:
  bool    _connected;
  uint8_t _initMode; // 0=fast, 1=5baud
  uint32_t _lastActivity;

  void    setKLineLow();
  void    setKLineHigh();
  void    sendByte5Baud(uint8_t b);
};

#endif // KLINE_DRIVER_H
