// ============================================
// WRT Garage — ECU Manager Implementation
// High-level Honda PGM-FI ECU operations
// ============================================
#include "ecu_manager.h"

ECUManager::ECUManager() : _state(ECU_DISCONNECTED), _lastActivity(0), _lastKeepAlive(0) {
  memset(&_ecuInfo, 0, sizeof(_ecuInfo));
}

void ECUManager::begin() {
  _kline.begin();
  _state = ECU_DISCONNECTED;
  Serial.println("[ECU] Manager initialized");
}

// ============================================
// CONNECTION MANAGEMENT
// ============================================
bool ECUManager::connect(InitMode mode) {
  if (_state == ECU_CONNECTED) {
    Serial.println("[ECU] Already connected");
    return true;
  }

  _state = ECU_CONNECTING;
  Serial.printf("[ECU] Connecting (mode: %d)...\n", mode);

  bool success = false;
  switch (mode) {
    case INIT_FAST:
      success = _kline.fastInit();
      break;
    case INIT_5BAUD:
      success = _kline.fiveBaudInit();
      break;
    case INIT_AUTO:
    default:
      success = _kline.autoDetectInit();
      break;
  }

  if (success) {
    _state = ECU_CONNECTED;
    _lastActivity = millis();
    _lastKeepAlive = millis();

    // Try to read ECU info on connect
    readECUInfo(&_ecuInfo);
    Serial.printf("[ECU] ✅ Connected! Part: %s\n", _ecuInfo.part_number);
  } else {
    _state = ECU_ERROR;
    Serial.println("[ECU] ❌ Connection failed");
  }

  return success;
}

void ECUManager::disconnect() {
  _kline.disconnect();
  _state = ECU_DISCONNECTED;
  Serial.println("[ECU] Disconnected");
}

bool ECUManager::isConnected() {
  return _state == ECU_CONNECTED && _kline.isConnected();
}

// ============================================
// READ DTC
// ============================================
bool ECUManager::readDTC(DTCRecord* records, uint8_t* count) {
  if (!isConnected()) return false;

  _state = ECU_BUSY;
  *count = 0;

  // Honda: Request Table 0x73 (DTC read)
  // Frame: [72] [05] [73] [00] [xx] [checksum]
  uint8_t subId = 0x00; // All DTCs
  _kline.sendHondaRequest(HONDA_TABLE_DTC, subId);

  uint8_t response[128];
  int rxLen = _kline.readHondaResponse(response, sizeof(response));

  if (rxLen > 3) {
    parseDTCResponse(response, rxLen, records, count);
    Serial.printf("[ECU] DTC read: %d codes found\n", *count);
    _lastActivity = millis();
    _state = ECU_CONNECTED;
    return true;
  }

  Serial.println("[ECU] DTC read failed");
  _state = ECU_CONNECTED;
  return false;
}

// ============================================
// CLEAR DTC
// ============================================
bool ECUManager::clearDTC() {
  if (!isConnected()) return false;

  _state = ECU_BUSY;

  // Honda: Request Table 0x74 (Clear DTC)
  _kline.sendHondaRequest(HONDA_TABLE_CLEAR_DTC, 0x00);

  uint8_t response[32];
  int rxLen = _kline.readHondaResponse(response, sizeof(response));

  _state = ECU_CONNECTED;

  if (rxLen > 0) {
    Serial.println("[ECU] ✅ DTC cleared successfully");
    _lastActivity = millis();
    return true;
  }

  Serial.println("[ECU] ❌ DTC clear failed");
  return false;
}

// ============================================
// READ LIVE DATA
// ============================================
bool ECUManager::readLiveData(LiveData* data) {
  if (!isConnected()) return false;

  // Honda: Request Table 0x71, Sub 0x00 (all live data)
  _kline.sendHondaRequest(HONDA_TABLE_LIVE, 0x00);

  uint8_t response[64];
  int rxLen = _kline.readHondaResponse(response, sizeof(response));

  if (rxLen > 5) {
    parseLiveDataResponse(response, rxLen, data);
    data->timestamp_ms = millis();
    _lastActivity = millis();
    return true;
  }

  return false;
}

// ============================================
// READ FREEZE FRAME
// ============================================
bool ECUManager::readFreezeFrame(FreezeFrame* frame) {
  if (!isConnected()) return false;

  _kline.sendHondaRequest(HONDA_TABLE_FREEZE, 0x00);

  uint8_t response[64];
  int rxLen = _kline.readHondaResponse(response, sizeof(response));

  if (rxLen > 5) {
    parseFreezeFrameResponse(response, rxLen, frame);
    _lastActivity = millis();
    return true;
  }

  return false;
}

