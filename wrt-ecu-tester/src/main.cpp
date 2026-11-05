// =============================================================================
// WRT Garage — Honda PGM-FI ECU Connectivity Tester
// PlatformIO / ESP32 Test Firmware
//
// Board: ESP32 DOIT DevKit V1
// Hardware: 4N35 Optocoupler / K-Line Transceiver
// Default Pins: GPIO17 (TX) -> 4N35 -> K-Line (12V)
//               GPIO16 (RX) <- 4N35 <- K-Line (12V)
// Serial Monitor: 115200 Baud
// =============================================================================

#include <Arduino.h>

// ---- Pin Configuration ----
#define KLINE_TX_PIN      17    // ESP32 GPIO17 -> Opto TX -> K-Line
#define KLINE_RX_PIN      16    // ESP32 GPIO16 <- Opto RX <- K-Line
#define LED_PIN           2     // Built-in LED (GPIO2)
#define KLINE_BAUDRATE    10400 // Honda PGM-FI Standard Baudrate

// ---- Protocol Timings (Honda Keihin Protocol - strategy.md) ----
#define KEIHIN_INIT_LOW_MS  70    // Keihin Kline: Pin Tx = Low (70 ms)
#define KEIHIN_INIT_HIGH_MS 120   // Keihin Kline: Pin Tx = High (120 ms)
#define FAST_INIT_LOW_MS    KEIHIN_INIT_LOW_MS
#define FAST_INIT_HIGH_MS   KEIHIN_INIT_HIGH_MS
#define FIVE_BAUD_BIT_MS    200   // ISO 9141-2: 5 bps = 200ms per bit
#define KLINE_TIMEOUT_MS    1500  // Response timeout

// ---- Global State ----
bool isUartInverted = false;
bool ecuConnected = false;
uint32_t lastActivityMs = 0;

// ---- Function Prototypes ----
void printMenu();
void testHardwareLoopback();
bool runFastInit();
bool runFiveBaudInit();
void runAutoDetect();
void readEcuInfo();
void readLiveData();
void parseSensorTable(const uint8_t* rx, int rxLen, uint8_t tableId);
void readDTC();
void runBusSniffer();
void sendCustomHex();
void toggleUartInvert();

uint8_t calcHondaChecksum(const uint8_t* data, size_t len, bool twoComplement = true);
void initUart(uint32_t baud, bool inverted);
void discardEcho(size_t txLen, uint32_t waitMs = 60);
int  readResponse(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs = KLINE_TIMEOUT_MS);
bool sendFrameWithEchoCheck(const uint8_t* txData, size_t len, bool showDebug = true);
void printHex(const char* label, const uint8_t* data, size_t len);

// =============================================================================
// SETUP & LOOP
// =============================================================================
void printMenu() {
  int rxState = digitalRead(KLINE_RX_PIN);
  Serial.println("\n----------------------------------------------------------");
  Serial.printf(" [Status Pin RX GPIO16]: %s\n",
                rxState ? "🟢 HIGH (3.3V - Standby Normal)" : "🔴 LOW (0V - 🚨 PERINGATAN: Terjepit Ground / Terbalik!)");
  Serial.printf(" [Status Mode Invert]  : %s\n", isUartInverted ? "ENABLED (Inverted Logic)" : "DISABLED (Standard 8N1)");
  Serial.println("----------------------------------------------------------");
  Serial.println(" [1] Test Init Honda Keihin (Sesuai strategy.md: 70ms/120ms, FE 04 72 8C)");
  Serial.println(" [2] Test 5-Baud Init (ISO 9141-2) — Untuk Supra X 125 FI KPH lama");
  Serial.println(" [3] Auto-Detect Connection — Coba Keihin Init lalu 5-Baud");
  Serial.println(" [4] Self-Test Rangkaian Optocoupler (Diagnostik DC & Loopback)");
  Serial.println(" [5] Baca Request ECM ID (Table 71 Sub 00 — Sesuai strategy.md)");
  Serial.println(" [6] Baca Live Data Sensor (Table 11 / Table 17 — Sesuai strategy.md)");
  Serial.println(" [7] Baca Diagnostic Trouble Code (DTC Fault Codes)");
  Serial.println(" [8] K-Line Bus Sniffer (Monitor lalu lintas data mentah)");
  Serial.println(" [9] Toggle UART Polarity Invert (Normal / Inverted)");
  Serial.println(" [0] Kirim Custom Hex Frame ke ECU");
  Serial.println(" [m] Tampilkan Menu Ini Lagi");
  Serial.print(" Masukkan pilihan (1-0): ");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  pinMode(KLINE_TX_PIN, OUTPUT);
  digitalWrite(KLINE_TX_PIN, HIGH); // K-Line idle = HIGH (12V)

  pinMode(KLINE_RX_PIN, INPUT_PULLUP);
  int initialRx = digitalRead(KLINE_RX_PIN);

  Serial.println();
  Serial.println("==========================================================");
  Serial.println("  🏍️  WRT GARAGE — HONDA PGM-FI ECU CONNECTIVITY TESTER   ");
  Serial.println("==========================================================");
  Serial.printf("  Hardware       : ESP32 DOIT DevKit V1\n");
  Serial.printf("  K-Line TX      : GPIO %d (Baud: %d)\n", KLINE_TX_PIN, KLINE_BAUDRATE);
  Serial.printf("  K-Line RX      : GPIO %d\n", KLINE_RX_PIN);
  Serial.printf("  Status Level RX: %s\n", initialRx ? "🟢 HIGH (3.3V - Standby Normal)" : "🔴 LOW (0V - AWAS: Terjepit Ground / Terbalik!)");
  Serial.printf("  Status LED     : GPIO %d\n", LED_PIN);
  Serial.printf("  Invert RX      : %s\n", isUartInverted ? "ENABLED (Inverted Logic)" : "DISABLED (Standard 8N1)");
  Serial.println("==========================================================");
  Serial.println("  Pastikan:");
  Serial.println("  1. Kabel DLC 4-pin terhubung ke motor Honda");
  Serial.println("  2. Kunci kontak motor posisi ON (Mesin boleh mati/hidup)");
  Serial.println("  3. Engine Cut-off switch posisi RUN (untuk motor sport)");
  Serial.println("==========================================================");

  initUart(KLINE_BAUDRATE, isUartInverted);
  printMenu();
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    while (Serial.available()) Serial.read(); // Clear remaining chars

    switch (cmd) {
      case '1':
        runFastInit();
        break;
      case '2':
        runFiveBaudInit();
        break;
      case '3':
        runAutoDetect();
        break;
      case '4':
        testHardwareLoopback();
        break;
      case '5':
        readEcuInfo();
        break;
      case '6':
        readLiveData();
        break;
      case '7':
        readDTC();
        break;
      case '8':
        runBusSniffer();
        break;
      case '9':
        toggleUartInvert();
        break;
      case '0':
        sendCustomHex();
        break;
      case 'm':
      case 'M':
        printMenu();
        break;
      case '\r':
      case '\n':
        break;
      default:
        Serial.printf("[!] Pilihan '%c' tidak dikenal. Tekan 'm' untuk menu.\n", cmd);
        break;
    }
    Serial.println("\n--- Tekan tombol menu untuk tes berikutnya (ketik 'm' untuk menu) ---");
  }

  // Heartbeat LED saat terkoneksi
  if (ecuConnected) {
    static uint32_t lastBlink = 0;
    if (millis() - lastBlink > 500) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  }
}

