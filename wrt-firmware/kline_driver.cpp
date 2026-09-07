// ============================================
// WRT Garage — K-Line Driver Implementation
// Physical layer for Honda PGM-FI K-Line
// via 4N35 Optocoupler, UART2, 10400 bps
// ============================================
#include "kline_driver.h"

KLineDriver::KLineDriver() : _connected(false), _initMode(0), _lastActivity(0) {}

void KLineDriver::begin() {
  // Configure K-Line TX pin for manual bit-banging during init
  pinMode(KLINE_TX_PIN, OUTPUT);
  digitalWrite(KLINE_TX_PIN, HIGH); // Idle state = HIGH

  // Don't start Serial2 yet; start after init sequence
  Serial.println("[KLine] Driver initialized");
}

// ============================================
// FAST INIT (ISO 14230-2)
// Used by most Honda PGM-FI ECUs (2012+)
// ============================================
bool KLineDriver::fastInit() {
  Serial.println("[KLine] Starting Fast Init...");

  // End any existing UART session
  Serial2.end();
  delay(50);

  // Step 1: Send 25ms LOW + 25ms HIGH wake-up pattern
  pinMode(KLINE_TX_PIN, OUTPUT);
  setKLineLow();
  delay(KLINE_FAST_INIT_LOW_MS);
  setKLineHigh();
  delay(KLINE_FAST_INIT_HIGH_MS);

  // Step 2: Start UART at 10400 bps
  Serial2.begin(KLINE_BAUDRATE, SERIAL_8N1, KLINE_RX_PIN, KLINE_TX_PIN);
  delay(20);

  // Step 3: Send Honda init bytes
  // Honda Fast Init: [FE 04 FF FF]
  // FE = format byte (functional addressing, 4 data bytes)
  // 04 = target (ECU broadcast)
  // FF = start diagnostic session
  uint8_t initCmd[] = { 0xFE, 0x04, 0xFF, 0xFF };
  initCmd[3] = calcChecksum(initCmd, 3); // Recalculate checksum

  flushRx();
  sendBytes(initCmd, sizeof(initCmd));

  // Step 4: Wait for ECU response
  uint8_t response[16];
  int rxLen = readBytes(response, sizeof(response), KLINE_TIMEOUT_MS);

  if (rxLen > 0) {
    Serial.printf("[KLine] Fast Init response: %d bytes => ", rxLen);
    for (int i = 0; i < rxLen; i++) Serial.printf("%02X ", response[i]);
    Serial.println();

    _connected = true;
    _initMode = INIT_FAST;
    _lastActivity = millis();
    Serial.println("[KLine] ✅ Fast Init SUCCESS");
    return true;
  }

  Serial.println("[KLine] ❌ Fast Init FAILED (no response)");
  _connected = false;
  return false;
}

// ============================================
// 5-BAUD INIT (ISO 9141-2)
// Fallback for older Honda ECUs (Supra X 125 Gen1)
// ============================================
bool KLineDriver::fiveBaudInit() {
  Serial.println("[KLine] Starting 5-Baud Init...");

  Serial2.end();
  delay(50);

  // Step 1: Send address 0x33 at 5 baud (200ms per bit)
  pinMode(KLINE_TX_PIN, OUTPUT);
  setKLineHigh();
  delay(300);

  sendByte5Baud(0x33); // ISO 9141 init address

  // Step 2: Switch to 10400 baud UART
  Serial2.begin(KLINE_BAUDRATE, SERIAL_8N1, KLINE_RX_PIN, KLINE_TX_PIN);
  delay(20);

  // Step 3: Wait for ECU keyword bytes (0x55, KW1, KW2)
  uint8_t response[8];
  int rxLen = readBytes(response, sizeof(response), 3000);

  if (rxLen >= 3 && response[0] == 0x55) {
    Serial.printf("[KLine] 5-Baud sync: 0x55, KW1=0x%02X, KW2=0x%02X\n",
                  response[1], response[2]);

    // Step 4: Send inverted KW2 as acknowledgment
    delay(30);
    uint8_t ack = ~response[2];
    sendBytes(&ack, 1);

    // Step 5: Wait for ECU ack (inverted address)
    int ackLen = readBytes(response, 1, 1000);
    if (ackLen > 0) {
      _connected = true;
      _initMode = INIT_5BAUD;
      _lastActivity = millis();
      Serial.println("[KLine] ✅ 5-Baud Init SUCCESS");
      return true;
    }
  }

  Serial.println("[KLine] ❌ 5-Baud Init FAILED");
  _connected = false;
  return false;
}

