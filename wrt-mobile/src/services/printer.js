// ============================================
// WRT Garage — Thermal Printer Service (ESC/POS & Zebra ZPL II)
// ============================================

export const KNOWN_BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Mobile POS
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Zebra BLE Service
  '38eb4a80-c570-11e3-9507-0002a5d5c51b', // Zebra ZPL/CPCL Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Microchip Transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Xprinter / POS-58
  '0000fee7-0000-1000-8000-00805f9b34fb', // WeChat POS
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2540 Serial
  '0000fff0-0000-1000-8000-00805f9b34fb', // POS-58/POS-80
  '0000ae30-0000-1000-8000-00805f9b34fb', // Zjiang
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000fe00-0000-1000-8000-00805f9b34fb',
  '0000fe11-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
];

export const printerService = {
  paperWidth: '58mm',

  /**
   * Generate ESC/POS Plain Receipt Text
   */
  generateReceiptText(data) {
    const width = this.paperWidth === '80mm' ? 42 : 32;
    const divider = '='.repeat(width);
    const dashDivider = '-'.repeat(width);
    let text = '';
    text += centerText(data.shopName || 'WRT DIAGNOSIS Agent AI', width) + '\n';
    text += centerText(data.shopAddress || 'Jl. Otista Raya No. 88 | WA: 0812-3456-7890', width) + '\n';
    text += divider + '\n';
    text += centerText('3-LAYER HONDA PGM-FI AI REPORT', width) + '\n';
    text += dashDivider + '\n';

    text += formatRow('TANGGAL :', data.date || new Date().toLocaleString('id-ID'), width) + '\n';
    text += formatRow('NO. POL :', data.plate || 'B 4521 WRT', width) + '\n';
    text += formatRow('MOTOR   :', data.motor || 'Honda PCX 160 eSP+', width) + '\n';
    text += formatRow('ODOMETER:', `${data.odometer || '14250'} KM`, width) + '\n';
    text += formatRow('MEKANIK :', data.technician || 'Mekanik WRT', width) + '\n';
    text += divider + '\n';

    // [ LAYER 1: DTC RULE ENGINE ]
    text += '[1] LAYER 1: DTC RULE ENGINE\n';
    if (data.dtcs && data.dtcs.length > 0) {
      data.dtcs.forEach((d) => {
        text += `* [${d.code}] ${d.name}\n`;
        text += `  Status: ${d.status || 'AKTIF'} ${d.code === 'P0113' ? '(9 KEDIPAN MIL)' : ''}\n`;
      });
    } else {
      text += '  * ECM STATUS: NORMAL (TIDAK ADA DTC)\n';
    }
    text += dashDivider + '\n';

    // [ LAYER 2: SENSOR KNOWLEDGE BASE ]
    text += '[2] LAYER 2: SENSOR KNOWLEDGE BASE\n';
    if (data.telemetry) {
      text += formatRow('RPM Idle :', `${data.telemetry.rpm || 1450} rpm`, width) + '\n';
      text += formatRow('Suhu ECT :', `${data.telemetry.ect || 88} °C`, width) + '\n';
      text += formatRow('Suhu IAT :', `${data.telemetry.iat || -40} °C ${data.telemetry.iat <= -30 ? '(!)' : ''}`, width) + '\n';
      text += formatRow('Teg. TPS :', `${data.telemetry.tps || 0.48} V`, width) + '\n';
      text += formatRow('Teg. AKI :', `${data.telemetry.battery || 11.8} V`, width) + '\n';
      text += formatRow('MAP Pres :', `${data.telemetry.map || 34.2} kPa`, width) + '\n';
    }
    text += dashDivider + '\n';

    // [ LAYER 3: GOOGLE GEMINI AI REASONING ]
    text += '[3] LAYER 3: AI REASONING (GEMINI)\n';
    text += `RISIKO: [ ${(data.riskLevel || 'MEDIUM').toUpperCase()} RISK ]\n\n`;
    text += wrapText(data.aiSummary || 'Sistem injeksi dalam analisis.', width) + '\n';

    if (data.checkSteps && data.checkSteps.length > 0) {
      text += '\nLangkah Tindakan Mekanik:\n';
      data.checkSteps.slice(0, 4).forEach((s, i) => {
        text += wrapText(`${i + 1}. ${s}`, width) + '\n';
      });
    }

    text += divider + '\n';
    text += centerText(data.notes || 'Garansi servis sensor 14 hari kerja.', width) + '\n';
    text += centerText('Terima kasih atas kunjungan Anda!', width) + '\n';
    text += '\n\n\n';

    return text;
  },

  /**
   * Generate Zebra ZPL II Code with accurate continuous length and contrast
   */
  generateZPL(data, options = {}) {
    const paperWidth = options.paperWidth || this.paperWidth || '58mm';
    const width = options.widthDots || (paperWidth === '80mm' ? 600 : paperWidth === '100mm' ? 800 : 440);
    const margin = 16;
    const contentWidth = width - (margin * 2);

    const dtcs = data.dtcs || [];
    const steps = data.checkSteps || [];

    let totalLength = 1300;
    let y = 12;
    let zpl = '^XA\n';
    zpl += `^PW${width}\n`;
    zpl += `^LL${totalLength}\n`;
    zpl += '^LT0\n';      // Zero Top Offset
    zpl += '^LH0,0\n';    // Zero Label Home
    zpl += '^MNN\n';      // Continuous Media Mode (No gap sensor search)
    zpl += '^MD15\n';     // High Contrast
    zpl += '^PON\n';
    zpl += '^CI28\n';

    const shopName = (data.shopName || 'WRT DIAGNOSIS AGENT AI').toUpperCase();
    zpl += `^FO${margin},${y}^A0N,28,28^FB${contentWidth},1,0,C,0^FD${shopName}^FS\n`;
    y += 35;

    zpl += `^FO${margin},${y}^A0N,20,20^FB${contentWidth},1,0,C,0^FD3-LAYER AI DIAGNOSTIC REPORT^FS\n`;
    y += 30;

    zpl += `^FO${margin},${y}^GB${contentWidth},3,3^FS\n`;
    y += 15;

    const dateStr = data.date || new Date().toLocaleString('id-ID');
    zpl += `^FO${margin},${y}^A0N,20,20^FDDATE  : ${dateStr}^FS\n`;
    y += 26;

    const plate = data.plate || '-';
    zpl += `^FO${margin},${y}^A0N,22,22^FDPLATE : ${plate}^FS\n`;
    y += 28;

    const motor = data.motor || '-';
    zpl += `^FO${margin},${y}^A0N,20,20^FDMOTOR : ${motor}^FS\n`;
    y += 26;

    const odo = data.odometer ? `${data.odometer} KM` : '-';
    zpl += `^FO${margin},${y}^A0N,20,20^FDODO   : ${odo}^FS\n`;
    y += 26;

    const tech = data.technician || 'Mekanik WRT';
    zpl += `^FO${margin},${y}^A0N,20,20^FDTECH  : ${tech}^FS\n`;
    y += 30;

    zpl += `^FO${margin},${y}^GB${contentWidth},2,2^FS\n`;
    y += 15;

    // [ LAYER 1: DTC RULE ENGINE ]
    zpl += `^FO${margin},${y}^A0N,22,22^FD[1] LAYER 1: DTC RULE ENGINE^FS\n`;
    y += 28;

    if (dtcs.length > 0) {
      dtcs.forEach((d) => {
        const code = d.code;
        const name = (d.name || '').substring(0, 22);
        const blink = code === 'P0113' ? ' (9K)' : '';
        zpl += `^FO${margin},${y}^A0N,20,20^FD* [${code}] ${name}${blink}^FS\n`;
        y += 24;
      });
    } else {
      zpl += `^FO${margin},${y}^A0N,20,20^FD* ECM STATUS: NORMAL (NO DTC)^FS\n`;
      y += 24;
    }
    y += 6;

    zpl += `^FO${margin},${y}^GB${contentWidth},2,2^FS\n`;
    y += 15;

    // [ LAYER 2: SENSOR KNOWLEDGE BASE ]
    zpl += `^FO${margin},${y}^A0N,22,22^FD[2] LAYER 2: SENSOR KNOWLEDGE BASE^FS\n`;
    y += 28;

    if (data.telemetry) {
      const col2X = margin + Math.round(contentWidth / 2);
      zpl += `^FO${margin},${y}^A0N,18,18^FDRPM : ${data.telemetry.rpm || 1450} rpm^FS^FO${col2X},${y}^A0N,18,18^FDECT : ${data.telemetry.ect || 88} C^FS\n`;
      y += 22;
      zpl += `^FO${margin},${y}^A0N,18,18^FDIAT : ${data.telemetry.iat || -40} C^FS^FO${col2X},${y}^A0N,18,18^FDTPS : ${data.telemetry.tps || 0.48} V^FS\n`;
      y += 22;
      zpl += `^FO${margin},${y}^A0N,18,18^FDVBAT: ${data.telemetry.battery || 11.8} V^FS^FO${col2X},${y}^A0N,18,18^FDMAP : ${data.telemetry.map || 34.2} kPa^FS\n`;
      y += 26;
    }

    zpl += `^FO${margin},${y}^GB${contentWidth},2,2^FS\n`;
    y += 15;

    // [ LAYER 3: GOOGLE GEMINI AI REASONING ]
    const risk = (data.riskLevel || 'MEDIUM').toUpperCase();
    zpl += `^FO${margin},${y}^A0N,22,22^FD[3] LAYER 3: AI REASONING [${risk}]^FS\n`;
    y += 28;

    const summary = (data.aiSummary || 'Analisis sistem Honda PGM-FI selesai.').replace(/[\r\n]+/g, ' ');
    zpl += `^FO${margin},${y}^A0N,18,18^FB${contentWidth},4,0,L,0^FD${summary}^FS\n`;
    y += 85;

    if (data.primaryCause) {
      zpl += `^FO${margin},${y}^A0N,18,18^FB${contentWidth},2,0,L,0^FDCAUS: ${data.primaryCause.replace(/[\r\n]+/g, ' ')}^FS\n`;
      y += 45;
    }

    zpl += `^FO${margin},${y}^GB${contentWidth},2,2^FS\n`;
    y += 15;

    const qrX = Math.round((width - 120) / 2);
    const qrUrl = `https://wrt.garage/r/${plate.replace(/\s+/g, '')}`;
    zpl += `^FO${qrX},${y}^BQN,2,4^FDMM,AAC-${qrUrl}^FS\n`;
    y += 135;

    zpl += `^FO${margin},${y}^A0N,16,16^FB${contentWidth},1,0,C,0^FDScan QR untuk Riwayat Servis Digital^FS\n`;
    y += 25;

    const notes = data.notes || 'Garansi servis sensor 14 hari kerja.';
    zpl += `^FO${margin},${y}^A0N,16,16^FB${contentWidth},2,0,C,0^FD${notes}^FS\n`;
    y += 45;

    // Feed spacer before tear/cut
    zpl += `^FO${margin},${y}^A0N,18,18^FD ^FS\n`;
    zpl += '^XZ\n\n';

    return zpl;
  },

  /**
   * Send ZPL to Zebra Network Printer via backend proxy
   */
  async printZplNetwork(ip, port, zplContent) {
    const res = await fetch('http://localhost:3000/api/printer/zpl/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'wrt-garage-api-key-change-this-in-production',
      },
      body: JSON.stringify({ ip, port: port || 9100, zpl: zplContent }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || `Gagal mencetak ke Zebra ${ip}:${port || 9100}`);
    }
    return json;
  },

  /**
   * Send ZPL to Bluetooth Printer via Enhanced Web Bluetooth API
   */
  async printZplBluetooth(zplString) {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth tidak didukung pada browser ini. Gunakan Chrome di Android/Desktop.');
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_BLE_SERVICES,
    });

    if (!device.gatt) {
      throw new Error('GATT Server tidak tersedia pada printer ini.');
    }

    const server = await device.gatt.connect();
    const encoder = new TextEncoder();
    const data = encoder.encode(zplString);

    // 1. Try to get all accessible services
    let services = [];
    try {
      services = await server.getPrimaryServices();
    } catch (e) {
      console.warn('getPrimaryServices error:', e);
    }

    // 2. Scan known UUIDs if empty
    if (services.length === 0) {
      for (const uuid of KNOWN_BLE_SERVICES) {
        try {
          const s = await server.getPrimaryService(uuid);
          if (s) services.push(s);
        } catch (ignore) {}
      }
    }

    if (services.length === 0) {
      throw new Error('DEVICE_IS_CLASSIC_SPP: Perangkat menggunakan Bluetooth Classic SPP. Silakan gunakan tombol "⚡ Cetak via RawBT".');
    }

    // 3. Find writable characteristic
    let targetChar = null;
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            targetChar = char;
            break;
          }
        }
        if (targetChar) break;
      } catch (e) {
        console.warn('Error reading characteristic:', e);
      }
    }

    if (!targetChar) {
      throw new Error('Tidak ditemukan karakteristik penulisan data (writable) pada printer Bluetooth ini.');
    }

    // 4. Send in safe chunks of 64 bytes with 35ms delay to prevent buffer truncation
    const chunkSize = 64;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (targetChar.properties.writeWithoutResponse) {
        await targetChar.writeValueWithoutResponse(chunk);
      } else {
        await targetChar.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 35));
    }

    // Allow printer to complete physical print execution before disconnecting
    await new Promise((r) => setTimeout(r, 800));

    return { success: true, device: device.name || 'Zebra Bluetooth Printer' };
  },

  /**
   * Universal Android Print Bridge (RawBT / Bluetooth POS Spooler)
   * Works for ALL Classic Bluetooth SPP & BLE Printers!
   */
  printViaRawBT(rawContent) {
    try {
      const base64Data = btoa(unescape(encodeURIComponent(rawContent)));
      const rawbtUrl = `rawbt:data:text/plain;base64,${base64Data}`;
      window.location.href = rawbtUrl;
      return true;
    } catch (e) {
      console.error('RawBT launch error:', e);
      return false;
    }
  },

  /**
   * Share ZPL File to Android Apps (Zebra Print Station / PrintHand)
   */
  async shareZplFile(zplString, filename = 'wrt_report.zpl') {
    const blob = new Blob([zplString], { type: 'text/plain;charset=utf-8' });
    const file = new File([blob], filename, { type: 'text/plain' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'WRT Garage ZPL Print',
        text: 'Cetak Laporan Diagnosis ke Zebra Printer',
        files: [file],
      });
      return true;
    } else {
      this.downloadZplFile(zplString, filename);
      return false;
    }
  },

  /**
   * Send ZPL via Web Serial (USB Zebra Printers)
   */
  async printZplSerial(zplString) {
    if (!navigator.serial) {
      throw new Error('Web Serial tidak didukung pada browser ini. Gunakan Google Chrome Desktop.');
    }

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const encoder = new TextEncoderStream();
    const outputDone = encoder.readable.pipeTo(port.writable);
    const writer = encoder.writable.getWriter();

    await writer.write(zplString);
    writer.releaseLock();
    await outputDone;
    await port.close();

    return { success: true };
  },

  /**
   * Download ZPL file (.zpl)
   */
  downloadZplFile(zplString, filename = 'wrt_report.zpl') {
    const blob = new Blob([zplString], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Standard Browser Print
   */
  print() {
    if (typeof window !== 'undefined') {
      window.print();
    }
    return true;
  },
};

function centerText(str, width) {
  const pad = Math.max(0, Math.floor((width - str.length) / 2));
  return ' '.repeat(pad) + str;
}

function formatRow(left, right, width) {
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
}

function wrapText(str, width) {
  const words = str.split(' ');
  let lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

export default printerService;