// =============================================================================
// UART & K-LINE LOW-LEVEL DRIVER
// =============================================================================
void initUart(uint32_t baud, bool inverted) {
  Serial2.end();
  delay(30);
  Serial2.begin(baud, SERIAL_8N1, KLINE_RX_PIN, KLINE_TX_PIN, inverted);
  delay(20);
}

void setKLinePinLow() {
  digitalWrite(KLINE_TX_PIN, isUartInverted ? HIGH : LOW);
}

void setKLinePinHigh() {
  digitalWrite(KLINE_TX_PIN, isUartInverted ? LOW : HIGH);
}

void discardEcho(size_t txLen, uint32_t waitMs) {
  uint32_t start = millis();
  size_t count = 0;
  while ((millis() - start) < waitMs && count < txLen) {
    if (Serial2.available()) {
      Serial2.read();
      count++;
    } else {
      delayMicroseconds(100);
    }
  }
}

int readResponse(uint8_t* buffer, size_t maxLen, uint32_t timeoutMs) {
  uint32_t start = millis();
  size_t idx = 0;
  const uint32_t interByteTimeoutMs = 35; // 35ms jeda = frame selesai

  // Tunggu byte pertama dari ECU
  while ((millis() - start) < timeoutMs && !Serial2.available()) {
    delayMicroseconds(100);
  }

  // Jika byte pertama sudah ada, baca seluruh frame hingga jeda inter-byte
  uint32_t lastByteTime = millis();
  while (idx < maxLen && (millis() - lastByteTime) < interByteTimeoutMs) {
    if (Serial2.available()) {
      buffer[idx++] = Serial2.read();
      lastByteTime = millis();
    } else {
      delayMicroseconds(100);
    }
  }

  // Filter proteksi Ghost Data (noise framing error / bus stuck LOW)
  if (idx > 0) {
    bool allZeroOrFF = true;
    for (size_t i = 0; i < idx; i++) {
      if (buffer[i] != 0x00 && buffer[i] != 0xFF) {
        allZeroOrFF = false;
        break;
      }
    }
    if (allZeroOrFF) {
      Serial.printf("  [⚠️ GHOST DATA TERDETEKSI: %d byte]: ", idx);
      for (size_t i = 0; i < idx; i++) Serial.printf("%02X ", buffer[i]);
      Serial.println();
      Serial.println("  🚨 INI BUKAN RESPON ECU! Melainkan UART Framing Error akibat RX terjepit di LOW (0V).");
      Serial.println("     Penyebab: Resistor pull-up 3.3V belum terpasang atau polaritas optocoupler terbalik.");
      return 0; // Abaikan data palsu agar tidak diproses sebagai data sensor
    }
  }

  return idx;
}

