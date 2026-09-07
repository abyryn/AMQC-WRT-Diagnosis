// ============================================
// WRT Garage — ECU Data Structures
// Honda PGM-FI data types
// ============================================
#ifndef ECU_DATA_H
#define ECU_DATA_H

#include <Arduino.h>

// ---- Connection State ----
enum ECUState {
  ECU_DISCONNECTED = 0,
  ECU_CONNECTING,
  ECU_CONNECTED,
  ECU_ERROR,
  ECU_BUSY
};

// ---- Init Mode ----
enum InitMode {
  INIT_FAST = 0,
  INIT_5BAUD,
  INIT_AUTO
};

// ---- DTC Status ----
enum DTCStatus {
  DTC_ACTIVE = 0,
  DTC_PENDING,
  DTC_CLEARED
};

// ---- DTC Record ----
struct DTCRecord {
  char code[8];        // "P0113", "P0562", etc.
  DTCStatus status;
  uint32_t timestamp;
};

// ---- Live Sensor Data ----
struct LiveData {
  uint32_t timestamp_ms;
  int16_t  rpm;
  float    tps_volt;      // 0.0 - 5.0 V
  float    map_kpa;       // 0 - 100 kPa
  float    iat_celsius;   // -40 to 120 °C
  float    ect_celsius;   // -40 to 130 °C
  float    o2_volt;       // 0.0 - 1.0 V
  float    battery_volt;  // 0 - 20 V
  uint8_t  iacv_pct;      // 0 - 100 %
  float    fuel_trim_pct; // -25 to +25 %
  uint16_t vehicle_speed; // 0 - 200 km/h
  uint8_t  throttle_pos;  // 0 - 100 %
};

// ---- Freeze Frame ----
struct FreezeFrame {
  char     dtc_trigger[8];
  int16_t  rpm_at_trigger;
  float    ect_at_trigger;
  float    iat_at_trigger;
  uint8_t  load_at_trigger;
  float    tps_at_trigger;
  float    battery_at_trigger;
  uint32_t timestamp;
};

// ---- ECU Info ----
struct ECUInfo {
  char     part_number[20];    // "38770-K1Z-B01"
  char     firmware_ver[12];   // "1.12"
  char     vin[20];            // Vehicle ID (if available)
  uint8_t  protocol;           // 0=KLine
  uint8_t  init_mode;          // 0=Fast, 1=5Baud
  bool     connected;
};

// ---- Logger Sample (compact, for ring buffer) ----
struct LoggerSample {
  uint32_t timestamp_ms;
  int16_t  rpm;
  int8_t   ect;           // truncated to integer
  int8_t   iat;
  uint8_t  map;
  uint8_t  tps_raw;       // 0-255, convert to volt in app
  uint8_t  o2_raw;
  uint8_t  battery_raw;
  uint8_t  iacv_pct;
  int8_t   fuel_trim;
};

// ---- Command Packet (BT Serial) ----
struct CommandPacket {
  uint8_t  cmd_id;        // Command identifier
  uint8_t  payload_len;
  uint8_t  payload[64];
  uint8_t  checksum;
};

// ---- Command IDs ----
#define CMD_CONNECT_ECU     0x01
#define CMD_DISCONNECT_ECU  0x02
#define CMD_READ_DTC        0x10
#define CMD_CLEAR_DTC       0x11
#define CMD_READ_LIVE       0x20
#define CMD_READ_FREEZE     0x21
#define CMD_READ_ECU_INFO   0x30
#define CMD_START_LOGGER    0x40
#define CMD_STOP_LOGGER     0x41
#define CMD_EXPORT_LOG      0x42
#define CMD_SEND_RAW        0x50  // Manual terminal
#define CMD_GET_STATUS      0x60
#define CMD_GET_SETTINGS    0x70
#define CMD_SET_SETTINGS    0x71
#define CMD_OTA_START       0x80
#define CMD_OTA_DATA        0x81
#define CMD_OTA_FINISH      0x82
#define CMD_PING            0xFE
#define CMD_RESET           0xFF

// ---- Response Status ----
#define RSP_OK              0x00
#define RSP_ERROR           0x01
#define RSP_ECU_DISCONNECTED 0x02
#define RSP_TIMEOUT         0x03
#define RSP_BUSY            0x04
#define RSP_INVALID_CMD     0x05

#endif // ECU_DATA_H
