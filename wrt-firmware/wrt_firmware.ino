// ============================================
// WRT Garage — ESP32 Main Firmware
// Honda PGM-FI AI Diagnostic Tool v2.0
//
// Board: ESP32 DOIT V1 (Arduino IDE)
// K-Line: 4N35 Optocoupler, 10400 bps
// Bluetooth: Classic SPP
// ============================================

#include <Arduino.h>
#include <BluetoothSerial.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <esp_task_wdt.h>

#include "config.h"
#include "ecu_data.h"
#include "ecu_manager.h"
#include "ring_buffer.h"

// ============================================
// Global Objects
// ============================================
BluetoothSerial SerialBT;
ECUManager ecuManager;
SensorRingBuffer loggerBuffer;

// ---- State Variables ----
volatile bool btConnected = false;
volatile bool loggerRunning = false;
volatile bool ecuPollingActive = false;

LiveData currentLiveData;
DTCRecord dtcRecords[MAX_DTC_COUNT];
uint8_t dtcCount = 0;
FreezeFrame freezeFrame;
ECUInfo ecuInfo;

// ---- FreeRTOS Task Handles ----
TaskHandle_t taskKLine = NULL;
TaskHandle_t taskECUPoll = NULL;
TaskHandle_t taskBTSerial = NULL;
TaskHandle_t taskLogger = NULL;

// ---- Semaphore ----
SemaphoreHandle_t klineMutex;

// ============================================
// BLUETOOTH CALLBACKS
// ============================================
void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  switch (event) {
    case ESP_SPP_SRV_OPEN_EVT:
      btConnected = true;
      Serial.println("[BT] Client connected");
      digitalWrite(LED_STATUS_PIN, HIGH);
      break;
    case ESP_SPP_CLOSE_EVT:
      btConnected = false;
      Serial.println("[BT] Client disconnected");
      digitalWrite(LED_STATUS_PIN, LOW);
      break;
    default:
      break;
  }
}

// ============================================
// SEND JSON RESPONSE VIA BLUETOOTH
// ============================================
void sendBTResponse(const char* type, JsonDocument& doc) {
  if (!btConnected) return;

  doc["type"] = type;
  doc["ts"] = millis();

  String output;
  serializeJson(doc, output);
  output += "\n"; // Delimiter for mobile app parser

  SerialBT.print(output);
}

void sendBTError(const char* message) {
  JsonDocument doc;
  doc["error"] = message;
  sendBTResponse("error", doc);
}

void sendBTStatus() {
  JsonDocument doc;
  doc["ecu_state"] = ecuManager.getStateString();
  doc["ecu_connected"] = ecuManager.isConnected();
  doc["bt_connected"] = btConnected;
  doc["logger_running"] = loggerRunning;
  doc["logger_samples"] = loggerBuffer.count();
  doc["firmware"] = FW_VERSION;
  doc["uptime_ms"] = millis();

  if (ecuManager.isConnected()) {
    doc["ecu_part"] = ecuInfo.part_number;
    doc["ecu_fw"] = ecuInfo.firmware_ver;
  }

  sendBTResponse("status", doc);
}