bool sendFrameWithEchoCheck(const uint8_t* txData, size_t len, bool showDebug) {
  while (Serial2.available()) Serial2.read(); // Bersihkan buffer RX

  for (size_t i = 0; i < len; i++) {
    Serial2.write(txData[i]);
    delay(3); // Inter-byte delay 3ms sesuai standar K-Line
  }
  Serial2.flush();

  if (showDebug) {
    printHex("TX ➔", txData, len);
  }

  // Verifikasi apakah echo lokal diterima (membuktikan rangkaian opto berfungsi)
  uint8_t echoBuf[64];
  size_t echoCount = 0;
  uint32_t echoStart = millis();

  while ((millis() - echoStart) < 120 && echoCount < len) {
    if (Serial2.available()) {
      echoBuf[echoCount++] = Serial2.read();
    } else {
      delayMicroseconds(100);
    }
  }

  if (showDebug) {
    printHex("ECHO ↩️", echoBuf, echoCount);
  }

  if (echoCount != len) {
    if (showDebug) {
      Serial.printf("  [❌ GAGAL] Echo TX tidak lengkap (%d/%d byte).\n", echoCount, len);
      Serial.println("      Cek: jalur K-Line terhubung & resistor pull-up 510 ohm mendapat 12V.");
    }
    return false;
  }

  // Verifikasi apakah byte echo persis sama dengan byte yang dikirim
  bool isAllZero = true;
  bool match = true;
  for (size_t i = 0; i < len; i++) {
    if (echoBuf[i] != 0x00) isAllZero = false;
    if (echoBuf[i] != txData[i]) match = false;
  }

  if (!match) {
    if (showDebug) {
      if (isAllZero) {
        Serial.println("  [🚨 KRITIS] Echo bernilai SEMUA 00 (0x00)!");
        Serial.println("      Pin RX (GPIO16) tertahan di 0V (LOW terus-menerus).");
        Serial.println("      Periksa resistor pull-up 3.3V pada GPIO16 atau balik polaritas opto (Menu [9]).");
      } else {
        Serial.println("  [⚠️ PERINGATAN] Data Echo TIDAK COCOK dengan data TX!");
        Serial.println("      Kemungkinan optocoupler terlalu lambat merespon (distorsi pulsa).");
      }
    }
    return false;
  }

  return true;
}

void printHex(const char* label, const uint8_t* data, size_t len) {
  Serial.printf("  %s [%d byte]: ", label, len);
  for (size_t i = 0; i < len; i++) {
    Serial.printf("%02X ", data[i]);
  }
  Serial.println();
}

uint8_t calcHondaChecksum(const uint8_t* data, size_t len, bool twoComplement) {
  uint16_t sum = 0;
  for (size_t i = 0; i < len; i++) {
    sum += data[i];
  }
  if (twoComplement) {
    return (uint8_t)((0x100 - (sum & 0xFF)) & 0xFF);
  }
  return (uint8_t)(sum & 0xFF);
}

// =============================================================================
// TEST 1: HONDA KEIHIN INIT (STEPS 1 - strategy.md)
// =============================================================================
bool runFastInit() {
  Serial.println("\n==========================================================");
  Serial.println(">>> [1] MEMULAI HONDA KEIHIN INIT (SESUAI STRATEGY.MD) <<<");
  Serial.println("==========================================================");
  digitalWrite(LED_PIN, HIGH);

  const int MAX_RETRIES = 3;

  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    Serial.printf("\n--- Inisialisasi Keihin: Percobaan %d dari %d ---\n", attempt, MAX_RETRIES);

    // 1. Pin Tx = Low (70 ms)
    Serial2.end();
    delay(50);
    pinMode(KLINE_TX_PIN, OUTPUT);
    Serial.println("  [Point 1] Pin Tx = Low (70 ms)...");
    setKLinePinLow();
    delay(KEIHIN_INIT_LOW_MS);

    // 2. Pin Tx = High (120 ms)
    Serial.println("  [Point 2] Pin Tx = High (120 ms)...");
    setKLinePinHigh();
    delay(KEIHIN_INIT_HIGH_MS);

    // 3. Set Baudrate = 10400 bps
    Serial.println("  [Point 3] Set Baudrate = 10400 bps...");
    initUart(KLINE_BAUDRATE, isUartInverted);
    delay(20);

    // 4. Wake Up with send to ECU code = FE 04 72 8C
    const uint8_t wakeupCmd[] = { 0xFE, 0x04, 0x72, 0x8C };
    Serial.println("  [Point 4] Wake Up: Kirim kode [FE 04 72 8C] ke ECU...");
    if (!sendFrameWithEchoCheck(wakeupCmd, sizeof(wakeupCmd))) {
      Serial.println("  [❌ GAGAL] Echo lokal Wake Up tidak terdeteksi. Periksa sirkuit optocoupler.");
      if (attempt < MAX_RETRIES) {
        Serial.println("  [SOP: Ulangi point 1] Menunggu 400ms sebelum mencoba kembali...");
        delay(400);
        continue;
      } else {
        break;
      }
    }

    // 5. ECU Response with code = 0E 04 72 7C
    Serial.println("  [Point 5] Menunggu respon Wake Up dari ECU (target: 0E 04 72 7C)...");
    uint8_t rxBuffer[64];
    int rxLen = readResponse(rxBuffer, sizeof(rxBuffer), KLINE_TIMEOUT_MS);

    if (rxLen <= 0) {
      Serial.println("  [❌ TIMEOUT] Tidak ada respon dari ECU untuk kode Wake Up.");
      if (attempt < MAX_RETRIES) {
        Serial.println("  [SOP: Ulangi point 1 jika tidak ada respon] Mengulang prosedur inisialisasi...");
        delay(400);
        continue;
      } else {
        break;
      }
    }

    printHex("RX ⬅️", rxBuffer, rxLen);

    const uint8_t expectedWakeup[] = { 0x0E, 0x04, 0x72, 0x7C };
    if (rxLen >= 4 && memcmp(rxBuffer, expectedWakeup, 4) == 0) {
      Serial.println("  [✅ COCOK] Respon ECU Wake Up valid: 0E 04 72 7C");
    } else {
      Serial.println("  [ℹ️ RESPON DITERIMA] Melanjutkan ke pengiriman Initialise code...");
    }

    // Jeda antar-frame
    delay(30);

    // 6. Send Initialise code = 72 05 00 F0 99
    const uint8_t initCmd[] = { 0x72, 0x05, 0x00, 0xF0, 0x99 };
    Serial.println("  [Point 6] Kirim Initialise code [72 05 00 F0 99]...");
    if (!sendFrameWithEchoCheck(initCmd, sizeof(initCmd))) {
      Serial.println("  [❌ GAGAL] Echo lokal Initialise tidak terdeteksi.");
      if (attempt < MAX_RETRIES) {
        Serial.println("  [SOP: Ulangi point 1] Mengulang prosedur inisialisasi...");
        delay(400);
        continue;
      } else {
        break;
      }
    }

    // 7. ECU Response = 02 04 00 FA
    Serial.println("  [Point 7] Menunggu respon Initialise dari ECU (target: 02 04 00 FA)...");
    rxLen = readResponse(rxBuffer, sizeof(rxBuffer), KLINE_TIMEOUT_MS);

    if (rxLen <= 0) {
      Serial.println("  [❌ TIMEOUT] Tidak ada respon dari ECU untuk kode Initialise.");
      if (attempt < MAX_RETRIES) {
        Serial.println("  [SOP: Ulangi point 1] Mengulang prosedur inisialisasi...");
        delay(400);
        continue;
      } else {
        break;
      }
    }

    printHex("RX ⬅️", rxBuffer, rxLen);

    const uint8_t expectedInit[] = { 0x02, 0x04, 0x00, 0xFA };
    if (rxLen >= 4 && memcmp(rxBuffer, expectedInit, 4) == 0) {
      Serial.println("  [✅ COCOK 100%] Respon Initialise ECU valid: 02 04 00 FA");
    } else {
      Serial.println("  [✅ RESPON DITERIMA] Handshake inisialisasi berhasil!");
    }

    Serial.println("\n🎉 [SUKSES BESAR] INISIALISASI HONDA KEIHIN SELESAI!");
    Serial.println("   Koneksi ke ECU aktif. Lanjutkan ke STEPS 2 (Menu [5] Request ECM ID / [6] Live Data).");
    ecuConnected = true;
    lastActivityMs = millis();
    digitalWrite(LED_PIN, HIGH);
    return true;
  }

  Serial.println("\n[❌ INISIALISASI GAGAL] Tidak ada respon dari ECU setelah semua percobaan.");
  Serial.println("  Kemungkinan penyebab:");
  Serial.println("  - Kunci kontak motor belum ON");
  Serial.println("  - Saklar engine cut-off di posisi OFF");
  Serial.println("  - Motor menggunakan protokol 5-Baud (ISO 9141-2, coba Menu [2])");
  Serial.println("  - Polaritas optocoupler terbalik (coba Menu [9] Toggle Invert)");
  Serial.println("  - Jalur 12V DLC atau pull-up 510 ohm belum tersambung");
  ecuConnected = false;
  digitalWrite(LED_PIN, LOW);
  return false;
}

