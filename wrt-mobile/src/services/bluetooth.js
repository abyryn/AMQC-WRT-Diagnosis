// ============================================
// WRT Garage — Bluetooth SPP & K-Line Simulation Service
// ============================================

export const bluetoothService = {
  isConnected: true,
  deviceName: 'WRT_KLINE_ESP32',
  baudRate: 10400,
  protocol: 'ISO 14230 Fast Init',

  init() {
    console.log('[Bluetooth] Initialized Bluetooth SPP & ESP32 K-Line Adapter Driver.');
    return true;
  },

  async connect(address) {
    console.log(`[Bluetooth] Connecting to ${address || this.deviceName}...`);
    this.isConnected = true;
    return { success: true, device: this.deviceName, protocol: this.protocol };
  },

  async disconnect() {
    this.isConnected = false;
    return { success: true };
  },

  async sendHexCommand(hexString) {
    console.log(`[Bluetooth] TX ➔ ${hexString}`);
    // Simulate K-Line ECU responses based on standard Honda PGM-FI commands
    const cleanHex = hexString.replace(/\s+/g, '').toUpperCase();
    
    if (cleanHex.startsWith('72050000')) {
      // Fast init wakeup response
      return { tx: hexString, rx: '02 04 00 7F D5', status: 'ACK_OK', desc: 'Fast Init Wakeup Success' };
    }
    if (cleanHex.startsWith('72057100')) {
      // Read DTC response
      return { tx: hexString, rx: '02 06 71 01 13 05 62 A2', status: 'DTC_RECEIVED', dtc: ['P0113', 'P0562'] };
    }
    if (cleanHex.startsWith('72077200')) {
      // Read Table 0 Live Data
      return { tx: hexString, rx: '02 12 72 05 AB 30 58 00 22 2C 00 1C 04 00 00 00 8C', status: 'LIVE_DATA_RECEIVED' };
    }
    if (cleanHex.startsWith('72057000')) {
      // Read ECU Part Number
      return { tx: hexString, rx: '02 0B 70 33 30 34 30 30 2D 4B 31 5A A1', status: 'PART_NO', partNumber: '30400-K1Z-N01' };
    }
    if (cleanHex.startsWith('72050400')) {
      // Clear DTC
      return { tx: hexString, rx: '02 04 04 00 F6', status: 'DTC_CLEARED', desc: 'ECU Memory Cleared & MIL Reset' };
    }

    return { tx: hexString, rx: '02 04 7F 11 6A', status: 'ACK_GENERIC' };
  },
};

export default bluetoothService;