// ============================================
// PROCESS BLUETOOTH COMMANDS
// ============================================
void processCommand(const String& input) {
  JsonDocument cmdDoc;
  DeserializationError err = deserializeJson(cmdDoc, input);

  if (err) {
    sendBTError("Invalid JSON command");
    return;
  }

  const char* cmd = cmdDoc["cmd"];
  if (!cmd) {
    sendBTError("Missing 'cmd' field");
    return;
  }

  // ---- Connect ECU ----
  if (strcmp(cmd, "connect") == 0) {
    int mode = cmdDoc["mode"] | INIT_AUTO;
    bool success = false;

    if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(5000))) {
      success = ecuManager.connect((InitMode)mode);
      if (success) {
        ecuManager.readECUInfo(&ecuInfo);
        ecuPollingActive = true;
      }
      xSemaphoreGive(klineMutex);
    }

    JsonDocument doc;
    doc["success"] = success;
    if (success) {
      doc["part_number"] = ecuInfo.part_number;
      doc["firmware"] = ecuInfo.firmware_ver;
    }
    sendBTResponse("connect_result", doc);
  }

  // ---- Disconnect ECU ----
  else if (strcmp(cmd, "disconnect") == 0) {
    ecuPollingActive = false;
    if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(2000))) {
      ecuManager.disconnect();
      xSemaphoreGive(klineMutex);
    }
    JsonDocument doc;
    doc["success"] = true;
    sendBTResponse("disconnect_result", doc);
  }

  // ---- Read DTC ----
  else if (strcmp(cmd, "read_dtc") == 0) {
    bool success = false;
    if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(5000))) {
      success = ecuManager.readDTC(dtcRecords, &dtcCount);
      xSemaphoreGive(klineMutex);
    }

    JsonDocument doc;
    doc["success"] = success;
    doc["count"] = dtcCount;
    JsonArray arr = doc["dtc"].to<JsonArray>();
    for (int i = 0; i < dtcCount; i++) {
      JsonObject obj = arr.add<JsonObject>();
      obj["code"] = dtcRecords[i].code;
      obj["status"] = (dtcRecords[i].status == DTC_ACTIVE) ? "active" : "pending";
    }
    sendBTResponse("dtc_result", doc);
  }

  // ---- Clear DTC ----
  else if (strcmp(cmd, "clear_dtc") == 0) {
    bool success = false;
    if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(5000))) {
      success = ecuManager.clearDTC();
      xSemaphoreGive(klineMutex);
    }
    JsonDocument doc;
    doc["success"] = success;
    sendBTResponse("clear_dtc_result", doc);
  }

  // ---- Read Live Data (single snapshot) ----
  else if (strcmp(cmd, "read_live") == 0) {
    JsonDocument doc;
    doc["success"] = ecuManager.isConnected();
    JsonObject d = doc["data"].to<JsonObject>();
    d["rpm"] = currentLiveData.rpm;
    d["tps"] = currentLiveData.tps_volt;
    d["ect"] = currentLiveData.ect_celsius;
    d["iat"] = currentLiveData.iat_celsius;
    d["map"] = currentLiveData.map_kpa;
    d["o2"] = currentLiveData.o2_volt;
    d["battery"] = currentLiveData.battery_volt;
    d["iacv"] = currentLiveData.iacv_pct;
    d["fuel_trim"] = currentLiveData.fuel_trim_pct;
    d["speed"] = currentLiveData.vehicle_speed;
    sendBTResponse("live_data", doc);
  }

  // ---- Read Freeze Frame ----
  else if (strcmp(cmd, "read_freeze") == 0) {
    bool success = false;
    if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(5000))) {
      success = ecuManager.readFreezeFrame(&freezeFrame);
      xSemaphoreGive(klineMutex);
    }
    JsonDocument doc;
    doc["success"] = success;
    if (success) {
      JsonObject f = doc["data"].to<JsonObject>();
      f["dtc_trigger"] = freezeFrame.dtc_trigger;
      f["rpm"] = freezeFrame.rpm_at_trigger;
      f["ect"] = freezeFrame.ect_at_trigger;
      f["iat"] = freezeFrame.iat_at_trigger;
      f["load"] = freezeFrame.load_at_trigger;
    }
    sendBTResponse("freeze_frame", doc);
  }

  // ---- ECU Info ----
  else if (strcmp(cmd, "ecu_info") == 0) {
    JsonDocument doc;
    doc["success"] = ecuManager.isConnected();
    doc["part_number"] = ecuInfo.part_number;
    doc["firmware"] = ecuInfo.firmware_ver;
    doc["state"] = ecuManager.getStateString();
    sendBTResponse("ecu_info", doc);
  }

  // ---- Start Logger ----
  else if (strcmp(cmd, "start_logger") == 0) {
    loggerBuffer.clear();
    loggerRunning = true;
    JsonDocument doc;
    doc["success"] = true;
    doc["message"] = "Logger started";
    sendBTResponse("logger_result", doc);
  }

  // ---- Stop Logger ----
  else if (strcmp(cmd, "stop_logger") == 0) {
    loggerRunning = false;
    JsonDocument doc;
    doc["success"] = true;
    doc["samples"] = loggerBuffer.count();
    sendBTResponse("logger_result", doc);
  }

  // ---- Export Logger CSV ----
  else if (strcmp(cmd, "export_log") == 0) {
    JsonDocument doc;
    doc["success"] = true;
    doc["total_samples"] = loggerBuffer.count();

    // Send CSV header
    SerialBT.println("timestamp,rpm,ect,iat,map,tps,o2,battery,iacv,fuel_trim");

    // Send samples
    LoggerSample sample;
    for (uint16_t i = 0; i < loggerBuffer.count(); i++) {
      if (loggerBuffer.getAt(i, &sample)) {
        char line[128];
        snprintf(line, sizeof(line), "%lu,%d,%d,%d,%d,%d,%d,%d,%d,%d",
                 sample.timestamp_ms, sample.rpm, sample.ect, sample.iat,
                 sample.map, sample.tps_raw, sample.o2_raw, sample.battery_raw,
                 sample.iacv_pct, sample.fuel_trim);
        SerialBT.println(line);
      }
    }
    sendBTResponse("export_complete", doc);
  }

  // ---- Raw Terminal ----
  else if (strcmp(cmd, "raw") == 0) {
    const char* hexStr = cmdDoc["hex"];
    if (!hexStr) {
      sendBTError("Missing 'hex' field");
      return;
    }

    // Parse hex string to bytes
    uint8_t txBuf[64];
    size_t txLen = 0;
    String hex = String(hexStr);
    hex.replace(" ", "");
    for (size_t i = 0; i + 1 < hex.length() && txLen < 64; i += 2) {
      txBuf[txLen++] = (uint8_t)strtol(hex.substring(i, i + 2).c_str(), NULL, 16);
    }

    uint8_t rxBuf[64];
    int rxLen = 0;
    if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(5000))) {
      rxLen = ecuManager.sendRawCommand(txBuf, txLen, rxBuf, sizeof(rxBuf));
      xSemaphoreGive(klineMutex);
    }

    JsonDocument doc;
    doc["tx_len"] = txLen;

    String txHex = "";
    for (size_t i = 0; i < txLen; i++) {
      char buf[4]; snprintf(buf, 4, "%02X ", txBuf[i]);
      txHex += buf;
    }
    doc["tx"] = txHex;

    doc["rx_len"] = rxLen;
    String rxHex = "";
    for (int i = 0; i < rxLen; i++) {
      char buf[4]; snprintf(buf, 4, "%02X ", rxBuf[i]);
      rxHex += buf;
    }
    doc["rx"] = rxHex;
    sendBTResponse("raw_result", doc);
  }

  // ---- Get Status ----
  else if (strcmp(cmd, "status") == 0) {
    sendBTStatus();
  }

  // ---- Ping ----
  else if (strcmp(cmd, "ping") == 0) {
    JsonDocument doc;
    doc["pong"] = true;
    doc["fw"] = FW_VERSION;
    sendBTResponse("pong", doc);
  }

  // ---- Unknown Command ----
  else {
    sendBTError("Unknown command");
  }
}