// =============================================================================
// TEST 2: 5-BAUD INIT (ISO 9141-2)
// =============================================================================
void send5BaudBit(uint8_t bitVal) {
  if (bitVal) {
    setKLinePinHigh();
  } else {
    setKLinePinLow();
  }
  delay(FIVE_BAUD_BIT_MS);
}

bool runFiveBaudInit() {
  Serial.println("\n>>> [2] MEMULAI 5-BAUD INIT (ISO 9141-2) <<<");
  Serial.println("  Cocok untuk Honda PGM-FI awal (Supra X 125 FI KPH)...");
  digitalWrite(LED_PIN, HIGH);

  Serial2.end();
  delay(50);

  pinMode(KLINE_TX_PIN, OUTPUT);
  setKLinePinHigh();
  delay(400);

  // Bit-banging address 0x33 pada 5 baud (200ms per bit, total 2 detik)
  Serial.println("  [Step 1] Mengirim address 0x33 pada 5 baud (durasi ~2 detik)...");
  uint8_t addr = 0x33;

  // Start bit (LOW)
  send5BaudBit(0);

  // 8 data bits (LSB first)
  for (int i = 0; i < 8; i++) {
    send5BaudBit((addr >> i) & 0x01);
  }

  // Stop bit (HIGH)
  send5BaudBit(1);

  // Buka UART 10400 bps
  Serial.println("  [Step 2] Beralih ke UART2 10400 bps, menunggu sinyal Sync 0x55...");
  initUart(KLINE_BAUDRATE, isUartInverted);

  uint8_t syncBuf[8];
  int syncLen = readResponse(syncBuf, sizeof(syncBuf), 3000);

  if (syncLen >= 3 && syncBuf[0] == 0x55) {
    Serial.printf("  [✅ SYNC OK] Diterima 0x55, KW1=0x%02X, KW2=0x%02X\n", syncBuf[1], syncBuf[2]);
    printHex("RX ⬅️", syncBuf, syncLen);

    // Kirim Inverted KW2 sebagai konfirmasi
    delay(35);
    uint8_t kw2Inv = ~syncBuf[2];
    Serial.printf("  [Step 3] Mengirim inverted KW2 (0x%02X)...\n", kw2Inv);

    uint8_t ackCmd[] = { kw2Inv };
    sendFrameWithEchoCheck(ackCmd, 1);

    // Tunggu inverted address dari ECU (0xCC)
    uint8_t ackBuf[4];
    int ackLen = readResponse(ackBuf, sizeof(ackBuf), 1500);

    if (ackLen > 0) {
      printHex("RX ⬅️", ackBuf, ackLen);
      Serial.println("  [✅ SUKSES!] 5-BAUD INIT LENGKAP & BERHASIL!");
      ecuConnected = true;
      return true;
    }
  }

  Serial.println("  [❌ GAGAL] ECU tidak mengirim respon 5-baud sync 0x55.");
  ecuConnected = false;
  digitalWrite(LED_PIN, LOW);
  return false;
}

