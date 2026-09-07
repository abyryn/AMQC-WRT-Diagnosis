// ============================================
// WRT Garage — ECU Manager Header
// High-level Honda PGM-FI ECU operations
// ============================================
#ifndef ECU_MANAGER_H
#define ECU_MANAGER_H

#include <Arduino.h>
#include "config.h"
#include "ecu_data.h"
#include "kline_driver.h"

#define MAX_DTC_COUNT   20
#define MAX_LIVE_QUEUE  10

class ECUManager {
public:
  ECUManager();

  void begin();

  // Connection management
  bool connect(InitMode mode = INIT_AUTO);
  void disconnect();
  bool isConnected();
  ECUState getState() { return _state; }

  // ECU operations
  bool readDTC(DTCRecord* records, uint8_t* count);
  bool clearDTC();
  bool readLiveData(LiveData* data);
  bool readFreezeFrame(FreezeFrame* frame);
  bool readECUInfo(ECUInfo* info);

  // Keep-alive (must be called periodically)
  bool sendKeepAlive();

  // Raw terminal mode
  int sendRawCommand(const uint8_t* cmd, size_t len, uint8_t* response, size_t maxLen);

  // Status
  const char* getStateString();
  uint32_t getLastActivityMs() { return _lastActivity; }

private:
  KLineDriver _kline;
  ECUState    _state;
  ECUInfo     _ecuInfo;
  uint32_t    _lastActivity;
  uint32_t    _lastKeepAlive;

  // Honda data parsing
  void parseDTCResponse(const uint8_t* data, size_t len, DTCRecord* records, uint8_t* count);
  void parseLiveDataResponse(const uint8_t* data, size_t len, LiveData* out);
  void parseFreezeFrameResponse(const uint8_t* data, size_t len, FreezeFrame* out);
  void parseECUInfoResponse(const uint8_t* data, size_t len, ECUInfo* out);
  void dtcBytesToCode(uint8_t high, uint8_t low, char* codeStr);
};

#endif // ECU_MANAGER_H