// ============================================
// READ ECU INFO
// ============================================
bool ECUManager::readECUInfo(ECUInfo* info) {
  if (!_kline.isConnected()) return false;

  // Honda: Table 0x71, Sub 0x01 (ECU identification)
  _kline.sendHondaRequest(HONDA_TABLE_ECU_INFO, 0x01);

  uint8_t response[64];
  int rxLen = _kline.readHondaResponse(response, sizeof(response));

  if (rxLen > 5) {
    parseECUInfoResponse(response, rxLen, info);
    info->connected = true;
    info->protocol = 0; // K-Line
    _lastActivity = millis();
    return true;
  }

  // Fallback: set empty info
  strcpy(info->part_number, "Unknown");
  strcpy(info->firmware_ver, "N/A");
  return false;
}

// ============================================
// KEEP-ALIVE
// ============================================
bool ECUManager::sendKeepAlive() {
  if (!isConnected()) return false;

  if ((millis() - _lastKeepAlive) < KLINE_KEEPALIVE_MS) return true;

  // Honda keep-alive: [FE 04 72 checksum]
  uint8_t keepAlive[] = { 0xFE, 0x04, 0x72 };
  uint8_t cs = _kline.calcChecksum(keepAlive, 3);
  uint8_t frame[] = { 0xFE, 0x04, 0x72, cs };

  _kline.flushRx();
  _kline.sendBytes(frame, sizeof(frame));

  uint8_t response[16];
  int rxLen = _kline.readBytes(response, sizeof(response), 500);

  _lastKeepAlive = millis();

  if (rxLen > 0) {
    _lastActivity = millis();
    return true;
  }

  // If keep-alive fails, mark disconnected
  Serial.println("[ECU] Keep-alive failed, disconnecting...");
  _state = ECU_DISCONNECTED;
  return false;
}

// ============================================
// RAW TERMINAL
// ============================================
int ECUManager::sendRawCommand(const uint8_t* cmd, size_t len, uint8_t* response, size_t maxLen) {
  if (!isConnected()) return -1;

  _kline.flushRx();
  _kline.sendBytes(cmd, len);

  // Skip echo
  uint8_t echo[64];
  _kline.readBytes(echo, len, 100);

  return _kline.readBytes(response, maxLen);
}

// ============================================
// STATUS
// ============================================
const char* ECUManager::getStateString() {
  switch (_state) {
    case ECU_DISCONNECTED: return "DISCONNECTED";
    case ECU_CONNECTING:   return "CONNECTING";
    case ECU_CONNECTED:    return "CONNECTED";
    case ECU_ERROR:        return "ERROR";
    case ECU_BUSY:         return "BUSY";
    default:               return "UNKNOWN";
  }
}

// ============================================
// HONDA DATA PARSERS
// ============================================

void ECUManager::parseDTCResponse(const uint8_t* data, size_t len, DTCRecord* records, uint8_t* count) {
  // Honda DTC response format:
  // [02] [len] [73] [DTC_high] [DTC_low] [status] ... [checksum]
  *count = 0;
  size_t offset = 3; // Skip header, length, table ID

  while (offset + 2 < len - 1 && *count < MAX_DTC_COUNT) {
    uint8_t dtcHigh = data[offset];
    uint8_t dtcLow  = data[offset + 1];

    if (dtcHigh == 0x00 && dtcLow == 0x00) break; // No more DTCs

    dtcBytesToCode(dtcHigh, dtcLow, records[*count].code);

    // Status byte (if available)
    if (offset + 2 < len - 1) {
      uint8_t statusByte = data[offset + 2];
      records[*count].status = (statusByte & 0x80) ? DTC_ACTIVE : DTC_PENDING;
      offset += 3;
    } else {
      records[*count].status = DTC_ACTIVE;
      offset += 2;
    }

    records[*count].timestamp = millis();
    (*count)++;
  }
}