// =============================================================================
// TEST 3: AUTO-DETECT
// =============================================================================
void runAutoDetect() {
  Serial.println("\n>>> [3] AUTO-DETECT PROTOKOL ECU HONDA <<<");
  Serial.println("  Mencoba Keihin Init (SOP strategy.md: 70ms/120ms)...");
  if (runFastInit()) {
    Serial.println("\n  🎯 HASIL AUTO-DETECT: Terkoneksi menggunakan HONDA KEIHIN INIT!");
    return;
  }

  delay(600);
  Serial.println("\n  Keihin Init belum merespon, mencoba 5-Baud Init (ISO 9141-2)...");
  if (runFiveBaudInit()) {
    Serial.println("\n  🎯 HASIL AUTO-DETECT: Terkoneksi menggunakan 5-BAUD INIT!");
    return;
  }

  delay(600);
  Serial.println("\n  Mencoba Keihin Init dengan inversi polaritas UART...");
  isUartInverted = !isUartInverted;
  Serial.printf("  [Info] Polaritas dibalik ke: %s\n", isUartInverted ? "INVERTED" : "NORMAL");
  if (runFastInit()) {
    Serial.println("\n  🎯 HASIL AUTO-DETECT: Terkoneksi dengan POLARITAS INVERTED!");
    return;
  }

  // Kembalikan polaritas semula
  isUartInverted = !isUartInverted;
  Serial.println("\n  ❌ AUTO-DETECT SELESAI: ECU tidak terdeteksi pada semua metode.");
}

// =============================================================================
// TEST 4: HARDWARE LOOPBACK SELF-TEST
// =============================================================================
void testHardwareLoopback() {
  Serial.println("\n==========================================================");
  Serial.println(">>> [4] DIAGNOSTIK HARDWARE & LOOPBACK TEST OPTOCOUPLER <<<");
  Serial.println("==========================================================");

  // ---------------------------------------------------------------------------
  // TAHAP 1: TES LEVEL LOGIKA DC STATIS (Mengabaikan Baudrate)
  // ---------------------------------------------------------------------------
  Serial.println("\n[TAHAP 1] TES LEVEL LOGIKA DC STATIS (Pin Toggle):");
  Serial.println("  Menguji apakah fototransistor optocoupler TX & RX dapat memicu perubahan logika.");
  
  Serial2.end();
  delay(50);
  pinMode(KLINE_TX_PIN, OUTPUT);
  pinMode(KLINE_RX_PIN, INPUT_PULLUP);

  // Tes 1: TX di-set HIGH
  digitalWrite(KLINE_TX_PIN, HIGH);
  delay(15);
  int rxAtTxHigh = digitalRead(KLINE_RX_PIN);
  Serial.printf("  1. TX di-set HIGH (3.3V) ➔ Pin RX (GPIO16) membaca: %s\n",
                rxAtTxHigh ? "🟢 HIGH (3.3V)" : "🔴 LOW (0V)");

  // Tes 2: TX di-set LOW
  digitalWrite(KLINE_TX_PIN, LOW);
  delay(15);
  int rxAtTxLow = digitalRead(KLINE_RX_PIN);
  Serial.printf("  2. TX di-set LOW  (0V)   ➔ Pin RX (GPIO16) membaca: %s\n",
                rxAtTxLow ? "🟢 HIGH (3.3V)" : "🔴 LOW (0V)");

  // Kembalikan TX ke kondisi idle (HIGH)
  digitalWrite(KLINE_TX_PIN, HIGH);

  Serial.println("\n  📊 HASIL DIAGNOSIS TAHAP 1 (ELEKTRIKAL):");
  if (rxAtTxHigh == 0 && rxAtTxLow == 0) {
    Serial.println("  🚨 [KRITIS]: Pin RX (GPIO16) TERJEPIT DI 0V (LOW terus-menerus)!");
    Serial.println("     Penyebab:");
    Serial.println("     1. Resistor pull-up 3.3V pada pin GPIO16 belum terpasang atau putus.");
    Serial.println("     2. Fototransistor RX korsleting ke Ground.");
    Serial.println("     3. Dampak: UART akan menerima ribuan byte [00 00 00 ...] (Framing Error).");
  } else if (rxAtTxHigh == 1 && rxAtTxLow == 1) {
    Serial.println("  🚨 [KRITIS]: Pin RX (GPIO16) TERJEPIT DI 3.3V (HIGH terus-menerus)!");
    Serial.println("     Penyebab: TX tidak dapat menarik jalur K-Line ke GND, atau jalur K-Line putus.");
  } else if (rxAtTxHigh == 0 && rxAtTxLow == 1) {
    Serial.println("  ⚠️ [PERINGATAN]: Logika Sirkuit Anda TERBALIK (INVERTED)!");
    Serial.println("     Saat TX HIGH, RX menjadi LOW. Saat TX LOW, RX menjadi HIGH.");
    Serial.println("     Solusi: Aktifkan Menu [9] Toggle Invert agar mikrokontroler membalik logikanya.");
  } else if (rxAtTxHigh == 1 && rxAtTxLow == 0) {
    Serial.println("  ✅ [NORMAL]: Logika Sirkuit NON-INVERTED (Sesuai Standar).");
    Serial.println("     TX HIGH = RX HIGH, TX LOW = RX LOW.");
  }

  // ---------------------------------------------------------------------------
  // TAHAP 2: TES LOOPBACK SERIAL UART DINAMIS (10400 bps)
  // ---------------------------------------------------------------------------
  Serial.println("\n[TAHAP 2] TES LOOPBACK SERIAL UART DINAMIS (10400 bps):");
  initUart(KLINE_BAUDRATE, isUartInverted);
  while (Serial2.available()) Serial2.read();

  uint8_t testPattern[] = { 0xAA, 0x55, 0x72, 0x89, 0x01 };
  Serial.print("  Mengirim pola byte : ");
  for (size_t i = 0; i < sizeof(testPattern); i++) Serial.printf("%02X ", testPattern[i]);
  Serial.println();

  for (size_t i = 0; i < sizeof(testPattern); i++) {
    Serial2.write(testPattern[i]);
    delay(5);
  }
  Serial2.flush();

  uint8_t received[16];
  size_t count = 0;
  uint32_t start = millis();
  while ((millis() - start) < 120 && count < sizeof(testPattern)) {
    if (Serial2.available()) {
      received[count++] = Serial2.read();
    } else {
      delayMicroseconds(100);
    }
  }

  Serial.printf("  Diterima kembali    : ");
  for (size_t i = 0; i < count; i++) Serial.printf("%02X ", received[i]);
  Serial.println();

  if (count == sizeof(testPattern)) {
    bool match = true;
    bool invertedMatch = true;
    bool allZero = true;

    for (size_t i = 0; i < count; i++) {
      if (received[i] != testPattern[i]) match = false;
      if (received[i] != (uint8_t)~testPattern[i]) invertedMatch = false;
      if (received[i] != 0x00) allZero = false;
    }

    if (match) {
      Serial.println("  [✅ HARDWARE LULUS SEMUA TES!]");
      Serial.println("  - Jalur TX (GPIO17) & RX (GPIO16) berfungsi sempurna pada 10400 bps.");
      Serial.println("  - Rangkaian siap dikoneksikan ke ECU motor.");
    } else if (allZero) {
      Serial.println("  [🚨 DATA PALSU / GHOST BYTES]");
      Serial.println("  - Semua byte terbaca 00 00 00... (Jalur RX terjepit di Ground).");
      Serial.println("  - Pasang resistor pull-up 1kΩ - 4.7kΩ dari GPIO16 ke 3.3V!");
    } else if (invertedMatch) {
      Serial.println("  [⚠️ POLARITAS UART TERBALIK!]");
      Serial.println("  - Optocoupler bekerja tetapi datanya terbalik bit-per-bit.");
      Serial.println("  - Tekan Menu [9] untuk mengaktifkan Inverted Logic.");
    } else {
      Serial.println("  [❌ DATA TERDISTORSI / RUSAK]");
      Serial.println("  - Kecepatan optocoupler 4N35 terlalu lambat merespon (bentuk gelombang cacat).");
      Serial.println("  - Pasang resistor 47kΩ-100kΩ antara pin 6 (Base) dan pin 4 (Emitter) 4N35.");
    }
  } else if (count == 0) {
    Serial.println("  [❌ TIDAK ADA RESPON SAMA SEKALI (0 BYTE)]");
    Serial.println("  - Pin RX tidak mendeteksi sinyal apapun dari jalur K-Line.");
    Serial.println("  - Cek: kabel putus, tegangan 12V belum ada, atau pin optocoupler salah colok.");
  } else {
    Serial.printf("  [⚠️ DATA TIDAK LENGKAP: Hanya %d dari %d byte diterima]\n", count, sizeof(testPattern));
  }
  Serial.println("==========================================================");
}