// ============================================
// AUTO-DETECT INIT
// Try Fast Init first, fallback to 5-Baud
// ============================================
bool KLineDriver::autoDetectInit() {
  Serial.println("[KLine] Auto-detect init...");

  // Attempt 1: Fast Init (most common)
  if (fastInit()) return true;
  delay(500);

  // Attempt 2: 5-Baud Init (fallback)
  if (fiveBaudInit()) return true;
  delay(500);

  // Attempt 3: Fast Init with inverted polarity (some adapters)
  Serial.println("[KLine] Retrying Fast Init...");
  if (fastInit()) return true;

  Serial.println("[KLine] ❌ Auto-detect FAILED — all init modes exhausted");
  return false;
}

// ============================================
// DATA TRANSFER
// ============================================
bool KLineDriver::sendBytes(const uint8_t* data, size_t len) {
  if (!Serial2) return false;

  for (size_t i = 0; i < len; i++) {
    Serial2.write(data[i]);
    delay(KLINE_INTER_BYTE_MS); // Inter-byte delay
  }
  Serial2.flush();
  _lastActivity = millis();
  return true;
}

int KLineDriver::readBytes(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs) {
  uint32_t start = millis();
  size_t idx = 0;

  while ((millis() - start) < timeoutMs && idx < maxLen) {
    if (Serial2.available()) {
      buffer[idx++] = Serial2.read();
      start = millis(); // Reset timeout on each byte received
    } else {
      // Small delay to avoid busy-waiting
      delayMicroseconds(100);
    }
  }

  if (idx > 0) _lastActivity = millis();
  return idx;
}

bool KLineDriver::sendAndReceive(const uint8_t* txData, size_t txLen,
                                  uint8_t* rxBuffer, size_t* rxLen,
                                  uint32_t timeoutMs) {
  flushRx();

  if (!sendBytes(txData, txLen)) return false;

  // Skip echo bytes (K-Line is half-duplex, we receive our own TX)
  uint8_t echo[64];
  readBytes(echo, txLen, 100);

  // Read actual response
  *rxLen = readBytes(rxBuffer, 64, timeoutMs);
  return (*rxLen > 0);
}

// ============================================
// HONDA PROTOCOL FRAMING
// ============================================
bool KLineDriver::sendHondaRequest(uint8_t tableId, uint8_t subId,
                                    const uint8_t* extra, size_t extraLen) {
  // Honda frame format:
  // [Header] [Length] [TableID] [SubID] [Extra...] [Checksum]
  uint8_t frame[32];
  size_t idx = 0;

  uint8_t dataLen = 2 + extraLen; // tableId + subId + extra
  frame[idx++] = 0x72;            // Honda request header
  frame[idx++] = dataLen + 2;     // Length (including header + length + checksum)
  frame[idx++] = tableId;
  frame[idx++] = subId;

  if (extra && extraLen > 0) {
    memcpy(&frame[idx], extra, extraLen);
    idx += extraLen;
  }

  frame[idx] = calcChecksum(frame, idx);
  idx++;

  return sendBytes(frame, idx);
}

int KLineDriver::readHondaResponse(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs) {
  int len = readBytes(buffer, maxLen, timeoutMs);

  if (len < 3) return -1; // Too short

  // Verify checksum
  uint8_t expected = calcChecksum(buffer, len - 1);
  if (buffer[len - 1] != expected) {
    Serial.printf("[KLine] Checksum error: got 0x%02X, expected 0x%02X\n",
                  buffer[len - 1], expected);
    return -2; // Checksum error
  }

  return len;
}

// ============================================
// UTILITIES
// ============================================
uint8_t KLineDriver::calcChecksum(const uint8_t* data, size_t len) {
  uint16_t sum = 0;
  for (size_t i = 0; i < len; i++) {
    sum += data[i];
  }
  return (uint8_t)(sum & 0xFF); // Honda uses simple sum mod 256
}

void KLineDriver::disconnect() {
  _connected = false;
  Serial2.end();
  Serial.println("[KLine] Disconnected");
}

void KLineDriver::flushRx() {
  while (Serial2.available()) Serial2.read();
}

// ---- Private: Bit-bang helpers for init ----
void KLineDriver::setKLineLow() {
  digitalWrite(KLINE_TX_PIN, LOW);
}

void KLineDriver::setKLineHigh() {
  digitalWrite(KLINE_TX_PIN, HIGH);
}

void KLineDriver::sendByte5Baud(uint8_t b) {
  // 5 baud = 200ms per bit
  // Start bit (LOW)
  setKLineLow();
  delay(KLINE_5BAUD_BIT_MS);

  // 8 data bits (LSB first)
  for (int i = 0; i < 8; i++) {
    if (b & (1 << i)) {
      setKLineHigh();
    } else {
      setKLineLow();
    }
    delay(KLINE_5BAUD_BIT_MS);
  }

  // Stop bit (HIGH)
  setKLineHigh();
  delay(KLINE_5BAUD_BIT_MS);
}
