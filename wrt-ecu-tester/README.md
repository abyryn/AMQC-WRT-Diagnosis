# 🏍️ WRT Garage — ESP32 Honda ECU Connectivity Tester

Proyek ini adalah tool diagnostik interaktif khusus untuk **menguji koneksi fisik dan komunikasi data antara ESP32 dan ECU motor Honda PGM-FI** melalui jalur K-Line (10400 bps).

Tool ini dibuat terpisah agar Anda bisa melakukan pengujian hardware, verifikasi optocoupler, dan debugging protokol sebelum menjalankan firmware utama.

---

## 🔌 Skema Pinout & Rangkaian K-Line (Optocoupler 4N35)

### 1. Pin ESP32
- **GPIO 17 (TX2)** ➔ Input Optocoupler TX (Mengirim data ke K-Line)
- **GPIO 16 (RX2)** ➔ Output Optocoupler RX (Menerima data dari K-Line)
- **GPIO 2** ➔ Built-in LED (Indikator status & deteksi koneksi)
- **GND** ➔ Ground bersama (Motor GND & ESP32 GND)

### 2. Soket DLC Honda (Data Link Connector 4-Pin)
Biasanya terletak di dekat aki atau bawah jok motor Honda (warna konektor merah):
```text
      ┌───────────┐
      │  [1] [2]  │  Clip Pengunci di Atas
      │  [3] [4]  │
      └───────────┘
```
- **Pin 1 (Oranye/Putih atau Biru muda)** ➔ **K-Line Data (12V)**
- **Pin 2 (Cokelat)** ➔ SCS (Service Check System) — *Biarkan kosong*
- **Pin 3 (Hijau/Hitam)** ➔ **Ground (GND)**
- **Pin 4 (Hitam/Merah)** ➔ **+12V Switched Battery** (Tersambung ke kunci kontak)

---

## 🚀 Cara Upload & Menggunakan di PlatformIO

1. Buka folder `wrt-ecu-tester` di VS Code:
   - **File** ➔ **Open Folder...** ➔ Pilih folder `wrt-ecu-tester`.
2. Hubungkan ESP32 ke laptop via kabel USB.
3. Klik tombol **➔ (Upload)** di status bar biru bawah (atau shortcut `Ctrl + Alt + U`).
4. Klik tombol **🔌 (Serial Monitor)** di status bar bawah (atau shortcut `Ctrl + Alt + S`).
5. Pastikan baud rate Serial Monitor adalah **115200**.

---

## 📋 Fitur & Menu Serial Monitor

Setelah serial monitor terbuka, Anda akan disambut menu interaktif. Cukup ketik angka di terminal dan tekan **ENTER**:

```text
--- PILIH MENU TEST DIAGNOSTIK ---
 [1] Test Fast Init (ISO 14230-2) — Untuk BeAT, Vario, PCX, CB150R
 [2] Test 5-Baud Init (ISO 9141-2) — Untuk Supra X 125 FI KPH lama
 [3] Auto-Detect Connection — Coba Fast Init lalu 5-Baud
 [4] Self-Test Rangkaian Optocoupler (Hardware Loopback Test)
 [5] Baca Info ECU (Part Number & Manufacturer)
 [6] Baca Live Data Sensor (RPM, TPS, ECT, IAT, Battery)
 [7] Baca Diagnostic Trouble Code (DTC Fault Codes)
 [8] K-Line Bus Sniffer (Monitor lalu lintas data mentah)
 [9] Toggle UART Polarity Invert (Normal / Inverted)
 [0] Kirim Custom Hex Frame ke ECU
```

### Rekomendasi Urutan Pengujian:
1. **Langkah 1**: Tekan **`[4]` (Self-Test Rangkaian Optocoupler)**.
   - Dapat diuji di meja kerja asalkan sirkuit diberi tegangan dan pull-up.
   - Menguji apakah pin TX dan RX terhubung dengan benar dan optocoupler bekerja.
   - Jika polaritas terbalik, sistem akan memberi tahu untuk mengaktifkan menu **`[9]`**.
2. **Langkah 2**: Colokkan kabel ke DLC motor, putar kunci kontak ke posisi **ON**.
3. **Langkah 3**: Tekan **`[1]` (Test Fast Init)** atau **`[3]` (Auto-Detect)**.
   - Jika berhasil, LED biru ESP32 akan berkedip dan muncul pesan `[✅ SUKSES!] ECU MERESPON WAKEUP FAST INIT!`.
4. **Langkah 4**: Tekan **`[5]`** untuk membaca nomor part ECU motor Anda (misal `30400-K1Z-N01`), lalu **`[6]`** untuk membaca RPM, sensor suhu, dan tegangan aki secara nyata.

---

## 🛠️ Panduan Troubleshooting

| Gejala | Penyebab Umum | Solusi |
|---|---|---|
| **Echo tidak terdeteksi (0 byte)** | Jalur TX/RX optocoupler putus atau belum ada 12V | Periksa resistor pull-up 510Ω dari K-Line ke +12V aki motor |
| **Data rusak / nilai acak pada Test [4]** | Nilai resistor pull-up terlalu besar atau optocoupler lambat | Gunakan resistor pull-up 510Ω atau 1kΩ, pastikan ground tersambung |
| **Fast Init gagal, tidak ada respon ECU** | Kunci kontak OFF / switch cut-off OFF | Putar kunci kontak motor ke posisi ON, saklar engine cut-off di posisi RUN |
| **Supra X 125 karbu/FI lama gagal Fast Init** | ECU Keihin generasi 1 menggunakan ISO 9141 | Gunakan Menu `[2]` (5-Baud Init) |