// =============================================================================
// PARSER SENSOR TABLE (TABLE 11 / TABLE 17)
// =============================================================================
void parseSensorTable(const uint8_t* rx, int rxLen, uint8_t tableId) {
  Serial.printf("\n  📊 HASIL PARSING DATA TABLE 0x%02X (%d BYTE):\n", tableId, rxLen);
  Serial.println("  ========================================");

  // Format Frame Honda: [02] [Length] [71] [TableId] [Data...] [Checksum]
  // Data dimulai pada index 4
  if (rxLen < 6) {
    Serial.println("  [⚠️] Data frame terlalu pendek.");
    return;
  }

  size_t d = 4;
  int rpm = 0;
  if (d + 1 < (size_t)rxLen - 1) {
    rpm = ((int)rx[d] << 8 | rx[d + 1]) / 4;
    Serial.printf("   RPM Mesin         : %d RPM (Hex: %02X %02X)\n", rpm, rx[d], rx[d + 1]);
    d += 2;
  }
  if (d < (size_t)rxLen - 1) {
    float tpsVolt = rx[d] * 5.0f / 255.0f;
    Serial.printf("   TPS (Throttle)    : %.2f Volt (Raw: %02X)\n", tpsVolt, rx[d]);
    d++;
  }
  if (d < (size_t)rxLen - 1) {
    float ect = (float)rx[d] - 40.0f;
    Serial.printf("   ECT (Suhu Mesin)  : %.1f °C (Raw: %02X)\n", ect, rx[d]);
    d++;
  }
  if (d < (size_t)rxLen - 1) {
    float iat = (float)rx[d] - 40.0f;
    Serial.printf("   IAT (Suhu Udara)  : %.1f °C (Raw: %02X)\n", iat, rx[d]);
    d++;
  }
  if (d < (size_t)rxLen - 1) {
    float mapVal = (float)rx[d];
    Serial.printf("   MAP (Tekanan Udara: %.1f kPa (Raw: %02X)\n", mapVal, rx[d]);
    d++;
  }
  if (d < (size_t)rxLen - 1) {
    float batt = rx[d] * 0.0733f;
    Serial.printf("   Tegangan Aki      : %.2f Volt (Raw: %02X)\n", batt, rx[d]);
    d++;
  }

  Serial.println("  ----------------------------------------");
  Serial.print("   Semua Data Byte   : ");
  for (int i = 4; i < rxLen - 1; i++) {
    Serial.printf("%02X ", rx[i]);
  }
  Serial.println();
  Serial.printf("   Checksum Frame    : 0x%02X\n", rx[rxLen - 1]);
  Serial.println("  ========================================");
}