void ECUManager::parseLiveDataResponse(const uint8_t* data, size_t len, LiveData* out) {
  // Honda live data response parsing
  // Byte positions vary by ECU, this is a common mapping:
  if (len < 10) return;

  size_t d = 3; // Skip header bytes

  // RPM: 2 bytes, raw / 4 = RPM
  if (d + 1 < len) {
    out->rpm = ((int16_t)data[d] << 8 | data[d + 1]) / 4;
    d += 2;
  }

  // TPS: 1 byte, raw * 5.0 / 255
  if (d < len) {
    out->tps_volt = data[d] * 5.0f / 255.0f;
    out->throttle_pos = data[d] * 100 / 255;
    d++;
  }

  // ECT: 1 byte, raw - 40 = °C
  if (d < len) {
    out->ect_celsius = (float)data[d] - 40.0f;
    d++;
  }

  // IAT: 1 byte, raw - 40 = °C
  if (d < len) {
    out->iat_celsius = (float)data[d] - 40.0f;
    d++;
  }

  // MAP: 1 byte, raw = kPa
  if (d < len) {
    out->map_kpa = (float)data[d];
    d++;
  }

  // Battery: 1 byte, raw * 0.0733 = V (approx)
  if (d < len) {
    out->battery_volt = data[d] * 0.0733f;
    d++;
  }

  // Vehicle Speed: 1 byte, raw = km/h
  if (d < len) {
    out->vehicle_speed = data[d];
    d++;
  }

  // O2 sensor: 1 byte, raw * 5.0 / 255
  if (d < len) {
    out->o2_volt = data[d] * 5.0f / 255.0f;
    d++;
  }

  // IACV: 1 byte, raw * 100 / 255
  if (d < len) {
    out->iacv_pct = data[d] * 100 / 255;
    d++;
  }

  // Fuel Trim: 1 byte, (raw - 128) * 100 / 128
  if (d < len) {
    out->fuel_trim_pct = ((float)data[d] - 128.0f) * 100.0f / 128.0f;
    d++;
  }
}

void ECUManager::parseFreezeFrameResponse(const uint8_t* data, size_t len, FreezeFrame* out) {
  if (len < 8) return;
  size_t d = 3;

  // DTC that triggered freeze frame
  if (d + 1 < len) {
    dtcBytesToCode(data[d], data[d + 1], out->dtc_trigger);
    d += 2;
  }

  // RPM at trigger
  if (d + 1 < len) {
    out->rpm_at_trigger = ((int16_t)data[d] << 8 | data[d + 1]) / 4;
    d += 2;
  }

  // ECT at trigger
  if (d < len) {
    out->ect_at_trigger = (float)data[d] - 40.0f;
    d++;
  }

  // IAT at trigger
  if (d < len) {
    out->iat_at_trigger = (float)data[d] - 40.0f;
    d++;
  }

  // Load at trigger
  if (d < len) {
    out->load_at_trigger = data[d] * 100 / 255;
    d++;
  }

  out->timestamp = millis();
}

void ECUManager::parseECUInfoResponse(const uint8_t* data, size_t len, ECUInfo* out) {
  if (len < 10) return;

  // ECU part number is typically ASCII bytes starting at offset 3
  size_t d = 3;
  size_t partLen = 0;

  // Read part number string (until non-printable or end)
  while (d < len - 1 && partLen < sizeof(out->part_number) - 1) {
    if (data[d] >= 0x20 && data[d] <= 0x7E) {
      out->part_number[partLen++] = (char)data[d];
    }
    d++;
  }
  out->part_number[partLen] = '\0';

  // Firmware version (simplified)
  snprintf(out->firmware_ver, sizeof(out->firmware_ver), "%d.%02d",
           (len > d) ? data[d] : 0, (len > d + 1) ? data[d + 1] : 0);
}

void ECUManager::dtcBytesToCode(uint8_t high, uint8_t low, char* codeStr) {
  // Convert 2 bytes to P-code string
  // Bit 15-14: type (00=P, 01=C, 10=B, 11=U)
  // Bit 13-12: second digit
  // Bit 11-8: third digit
  // Bit 7-4: fourth digit
  // Bit 3-0: fifth digit
  uint16_t raw = ((uint16_t)high << 8) | low;

  char typeChar;
  switch ((raw >> 14) & 0x03) {
    case 0: typeChar = 'P'; break;
    case 1: typeChar = 'C'; break;
    case 2: typeChar = 'B'; break;
    case 3: typeChar = 'U'; break;
    default: typeChar = 'P'; break;
  }

  uint8_t d2 = (raw >> 12) & 0x03;
  uint8_t d3 = (raw >> 8) & 0x0F;
  uint8_t d4 = (raw >> 4) & 0x0F;
  uint8_t d5 = raw & 0x0F;

  sprintf(codeStr, "%c%d%X%X%X", typeChar, d2, d3, d4, d5);
}