// ============================================
// FreeRTOS TASKS
// ============================================

// ---- Task: BT Serial Manager (Core 1) ----
void taskBTSerialFunc(void* param) {
  String inputBuffer = "";

  while (true) {
    // Read incoming BT data
    while (SerialBT.available()) {
      char c = SerialBT.read();
      if (c == '\n' || c == '\r') {
        if (inputBuffer.length() > 0) {
          processCommand(inputBuffer);
          inputBuffer = "";
        }
      } else {
        inputBuffer += c;
        if (inputBuffer.length() > 2048) {
          inputBuffer = ""; // Prevent overflow
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ---- Task: ECU Poller (Core 0) ----
void taskECUPollFunc(void* param) {
  while (true) {
    if (ecuPollingActive && ecuManager.isConnected()) {
      if (xSemaphoreTake(klineMutex, pdMS_TO_TICKS(1000))) {
        // Read live data
        ecuManager.readLiveData(&currentLiveData);

        // Keep-alive
        ecuManager.sendKeepAlive();

        xSemaphoreGive(klineMutex);

        // Stream live data to BT if connected
        if (btConnected) {
          JsonDocument doc;
          JsonObject d = doc["data"].to<JsonObject>();
          d["rpm"] = currentLiveData.rpm;
          d["tps"] = currentLiveData.tps_volt;
          d["ect"] = currentLiveData.ect_celsius;
          d["iat"] = currentLiveData.iat_celsius;
          d["map"] = currentLiveData.map_kpa;
          d["o2"] = currentLiveData.o2_volt;
          d["battery"] = currentLiveData.battery_volt;
          d["iacv"] = currentLiveData.iacv_pct;
          d["fuel_trim"] = currentLiveData.fuel_trim_pct;
          d["speed"] = currentLiveData.vehicle_speed;
          sendBTResponse("live_data", doc);
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(ECU_POLL_INTERVAL_MS));
  }
}

// ---- Task: Data Logger (Core 0) ----
void taskLoggerFunc(void* param) {
  while (true) {
    if (loggerRunning && ecuManager.isConnected()) {
      LoggerSample sample;
      sample.timestamp_ms = millis();
      sample.rpm = currentLiveData.rpm;
      sample.ect = (int8_t)currentLiveData.ect_celsius;
      sample.iat = (int8_t)currentLiveData.iat_celsius;
      sample.map = (uint8_t)currentLiveData.map_kpa;
      sample.tps_raw = (uint8_t)(currentLiveData.tps_volt * 51.0f); // 0-255
      sample.o2_raw = (uint8_t)(currentLiveData.o2_volt * 255.0f);
      sample.battery_raw = (uint8_t)(currentLiveData.battery_volt * 13.65f);
      sample.iacv_pct = currentLiveData.iacv_pct;
      sample.fuel_trim = (int8_t)currentLiveData.fuel_trim_pct;

      loggerBuffer.push(sample);
    }
    vTaskDelay(pdMS_TO_TICKS(LOGGER_INTERVAL_MS));
  }
}

// ---- Task: Watchdog Monitor (Core 0) ----
void taskWDTFunc(void* param) {
  while (true) {
    esp_task_wdt_reset();

    // Check ECU connection timeout
    if (ecuManager.isConnected()) {
      uint32_t inactivity = millis() - ecuManager.getLastActivityMs();
      if (inactivity > 10000) { // 10 seconds without activity
        Serial.println("[WDT] ECU inactivity timeout, disconnecting...");
        ecuPollingActive = false;
        ecuManager.disconnect();
      }
    }

    // LED heartbeat
    static uint32_t lastBlink = 0;
    if (millis() - lastBlink > 1000) {
      if (!btConnected) {
        digitalWrite(LED_STATUS_PIN, !digitalRead(LED_STATUS_PIN));
      }
      lastBlink = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("============================================");
  Serial.println("  WRT Garage — ESP32 Firmware v" FW_VERSION);
  Serial.println("  Honda PGM-FI AI Diagnostic Tool");
  Serial.println("============================================");

  // LED setup
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(LED_ERROR_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);
  digitalWrite(LED_ERROR_PIN, LOW);

  // LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("[FS] LittleFS mount failed!");
  } else {
    Serial.println("[FS] LittleFS mounted");
  }

  // Bluetooth SPP
  SerialBT.register_callback(btCallback);
  if (!SerialBT.begin(BT_DEVICE_NAME)) {
    Serial.println("[BT] ❌ Bluetooth init failed!");
    digitalWrite(LED_ERROR_PIN, HIGH);
  } else {
    Serial.printf("[BT] ✅ Bluetooth started as \"%s\"\n", BT_DEVICE_NAME);
  }

  // ECU Manager
  ecuManager.begin();

  // K-Line mutex
  klineMutex = xSemaphoreCreateMutex();

  // Watchdog timer
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
  esp_task_wdt_add(NULL);

  // Create FreeRTOS tasks
  xTaskCreatePinnedToCore(taskBTSerialFunc, "BTSerial", TASK_BT_STACK, NULL, TASK_BT_PRIORITY, &taskBTSerial, 1);
  xTaskCreatePinnedToCore(taskECUPollFunc, "ECUPoll", TASK_ECUPOLL_STACK, NULL, TASK_ECUPOLL_PRIORITY, &taskECUPoll, 0);
  xTaskCreatePinnedToCore(taskLoggerFunc, "Logger", TASK_LOGGER_STACK, NULL, TASK_LOGGER_PRIORITY, &taskLogger, 0);
  xTaskCreatePinnedToCore(taskWDTFunc, "WDT", TASK_WDT_STACK, NULL, TASK_WDT_PRIORITY, NULL, 0);

  Serial.println("[Setup] ✅ All tasks created. System ready!");
  Serial.println("[Setup] Waiting for Bluetooth connection...");
}

// ============================================
// LOOP (unused — all work done in FreeRTOS tasks)
// ============================================
void loop() {
  esp_task_wdt_reset();
  vTaskDelay(pdMS_TO_TICKS(1000));
}