// =============================================================================
// TEST 5: BACA REQUEST ECM ID (STEPS 2 - strategy.md)
// =============================================================================
void readEcuInfo() {
  Serial.println("\n==========================================================");
  Serial.println(">>> [5] BACA REQUEST ECM ID (SESUAI STRATEGY.MD) <<<");
  Serial.println("==========================================================");
  if (!ecuConnected) {
    Serial.println("  [⚠️ PERINGATAN]: ECU belum diinisialisasi / belum terhubung.");
    Serial.println("  Disarankan menjalankan Menu [1] (Keihin Init) terlebih dahulu.");
  }

  // Sesuai strategy.md: Send Request ECM ID = 72 05 71 00 18
  const uint8_t reqEcmId[] = { 0x72, 0x05, 0x71, 0x00, 0x18 };
  Serial.println("  Mengirim Request ECM ID [72 05 71 00 18]...");

  if (!sendFrameWithEchoCheck(reqEcmId, sizeof(reqEcmId))) {
    Serial.println("  [❌ GAGAL] Gagal mengirim perintah Request ECM ID.");
    return;
  }

  uint8_t rx[64];
  int rxLen = readResponse(rx, sizeof(rx), KLINE_TIMEOUT_MS);

  if (rxLen > 3) {
    printHex("RX ⬅️", rx, rxLen);
    Serial.println("  ========================================");
    Serial.printf("  ✅ RESPON ECM ID (%d byte):\n", rxLen);
    Serial.print("     Hex Data : ");
    for (int i = 0; i < rxLen; i++) Serial.printf("%02X ", rx[i]);
    Serial.println();

    if (rxLen > 4) {
      Serial.print("     Payload  : ");
      for (int i = 4; i < rxLen - 1; i++) Serial.printf("%02X ", rx[i]);
      Serial.println();
    }
    Serial.println("  ========================================");
  } else {
    Serial.println("  [❌ TIMEOUT] ECU tidak membalas permintaan ECM ID.");
    Serial.println("  Lakukan Test [1] Init Honda Keihin terlebih dahulu.");
  }
}

// =============================================================================
// TEST 6: BACA LIVE DATA SENSOR (TABLE 11 / TABLE 17 - strategy.md)
// =============================================================================
void readLiveData() {
  Serial.println("\n==========================================================");
  Serial.println(">>> [6] BACA DATA SENSOR (TABLE 11 / 17 SESUAI STRATEGY.MD) <<<");
  Serial.println("==========================================================");
  if (!ecuConnected) {
    Serial.println("  [⚠️ PERINGATAN]: ECU belum terhubung / belum di-Init.");
    Serial.println("  ECU motor tidak akan merespon jika belum diinisialisasi.");
    Serial.println("  Saran: Pastikan kontak ON dan jalankan Menu [1] (Keihin Init) dulu!");
  }

  // 1. Send Request data table 11 = 72 05 71 11 07
  const uint8_t reqTable11[] = { 0x72, 0x05, 0x71, 0x11, 0x07 };
  Serial.println("  [Step 1] Mengirim Request Data Table 11 [72 05 71 11 07]...");

  if (!sendFrameWithEchoCheck(reqTable11, sizeof(reqTable11))) {
    Serial.println("  [❌ GAGAL] Gagal mengirim perintah Table 11.");
    return;
  }

  uint8_t rx[64];
  int rxLen = readResponse(rx, sizeof(rx), KLINE_TIMEOUT_MS);

  if (rxLen <= 0) {
    Serial.println("  [❌ TIMEOUT] ECU tidak merespon permintaan Table 11.");
    Serial.println("  Lakukan Test [1] Init Honda Keihin terlebih dahulu.");
    return;
  }

  printHex("RX ⬅️", rx, rxLen);

  // 2. Cek apakah ECU menolak Table 11:
  // Sesuai strategy.md: If the ecu response data in table 11 is = 02 05 71 11 77
  // then continue to request data table 17. Send to ECU = 72 05 71 17 01
  const uint8_t table11Reject[] = { 0x02, 0x05, 0x71, 0x11, 0x77 };
  if (rxLen == 5 && memcmp(rx, table11Reject, 5) == 0) {
    Serial.println("  [ℹ️ RESPON] ECU mengembalikan 02 05 71 11 77 (Table 11 ditolak / tidak didukung).");
    Serial.println("  [Step 2] Beralih meminta Data Table 17 sesuai strategy.md...");
    delay(35);

    const uint8_t reqTable17[] = { 0x72, 0x05, 0x71, 0x17, 0x01 };
    Serial.println("  Mengirim Request Data Table 17 [72 05 71 17 01]...");

    if (!sendFrameWithEchoCheck(reqTable17, sizeof(reqTable17))) {
      Serial.println("  [❌ GAGAL] Gagal mengirim perintah Table 17.");
      return;
    }

    rxLen = readResponse(rx, sizeof(rx), KLINE_TIMEOUT_MS);
    if (rxLen <= 0) {
      Serial.println("  [❌ TIMEOUT] ECU tidak merespon permintaan Table 17.");
      return;
    }

    printHex("RX ⬅️", rx, rxLen);
    parseSensorTable(rx, rxLen, 0x17);
  } else {
    parseSensorTable(rx, rxLen, 0x11);
  }
}

