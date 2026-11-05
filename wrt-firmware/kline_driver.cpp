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
// FAST INIT (HONDA PGM-FI WAKEUP: 70ms LOW / 120ms HIGH)
// Protocol: Honda Keihin K-Line (strategy.md / ISO 14230)
// ============================================
bool KLineDriver::fastInit() {
  Serial.printf("[KLine] Starting Fast Init (Wakeup %dms LOW / %dms HIGH)...\n",
                KLINE_FAST_INIT_LOW_MS, KLINE_FAST_INIT_HIGH_MS);

  const int MAX_RETRIES = 3;

  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      Serial.printf("[KLine] Retrying Fast Init (Attempt %d of %d)...\n", attempt, MAX_RETRIES);
      delay(400);
    }

    // End any existing UART session
    Serial2.end();
    delay(50);

    // Step 1: Pin TX = LOW (70 ms)
    pinMode(KLINE_TX_PIN, OUTPUT);
    setKLineLow();
    delay(KLINE_FAST_INIT_LOW_MS);

    // Step 2: Pin TX = HIGH (120 ms)
    setKLineHigh();
    delay(KLINE_FAST_INIT_HIGH_MS);

    // Step 3: Set Baudrate = 10400 bps (Standard Honda PGM-FI)
    Serial2.begin(KLINE_BAUDRATE, SERIAL_8N1, KLINE_RX_PIN, KLINE_TX_PIN);
    delay(20); // Stabilization delay for UART transceiver

    // Step 4: Wake Up Handshake — Kirim kode [FE 04 72 8C] ke ECU
    const uint8_t wakeupCmd[] = { 0xFE, 0x04, 0x72, 0x8C };
    Serial.println("[KLine] Step 4: Sending Wake Up Handshake [FE 04 72 8C]...");
    flushRx();
    sendBytes(wakeupCmd, sizeof(wakeupCmd));

    uint8_t response[64];
    int rxLen = readBytes(response, sizeof(response), KLINE_TIMEOUT_MS);

    bool wakeupAck = false;
    if (rxLen > 0) {
      Serial.printf("[KLine] ECU Wake Up response: %d bytes => ", rxLen);
      for (int i = 0; i < rxLen; i++) Serial.printf("%02X ", response[i]);
      Serial.println();
      wakeupAck = true;
    }

    // Step 5: Send Initialise code = 72 05 00 F0 99
    delay(30);
    const uint8_t initCmd[] = { 0x72, 0x05, 0x00, 0xF0, 0x99 };
    Serial.println("[KLine] Step 5: Sending Initialise code [72 05 00 F0 99]...");
    flushRx();
    sendBytes(initCmd, sizeof(initCmd));

    rxLen = readBytes(response, sizeof(response), KLINE_TIMEOUT_MS);
    if (rxLen > 0) {
      Serial.printf("[KLine] ECU Initialise response: %d bytes => ", rxLen);
      for (int i = 0; i < rxLen; i++) Serial.printf("%02X ", response[i]);
      Serial.println();

      _connected = true;
      _initMode = INIT_FAST;
      _lastActivity = millis();
      Serial.println("[KLine] ✅ Honda Keihin Fast Init SUCCESS (Full Handshake)");
      return true;
    }

    if (wakeupAck) {
      // ECU merespon kode Wake Up, sesi aktif
      _connected = true;
      _initMode = INIT_FAST;
      _lastActivity = millis();
      Serial.println("[KLine] ✅ Fast Init SUCCESS (Wake Up ACK)");
      return true;
    }

    // Fallback: Format Alternatif Honda HDS Wakeup [72 05 00 00 89]
    Serial.println("[KLine] Fallback: Trying Honda HDS Handshake [72 05 00 00 89]...");
    uint8_t hdsWakeup[] = { 0x72, 0x05, 0x00, 0x00, 0x89 };
    flushRx();
    sendBytes(hdsWakeup, sizeof(hdsWakeup));
    rxLen = readBytes(response, sizeof(response), 800);
    if (rxLen > 0) {
      Serial.printf("[KLine] HDS Wakeup response: %d bytes => ", rxLen);
      for (int i = 0; i < rxLen; i++) Serial.printf("%02X ", response[i]);
      Serial.println();

      _connected = true;
      _initMode = INIT_FAST;
      _lastActivity = millis();
      Serial.println("[KLine] ✅ Fast Init SUCCESS (HDS Handshake)");
      return true;
    }

    // Fallback: Langsung minta data awal (Table 0x71 Sub 0x00)
    Serial.println("[KLine] Fallback: Trying Direct Data Request (Table 0x71 Sub 0x00)...");
    flushRx();
    sendHondaRequest(HONDA_TABLE_LIVE, 0x00);
    rxLen = readBytes(response, sizeof(response), KLINE_TIMEOUT_MS);
    if (rxLen > 5) {
      _connected = true;
      _initMode = INIT_FAST;
      _lastActivity = millis();
      Serial.println("[KLine] ✅ Fast Init SUCCESS (Direct Data Request Handshake)");
      return true;
    }
  }

  Serial.println("[KLine] ❌ Fast Init FAILED (no response from ECU)");
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

  frame[idx] = calcChecksum(frame, idx, true);
  idx++;

  return sendBytes(frame, idx);
}

int KLineDriver::readHondaResponse(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs) {
  int len = readBytes(buffer, maxLen, timeoutMs);

  if (len < 3) return -1; // Too short

  // Verify checksum: Honda PGM-FI two's complement or simple sum fallback
  uint8_t expected2Comp = calcChecksum(buffer, len - 1, true);
  uint8_t expectedSimple = calcChecksum(buffer, len - 1, false);

  if (buffer[len - 1] != expected2Comp && buffer[len - 1] != expectedSimple) {
    Serial.printf("[KLine] Checksum error: got 0x%02X, expected 0x%02X\n",
                  buffer[len - 1], expected2Comp);
    return -2; // Checksum error
  }

  return len;
}

// ============================================
// UTILITIES
// ============================================
uint8_t KLineDriver::calcChecksum(const uint8_t* data, size_t len, bool twoComplement) {
  uint16_t sum = 0;
  for (size_t i = 0; i < len; i++) {
    sum += data[i];
  }
  if (twoComplement) {
    return (uint8_t)((0x100 - (sum & 0xFF)) & 0xFF);
  }
  return (uint8_t)(sum & 0xFF);
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
