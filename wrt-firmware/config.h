// ============================================
// WRT Garage — ESP32 Configuration
// Honda PGM-FI AI Diagnostic Tool
// ============================================
#ifndef CONFIG_H
#define CONFIG_H

// ---- Firmware Version ----
#define FW_VERSION      "2.0.0"
#define FW_BUILD_DATE   __DATE__
#define DEVICE_NAME     "WRT-Garage"

// ---- Pin Assignments ----
// K-Line UART (via 4N35 Optocoupler)
#define KLINE_TX_PIN    17    // ESP32 GPIO17 -> UART2 TX -> 4N35 -> K-Line
#define KLINE_RX_PIN    16    // ESP32 GPIO16 -> UART2 RX <- 4N35 <- K-Line
#define KLINE_BAUDRATE  10400 // Honda PGM-FI K-Line baud rate

// Status LEDs
#define LED_STATUS_PIN  2     // Built-in LED (connection status)
#define LED_ERROR_PIN   4     // External LED (error indicator)

// ---- Bluetooth ----
#define BT_DEVICE_NAME  "WRT-Garage-ECU"
#define BT_SPP_UUID     "00001101-0000-1000-8000-00805F9B34FB"

// ---- K-Line Protocol ----
#define KLINE_FAST_INIT_LOW_MS    25    // Fast init: LOW duration
#define KLINE_FAST_INIT_HIGH_MS   25    // Fast init: HIGH duration
#define KLINE_5BAUD_BIT_MS        200   // 5-baud init: bit duration (5bps = 200ms/bit)
#define KLINE_TIMEOUT_MS          2000  // Response timeout
#define KLINE_RETRY_COUNT         3     // Max retries before fail
#define KLINE_RETRY_DELAY_MS      300   // Delay between retries
#define KLINE_KEEPALIVE_MS        2000  // Keep-alive interval
#define KLINE_INTER_BYTE_MS       5     // Inter-byte delay for TX

// ---- Honda PGM-FI Addresses ----
#define HONDA_ECU_ADDR      0x12  // ECU address
#define HONDA_TESTER_ADDR   0xF1  // Tester/scanner address

// ---- Honda Table IDs ----
#define HONDA_TABLE_DTC       0x73  // Read DTC
#define HONDA_TABLE_CLEAR_DTC 0x74  // Clear DTC
#define HONDA_TABLE_LIVE      0x71  // Read live data (Table D1)
#define HONDA_TABLE_ECU_INFO  0x71  // Read ECU info
#define HONDA_TABLE_FREEZE    0x75  // Read Freeze Frame

// ---- Data Logger ----
#define LOGGER_BUFFER_SIZE    500   // Ring buffer capacity (samples)
#define LOGGER_SENSOR_COUNT   10    // Number of sensors logged
#define LOGGER_INTERVAL_MS    200   // Logging interval (5 Hz)
#define LOGGER_FILENAME       "/log/datalog.csv"

// ---- LittleFS ----
#define SETTINGS_FILE         "/conf/settings.json"
#define ERROR_LOG_FILE        "/log/errors.log"

// ---- FreeRTOS Task Config ----
#define TASK_KLINE_STACK      8192
#define TASK_KLINE_PRIORITY   5
#define TASK_ECUPOLL_STACK    4096
#define TASK_ECUPOLL_PRIORITY 4
#define TASK_BT_STACK         4096
#define TASK_BT_PRIORITY      3
#define TASK_CMD_STACK        4096
#define TASK_CMD_PRIORITY     2
#define TASK_LOGGER_STACK     4096
#define TASK_LOGGER_PRIORITY  2
#define TASK_OTA_STACK        6144
#define TASK_OTA_PRIORITY     1
#define TASK_WDT_STACK        2048
#define TASK_WDT_PRIORITY     6

// ---- Watchdog ----
#define WDT_TIMEOUT_S         30    // Watchdog timeout in seconds

// ---- ECU Poll ----
#define ECU_POLL_INTERVAL_MS  200   // Live data poll interval (5 Hz)
#define ECU_LIVE_DATA_SIZE    16    // Expected live data response size

// ---- OTA ----
#define OTA_PARTITION_SIZE    0x200000  // 2MB partition

#endif // CONFIG_H