// =============================================================================
// TEST 7: BACA DTC (TROUBLE CODE)
// =============================================================================
void readDTC() {
  Serial.println("\n>>> [7] BACA DTC (KODE KERUSAKAN) — TABLE 0x73 <<<");
  uint8_t req[] = { 0x72, 0x05, 0x73, 0x00, 0x00 };
  req[4] = calcHondaChecksum(req, 4, true);

  if (!sendFrameWithEchoCheck(req, sizeof(req))) {
    Serial.println("  [❌ GAGAL] Gagal mengirim perintah.");
    return;
  }

  uint8_t rx[128];
  int rxLen = readResponse(rx, sizeof(rx), KLINE_TIMEOUT_MS);

  if (rxLen > 3) {
    printHex("RX ⬅️", rx, rxLen);
    Serial.println("  ========================================");

    size_t offset = 3;
    int dtcCount = 0;

    while (offset + 1 < (size_t)rxLen - 1) {
      uint8_t high = rx[offset];
      uint8_t low  = rx[offset + 1];

      if (high == 0x00 && low == 0x00) break;

      uint16_t raw = ((uint16_t)high << 8) | low;
      char type = 'P';
      switch ((raw >> 14) & 0x03) {
        case 0: type = 'P'; break;
        case 1: type = 'C'; break;
        case 2: type = 'B'; break;
        case 3: type = 'U'; break;
      }
      char dtcCode[10];
      sprintf(dtcCode, "%c%d%X%X%X", type, (raw >> 12) & 0x03, (raw >> 8) & 0x0F, (raw >> 4) & 0x0F, raw & 0x0F);

      dtcCount++;
      Serial.printf("   DTC #%d: %s\n", dtcCount, dtcCode);
      offset += 3; // high, low, status
    }

    if (dtcCount == 0) {
      Serial.println("   ✅ ECM BERSIH: Tidak ada kode kerusakan (MIL OFF)");
    }
    Serial.println("  ========================================");
  } else {
    Serial.println("  [❌ TIMEOUT] ECU tidak merespon permintaan DTC.");
    Serial.println("  Lakukan Test [1] Fast Init terlebih dahulu.");
  }
}

// =============================================================================
// TEST 8: K-LINE BUS SNIFFER
// =============================================================================
void runBusSniffer() {
  Serial.println("\n>>> [8] K-LINE RAW SNIFFER MODE <<<");
  Serial.println("  Mendengarkan seluruh aliran data di bus K-Line...");
  Serial.println("  Tekan 'q' atau ENTER untuk berhenti dan kembali ke menu.");

  initUart(KLINE_BAUDRATE, isUartInverted);
  while (Serial2.available()) Serial2.read();

  uint32_t lastPrint = millis();
  while (true) {
    if (Serial.available()) {
      char c = Serial.read();
      if (c == 'q' || c == 'Q' || c == '\n' || c == '\r') {
        Serial.println("\n  Sniffer dihentikan.");
        break;
      }
    }

    if (Serial2.available()) {
      uint8_t b = Serial2.read();
      Serial.printf("%02X ", b);
      lastPrint = millis();
    } else {
      if (millis() - lastPrint > 50 && lastPrint != 0) {
        Serial.println(); // Ganti baris jika jeda antar paket > 50ms
        lastPrint = 0;
      }
      delayMicroseconds(100);
    }
  }
}

// =============================================================================
// TEST 9: TOGGLE UART INVERT
// =============================================================================
void toggleUartInvert() {
  isUartInverted = !isUartInverted;
  Serial.printf("\n>>> [9] POLARITAS UART DIUBAH MENJADI: %s <<<\n",
                isUartInverted ? "INVERTED (Logika Terbalik)" : "NORMAL (Standard TTL)");
  initUart(KLINE_BAUDRATE, isUartInverted);
}

// =============================================================================
// TEST 0: SEND CUSTOM HEX
// =============================================================================
void sendCustomHex() {
  Serial.println("\n>>> [0] KIRIM CUSTOM HEX COMMAND KE ECU <<<");
  Serial.println("  Contoh: ketik '72 05 71 00' lalu tekan ENTER.");
  Serial.print("  Masukkan string HEX: ");

  String input = "";
  while (true) {
    if (Serial.available()) {
      char c = Serial.read();
      if (c == '\n' || c == '\r') {
        if (input.length() > 0) break;
      } else {
        input += c;
        Serial.print(c);
      }
    }
  }
  Serial.println();

  input.replace(" ", "");
  if (input.length() % 2 != 0 || input.length() == 0) {
    Serial.println("  [❌ ERROR] Jumlah digit heksadesimal harus genap!");
    return;
  }

  uint8_t txBuf[64];
  size_t len = 0;
  for (size_t i = 0; i < input.length() && len < sizeof(txBuf); i += 2) {
    txBuf[len++] = (uint8_t)strtol(input.substring(i, i + 2).c_str(), NULL, 16);
  }

  sendFrameWithEchoCheck(txBuf, len);

  uint8_t rxBuf[64];
  int rxLen = readResponse(rxBuf, sizeof(rxBuf), KLINE_TIMEOUT_MS);
  if (rxLen > 0) {
    printHex("RX ⬅️ Respon ECU", rxBuf, rxLen);
  } else {
    Serial.println("  [❌ TIMEOUT] Tidak ada balasan dari ECU.");
  }
}

