# 📘 Product Requirements Document
## WRT Garage — Honda PGM-FI AI Diagnostic Tool
### Versi Dokumen: 1.0 | Tanggal: Agustus 2026

---

> **Tagline**: *"Diagnosis Honda seperti Master Teknisi — di genggaman tangan, dengan kecerdasan AI"*

---

## Daftar Isi

1. [Product Vision](#1-product-vision)
2. [Product Goals](#2-product-goals)
3. [User Persona](#3-user-persona)
4. [Use Case](#4-use-case)
5. [AI Diagnosis Engine](#5-ai-diagnosis-engine)
6. [AI Prompt System](#6-ai-prompt-system)
7. [System Architecture](#7-system-architecture)
8. [Database Schema](#8-database-schema)
9. [Mobile App — Halaman & Fitur](#9-mobile-app--halaman--fitur)
10. [ESP32 Firmware Architecture](#10-esp32-firmware-architecture)
11. [Roadmap](#11-roadmap)

---

## 1. Product Vision

### 1.1 Latar Belakang

Honda PGM-FI (Programmed Fuel Injection) adalah sistem injeksi bahan bakar yang digunakan pada hampir seluruh sepeda motor Honda modern — dari Beat, Vario, CB150R, PCX, hingga CBR series. Setiap sepeda motor menyimpan data kesehatan mesin secara real-time di dalam ECU (Engine Control Unit), namun **akses ke data ini selama ini hanya bisa dilakukan menggunakan alat Honda HDS (Honda Diagnostic System)** yang mahal, berat, dan memerlukan laptop.

Kondisi ini menciptakan **kesenjangan yang besar** antara mekanik bengkel besar (yang punya akses HDS) dan mekanik bengkel kecil atau mekanik pemula yang tidak punya alat mahal tersebut.

### 1.2 Masalah Mekanik Saat Ini

| No | Masalah | Dampak |
|----|---------|--------|
| 1 | Tidak punya alat diagnostik (HDS terlalu mahal) | Diagnosis berdasarkan "tebak-tebakan" |
| 2 | DTC dibaca tanpa pemahaman konteks | Salah ganti sparepart, pemborosan biaya |
| 3 | Live sensor tidak bisa dipantau | Masalah intermittent sulit ditemukan |
| 4 | Mekanik pemula tidak punya mentor | Kesalahan berulang, kualitas servis buruk |
| 5 | Tidak ada riwayat servis digital | Histori motor hilang, tidak ada prediksi kerusakan |
| 6 | Freeze frame diabaikan | Konteks masalah saat MIL menyala hilang |

### 1.3 Mengapa AI Dibutuhkan

Membaca DTC saja tidak cukup. Kode `P0113` misalnya, bisa berarti:
- Sensor IAT rusak
- Konektor IAT kotor/putus
- Nilai tegangan supply drop
- Masalah pada ECU itu sendiri

Tanpa konteks data sensor lain (IAT, ECT, MAP, RPM secara bersamaan), mekanik akan salah diagnosis. **AI hadir untuk mengintegrasikan semua data** — DTC + Live Sensor + Freeze Frame + Riwayat Servis — dan memberikan **analisis prioritas** serta **langkah pengecekan yang sistematis**.

### 1.4 Target Pengguna

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   Pemula     │   Mekanik    │  Teknisi     │   Guru SMK   │
│   (Hobbyist) │   Bengkel    │  Racing      │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### 1.5 Tujuan Produk

1. **Democratize ECU Access** — Setiap mekanik, tanpa modal besar, bisa membaca ECU Honda
2. **AI-Powered Diagnosis** — Tidak hanya membaca data, tapi memahami dan menjelaskan maknanya
3. **Education Tool** — Mekanik pemula belajar dari analisis AI, bukan dari trial & error
4. **Preventive Maintenance** — Prediksi kerusakan sebelum terjadi

### 1.6 Value Proposition

> **"Dari Rp 300.000 (harga ESP32 + komponen), Anda mendapatkan kemampuan diagnosis setara Honda HDS senilai puluhan juta — ditambah AI yang tidak dimiliki HDS manapun."**

| Kompetitor | Harga | AI | Mobile App | Hardware Comm | AI Internet Access |
|-----------|-------|-----|------------|----------------|--------------------|
| Honda HDS Original | Rp 50.000.000+ | ❌ | ❌ | Proprietary Cable | ❌ |
| OBD2 Generic | Rp 500.000 - 2.000.000 | ❌ | ✅ | Bluetooth / WiFi | ❌ |
| **WRT Garage (Produk Ini)** | **Rp 150.000 - 300.000** | **✅** | **✅** | **Bluetooth (BLE/SPP)** | **Koneksi Internet HP (Data/WiFi)** |

---

## 2. Product Goals

### 2.1 Functional Goals

#### Fitur Inti — Komunikasi ECU

| # | Fitur | Deskripsi | Prioritas |
|---|-------|-----------|-----------|
| F-01 | **Membaca DTC Honda** | Baca Diagnostic Trouble Code dari ECU PGM-FI melalui K-Line 10400bps | 🔴 Must |
| F-02 | **Clear DTC** | Hapus fault code setelah perbaikan, reset MIL | 🔴 Must |
| F-03 | **Live Sensor** | Monitor 14+ sensor real-time: RPM, TPS, MAP, IAT, ECT, O2, Battery, dll | 🔴 Must |
| F-04 | **Freeze Frame** | Baca kondisi sensor saat DTC pertama kali trigger | 🟠 Should |
| F-05 | **ECU Information** | Baca nomor part ECU, versi firmware ECU, VIN | 🟠 Should |

#### Fitur Analitik

| # | Fitur | Deskripsi | Prioritas |
|---|-------|-----------|-----------|
| F-08 | **Data Logger** | Rekam semua sensor selama riding test ke CSV | 🟠 Should |
| F-09 | **Grafik Sensor** | Visualisasi data sensor dalam bentuk grafik real-time | 🟠 Should |
| F-10 | **AI Diagnosis** | Analisis DTC + Live Data menggunakan OpenRouter AI API | 🔴 Must |
| F-11 | **AI Chat** | Tanya jawab bebas dengan AI tentang kondisi motor | 🟡 Could |
| F-12 | **Predictive Maintenance** | Prediksi potensi kerusakan dari pola data historis | 🟡 Could |

#### Fitur Tambahan

| # | Fitur | Deskripsi | Prioritas |
|---|-------|-----------|-----------|
| F-13 | **Manual Terminal** | Kirim HEX command manual ke ECU (untuk advanced user) | 🟠 Should |
| F-14 | **OTA Update** | Update firmware ESP32 via WiFi/BT tanpa kabel USB | 🟠 Should |
| F-15 | **Sensor Test** | Aktuasi output ECU (injektor, koil, dll) untuk test komponen | 🟡 Could |
| F-16 | **Print Struk Thermal** | Cetak hasil diagnosis AI ke Thermal Printer (Bluetooth/Zebra) | 🔴 Must |

### 2.2 Business Goals

| No | Tujuan Bisnis | KPI Target |
|----|--------------|------------|
| BG-01 | Mengurangi waktu diagnosis | < 5 menit dari koneksi sampai rekomendasi perbaikan |
| BG-02 | Membantu mekanik pemula | Tingkat keberhasilan diagnosis pertama > 80% |
| BG-03 | Mengurangi salah ganti sparepart | Penghematan biaya mekanik > 30% per bulan |
| BG-04 | Meningkatkan kualitas servis | Customer satisfaction > 4.5/5.0 |
| BG-05 | Monetisasi | SaaS berbasis AI Query Credit atau Subscription |

### 2.3 Technical Goals

| No | Tujuan Teknis | Target |
|----|--------------|--------|
| TG-01 | Latensi koneksi ECU | < 3 detik (Fast Init) |
| TG-02 | Update rate live sensor | ≥ 5 Hz (5 kali per detik) |
| TG-03 | Latensi respons AI | < 5 detik (p95) |
| TG-04 | Uptime firmware ESP32 | > 99% (WDT + error recovery) |
| TG-05 | Akurasi diagnosis AI | > 85% sesuai ground truth mekanik senior |

---

## 3. User Persona

### Persona 1 — Andi, Si Pemula (Hobbyist)

```
┌─────────────────────────────────────────────────┐
│  👤 Andi, 22 tahun                              │
│  Mahasiswa Teknik, pemilik Honda Beat 2022       │
│                                                  │
│  📍 Background                                   │
│  Baru belajar PGM-FI dari YouTube & forum       │
│  Belum pernah pakai alat diagnostik             │
│                                                  │
│  😤 Pain Points                                  │
│  • MIL (lampu engine) nyala, tidak tahu artinya │
│  • Takut salah diagnosis = buang uang            │
│  • Bengkel bilang "ganti ini itu" tanpa bukti    │
│                                                  │
│  🎯 Goals                                        │
│  • Bisa baca DTC sendiri                        │
│  • Mengerti arti kode error dari AI             │
│  • Validasi rekomendasi bengkel                 │
│                                                  │
│  💡 Quote: "Saya mau ngerti motor saya sendiri" │
└─────────────────────────────────────────────────┘
```

**Kebutuhan Utama**: UI sederhana, penjelasan AI dalam bahasa awam, step-by-step yang jelas.

---

### Persona 2 — Budi, Mekanik Bengkel

```
┌─────────────────────────────────────────────────┐
│  👤 Budi, 35 tahun                              │
│  Pemilik bengkel Honda di kota kecil            │
│                                                  │
│  📍 Background                                   │
│  12 tahun pengalaman mekanik                    │
│  Melakukan 8-15 servis per hari                 │
│                                                  │
│  😤 Pain Points                                  │
│  • Tidak punya alat HDS, biaya terlalu mahal    │
│  • Motor injeksi sering bikin bingung           │
│  • Harus nebak-nebak = berisiko salah           │
│  • Customer tidak percaya tanpa bukti data      │
│                                                  │
│  🎯 Goals                                        │
│  • Diagnosis cepat ≤ 10 menit                  │
│  • Data sensor sebagai bukti ke customer        │
│  • History servis tersimpan digital             │
│                                                  │
│  💡 Quote: "Yang penting bisa kerja, cepat,    │
│             dan tidak ribet"                    │
└─────────────────────────────────────────────────┘
```

**Kebutuhan Utama**: Workflow cepat, laporan profesional untuk customer, riwayat servis.

---

### Persona 3 — Rizki, Teknisi Racing

```
┌─────────────────────────────────────────────────┐
│  👤 Rizki, 28 tahun                             │
│  Mekanik tim balap Honda regional               │
│                                                  │
│  📍 Background                                   │
│  Spesialis tuning ECU dan optimasi performa     │
│  Sering keliling ke sirkuit                     │
│                                                  │
│  😤 Pain Points                                  │
│  • Data logger bawaan motor kurang lengkap      │
│  • Perlu monitor kondisi sensor saat track day  │
│  • Tidak bisa bawa laptop besar ke pit          │
│                                                  │
│  🎯 Goals                                        │
│  • Data logger realtime saat di sirkuit         │
│  • Live grafik RPM, TPS, MAP, O2 bersamaan      │
│  • Ekspor data untuk analisis post-race         │
│                                                  │
│  💡 Quote: "Data is everything in racing"       │
└─────────────────────────────────────────────────┘
```

**Kebutuhan Utama**: Data logger, multi-grafik, export CSV, akses terminal manual.

---

### Persona 4 — Pak Darmawan, Guru SMK

```
┌─────────────────────────────────────────────────┐
│  👤 Pak Darmawan, 45 tahun                      │
│  Guru Teknik Otomotif SMK                       │
│                                                  │
│  📍 Background                                   │
│  Mengajar sistem PGM-FI kepada 30+ siswa/kelas  │
│  Anggaran sekolah terbatas                      │
│                                                  │
│  😤 Pain Points                                  │
│  • Tidak punya alat peraga yang memadai         │
│  • HDS terlalu mahal untuk dibeli sekolah       │
│  • Siswa tidak bisa praktik langsung            │
│                                                  │
│  🎯 Goals                                        │
│  • Alat peraga murah untuk praktikum            │
│  • Siswa bisa lihat data ECU nyata              │
│  • AI membantu penjelasan yang mudah dipahami   │
│                                                  │
│  💡 Quote: "Belajar teori tanpa praktik = sia-  │
│             sia"                                │
└─────────────────────────────────────────────────┘
```

**Kebutuhan Utama**: Mode edukasi, penjelasan lengkap tiap sensor, multi-koneksi untuk kelas.

---

## 4. Use Case

### 4.1 Use Case Utama — Diagnosis Motor

```
┌─────────────────────────────────────────────────────────────┐
│                   USE CASE: DIAGNOSIS MOTOR                 │
└─────────────────────────────────────────────────────────────┘

  [Motor datang dengan MIL menyala]
          │
          ▼
  [Pasang OBD Connector ke motor]
          │
          ▼
  [Nyalakan ESP32 & Buka Aplikasi Mobile WRT Garage]
          │
          ▼
  [Koneksikan HP ke ESP32 via Bluetooth (BLE / SPP)]
          │
          ▼
  [Pastikan Data Internet HP (4G/5G) Aktif]
          │
          ▼
  [Tap "Connect ECU" di Aplikasi]
          │
          ▼
  [ESP32 Fast Init → 5-Baud Init → Auto Detect]
          │
     ┌────┴────┐
  [GAGAL]  [SUKSES]
     │          │
     ▼          ▼
  [Error    [Tampil: ECU Info
  Message]   Part No + Motor Type]
                │
                ▼
          [Read DTC via Bluetooth]
                │
          ┌─────┴─────┐
       [Ada DTC]   [No DTC]
          │              │
          ▼              ▼
    [Tampil DTC     [Motor OK,
     List + Code]    Clear Riwayat]
          │
          ▼
    [Read Live Data via Bluetooth]
    (RPM, TPS, MAP, IAT, ECT, O2, Battery)
          │
          ▼
    [Read Freeze Frame via Bluetooth]
    (kondisi sensor saat DTC trigger)
          │
          ▼
    [Tap "AI Diagnosis" di Aplikasi]
          │
          ▼
    [App mengemas DTC + Live Data ke JSON]
          │
          ▼
    [Kirim via Internet HP (4G/5G) → Backend API di VPS (Docker Container)]
          │
          ▼
    [Backend API (Docker di VPS) → OpenRouter AI API (via OpenRouter API Key)]
          │
          ▼
    [AI Response: Analisis + Prioritas + Langkah]
          │
          ▼
    [Backend API (VPS) → Tampilkan hasil di Aplikasi Mobile]
          │
          ▼
    [Mekanik lakukan perbaikan]
          │
          ▼
    [Clear DTC via Bluetooth]
          │
          ▼
    [Road Test / Verifikasi]
          │
          ▼
    [Simpan ke History / Generate Laporan]
          │
          ▼
        [SELESAI]
```

### 4.2 Use Case — Data Logger (Racing)

```
  [Track Day / Road Test]
          │
          ▼
  [Connect ECU]
          │
          ▼
  [Start Data Logger]
          │
          ▼
  [Rekam: RPM, TPS, MAP, O2, ECT setiap 200ms]
          │
          ▼
  [Simpan ke LittleFS / SD Card]
          │
          ▼
  [Stop Logger setelah finish]
          │
          ▼
  [Export CSV]
          │
          ▼
  [Analisis di PC / AI Post-Race Analysis]
```

### 4.3 Use Case — Cetak Struk Diagnosis (Thermal Printer)

```
  [Hasil Diagnosis Gemini AI Tampil di App]
          │
          ▼
  [Tap "Cetak Struk"]
          │
          ▼
  [Pilih / Connect Thermal Printer via Bluetooth]
          │
          ▼
  [App Generate Command Stream (ESC/POS / ZPL)]
          │
          ▼
  [Kirim via Bluetooth → Printer Cetak Laporan Struk Fisik]
```

---

## 5. AI Diagnosis Engine

### 5.1 Arsitektur 3 Layer

```
┌────────────────────────────────────────────────────────────┐
│                    AI DIAGNOSIS ENGINE                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LAYER 1: RULE ENGINE                    │  │
│  │                                                      │  │
│  │   P0113 ──→ Lookup Table ──→ "IAT Sensor High"      │  │
│  │   P0562 ──→ Lookup Table ──→ "Battery Voltage Low"  │  │
│  │                                                      │  │
│  │   [Honda DTC Database: 200+ fault codes]            │  │
│  │   - Nama sensor resmi Honda                         │  │
│  │   - Threshold nilai normal                          │  │
│  │   - Sistem yang terlibat                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│                           ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           LAYER 2: KNOWLEDGE BASE                    │  │
│  │                                                      │  │
│  │   Sensor → Spesifikasi Honda PGM-FI                 │  │
│  │                                                      │  │
│  │   IAT:  -40°C to +120°C, 5V reference               │  │
│  │         Normal idle: 25-40°C ambient                 │  │
│  │         -40°C = open circuit / short to 5V           │  │
│  │                                                      │  │
│  │   ECT:  -40°C to +130°C                             │  │
│  │         Normal operating: 75-100°C                   │  │
│  │                                                      │  │
│  │   Kemungkinan Kerusakan per Kode:                   │  │
│  │   P0113 → [sensor rusak, konektor lepas,            │  │
│  │            kabel putus, ECU fault]                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│                           ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             LAYER 3: AI REASONING                    │  │
│  │                                                      │  │
│  │   OpenRouter AI API (via OpenRouter API Key)         │  │
│  │      │                                               │  │
│  │      ├→ Korelasi DTC dengan Live Data               │  │
│  │      ├→ Analisis pola (mis: IAT -40° + ECT 92°      │  │
│  │      │   = sensor IAT open circuit, bukan ECU)      │  │
│  │      ├→ Prioritas kerusakan (probabilistik)         │  │
│  │      ├→ Langkah pengecekan sistematis               │  │
│  │      └→ Estimasi biaya perbaikan                    │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 5.2 DTC Database Structure

```json
{
  "dtc_database": {
    "P0113": {
      "code": "P0113",
      "name": "Intake Air Temperature Sensor High Input",
      "sensor": "IAT",
      "circuit": "Signal High / Open",
      "normal_range": "-40°C to 120°C",
      "fault_condition": "Tegangan sinyal > 4.8V (sensor open)",
      "possible_causes": [
        "Sensor IAT rusak / terbuka",
        "Konektor IAT kotor atau putus",
        "Kabel signal dari sensor ke ECU putus",
        "ECU internal fault"
      ],
      "check_steps": [
        "Ukur tegangan di pin sensor IAT (harus 0-5V sesuai suhu)",
        "Periksa konektor IAT dari kotoran, karat, atau retakan",
        "Test resistansi sensor: -40°C = 100kΩ, 25°C = 2.4kΩ",
        "Jika sensor dan konektor OK → kemungkinan ECU"
      ],
      "priority": "medium",
      "mil_status": "on",
      "related_dtc": ["P0112", "P0114"]
    }
  }
}
```

### 5.3 Sensor Knowledge Base

| Sensor | Pin ECU | Range | Normal (Idle) | Fault Value | Satuan |
|--------|---------|-------|---------------|-------------|--------|
| RPM | CKP | 0 – 15000 | 1300 – 1500 | 0 (no signal) | rpm |
| TPS | TP | 0.3 – 4.7 | 0.3 – 0.8 | < 0.2 atau > 4.8 | V |
| MAP | MAP | 0 – 100 | 25 – 35 (idle) | 0 atau > 100 | kPa |
| IAT | TA | -40 – 120 | 25 – 40 | -40 (open) | °C |
| ECT | TW | -40 – 130 | 75 – 95 | -40 atau > 120 | °C |
| O2 | HO2S | 0.1 – 0.9 | 0.4 – 0.6 | < 0.1 atau stuck | V |
| Battery | VB | 10 – 16 | 13.5 – 14.5 | < 11 atau > 15.5 | V |
| IACV | IACV | 0 – 100 | 30 – 60 | 0 atau 100 (stuck) | % |
| Fuel Trim | FT | -25 – +25 | ±5 | > ±20 | % |

### 5.4 AI Reasoning Examples

**Contoh Kasus 1: P0113 + IAT = -40°C + ECT = 92°C**

```
Analisis AI:
  
  Data: P0113 (IAT High), IAT = -40°C, ECT = 92°C
  
  ✓ ECT 92°C menunjukkan mesin sudah panas → sensor suhu ECT bekerja
  ✓ IAT -40°C adalah nilai BATAS BAWAH (open circuit / short to 5V)
  
  Kesimpulan: Sensor IAT OPEN CIRCUIT (bukan ECU fault)
  karena jika ECU rusak, ECT juga pasti bermasalah.
  
  Prioritas: Ganti sensor IAT atau periksa konektor IAT dulu.
```

**Contoh Kasus 2: P0562 + Battery = 13.8V**

```
  Analisis AI:
  
  Data: P0562 (Battery Voltage Low), Battery = 13.8V
  
  ✓ Tegangan 13.8V = NORMAL (range 13.5-14.5V)
  ✓ Tapi DTC ada → kemungkinan DTC ini sudah dari kondisi lama
    saat voltage pernah drop (mis: aki lemah sebelumnya)
  
  Rekomendasi:
  1. Clear DTC
  2. Monitor battery saat riding 20-30 menit
  3. Jika DTC tidak muncul lagi → aman, DTC lama
  4. Jika muncul lagi → periksa alternator dan regulator
```

---

## 6. AI Prompt System

### 6.1 System Prompt (Master Prompt)

```
SYSTEM PROMPT — WRT Garage AI Diagnosis Engine

Anda adalah Honda Master Technician dengan pengalaman 20 tahun menangani 
sepeda motor Honda PGM-FI (Programmed Fuel Injection).

TUGAS ANDA:
Menganalisis data ECU Honda PGM-FI yang dikirimkan dalam format JSON
dan memberikan diagnosis yang akurat, terstruktur, dan mudah dipahami.

ATURAN DIAGNOSIS:
1. Analisis DTC bersama dengan data sensor live — jangan isolasi keduanya
2. Prioritaskan kemungkinan penyebab dari yang paling umum ke yang langka
3. Jangan menyimpulkan tanpa bukti dari data yang tersedia
4. Jika data tidak cukup untuk diagnosis definitif, sebutkan data apa yang dibutuhkan
5. Berikan langkah pengecekan secara berurutan (dari yang mudah ke sulit)
6. Estimasi biaya perbaikan dalam Rupiah (kisaran bengkel umum)
7. Gunakan bahasa Indonesia yang sederhana — sesuai level mekanik bengkel

FORMAT RESPONS (wajib):
{
  "summary": "Ringkasan 1-2 kalimat kondisi motor",
  "risk_level": "low|medium|high|critical",
  "primary_cause": {
    "description": "Penyebab utama yang paling mungkin",
    "confidence": "85%",
    "evidence": ["data sensor yang mendukung kesimpulan ini"]
  },
  "alternative_causes": [
    {"description": "Penyebab alternatif 1", "confidence": "10%"},
    {"description": "Penyebab alternatif 2", "confidence": "5%"}
  ],
  "check_steps": [
    "Langkah 1: ...",
    "Langkah 2: ...",
    "Langkah 3: ..."
  ],
  "parts_needed": [
    {"part": "Nama sparepart", "price_estimate": "Rp XX.000 - XX.000"}
  ],
  "additional_data_needed": ["jika ada data yang kurang"],
  "safety_warning": "jika ada risiko keselamatan"
}
```

### 6.2 User Payload (JSON ke AI)

```json
{
  "request_id": "sess_20260805_001",
  "motor": {
    "brand": "Honda",
    "model": "PCX160",
    "year": 2023,
    "mileage_km": 12450
  },
  "ecu": {
    "part_number": "38770-K1Z-B01",
    "firmware_version": "1.12"
  },
  "dtc": {
    "active": ["P0113", "P0562"],
    "pending": ["P0171"],
    "cleared_history": []
  },
  "live_data": {
    "rpm": 1450,
    "ect_celsius": 92,
    "iat_celsius": -40,
    "battery_volt": 13.8,
    "map_kpa": 32,
    "tps_volt": 0.52,
    "o2_volt": 0.48,
    "fuel_trim_pct": 8.5,
    "iacv_pct": 42,
    "vehicle_speed": 0
  },
  "freeze_frame": {
    "dtc_trigger": "P0113",
    "rpm_at_trigger": 2800,
    "ect_at_trigger": 88,
    "iat_at_trigger": -40,
    "load_at_trigger": 35
  },
  "service_history": {
    "last_service_km": 10000,
    "last_dtc_cleared": "2026-05-12",
    "recurring_dtc": ["P0113"]
  },
  "context": {
    "symptom_reported": "MIL nyala, terkadang brebet saat gas dibuka",
    "when_started": "3 hari yang lalu setelah hujan"
  }
}
```

### 6.3 Contoh AI Response

```json
{
  "summary": "Motor mengalami fault pada sensor IAT (Suhu Udara Masuk) yang kemungkinan besar disebabkan oleh kontak konektor yang bermasalah, dipicu oleh paparan hujan 3 hari lalu.",
  
  "risk_level": "medium",
  
  "primary_cause": {
    "description": "Sensor IAT mengalami open circuit atau konektor berkarat akibat air masuk",
    "confidence": "88%",
    "evidence": [
      "IAT = -40°C adalah nilai minimum (open circuit), bukan suhu udara nyata",
      "ECT = 92°C normal — menunjukkan ECU dapat membaca sensor lain dengan benar",
      "DTC P0113 adalah fault IAT high, konsisten dengan open circuit",
      "Fault muncul setelah hujan — konektor basah/berkarat"
    ]
  },
  
  "alternative_causes": [
    {"description": "Kabel signal IAT putus di tengah kabel harness", "confidence": "8%"},
    {"description": "Sensor IAT rusak internal", "confidence": "4%"}
  ],
  
  "check_steps": [
    "1. Cari konektor sensor IAT (biasanya di air filter box atau intake manifold)",
    "2. Buka konektor, periksa visual: ada karat, kotoran, atau pin bengkok?",
    "3. Bersihkan konektor dengan electrical contact cleaner",
    "4. Pasang kembali, start mesin, cek apakah IAT sudah normal (25-40°C)",
    "5. Jika masih -40°C: ukur resistansi sensor IAT (suhu 30°C = sekitar 1.8kΩ)",
    "6. Jika resistansi sensor OK: ikuti kabel dari sensor ke ECU, cari kabel putus"
  ],
  
  "parts_needed": [
    {"part": "Sensor IAT Honda PGM-FI (jika perlu ganti)", "price_estimate": "Rp 80.000 - 150.000"},
    {"part": "Electrical Contact Cleaner (Semprotkan ke konektor)", "price_estimate": "Rp 25.000 - 40.000"}
  ],
  
  "additional_data_needed": [],
  
  "safety_warning": "Motor aman dikendarai jangka pendek, namun campuran bahan bakar mungkin tidak optimal karena ECU menggunakan nilai IAT default. Segera perbaiki untuk efisiensi BBM optimal."
}
```

---

## 7. System Architecture

### 7.1 Arsitektur Sistem Lengkap

```
┌──────────────────────────────────────────────────────────────┐
│                       ESP32 FIRMWARE                         │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │  Bluetooth  │ │  BLE / SPP   │ │    LittleFS         │   │
│  │  BLE & SPP  │ │  Serial Svc  │ │  log/ conf/        │   │
│  └─────────────┘ └──────────────┘ └─────────────────────┘   │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │  Cmd Router │ │  ECU Manager │ │   K-Line Driver     │   │
│  │  BT Serial  │ │  Live/DTC    │ │  Fast/5Baud/AutoDet │   │
│  └─────────────┘ └──────────────┘ └──────────┬──────────┘   │
│                                              │ UART2         │
│  ┌─────────────┐ ┌──────────────┐           │               │
│  │  OTA Update │ │  Data Logger │           │               │
│  │  (via BT)   │ │  Ring Buffer │           │               │
│  └─────────────┘ └──────────────┘           │               │
└──────────────────────┬───────────────────────┼──────────────┘
                       │                       │
                       │ Bluetooth (BLE / SPP) │
                       ▼                       │
┌───────────────────────────────────────────┐  │
│          SMARTPHONE / MOBILE APP          │  │
│        (React Native / Flutter)           │  │
│                                           │  │
│  1. Baca DTC & Live Data via Bluetooth    │  │
│  2. Format JSON Payload untuk AI          │  │
│  3. Kirim Payload via Data Internet HP    │  │
└──────────────────────┬────────────────────┘  │
                       │                       │
                       │ Data Internet HP      │
                       │ (4G / 5G / Cellular)  │
                       ▼                       │
┌───────────────────────────────────────────┐  │
│     BACKEND SERVER (VPS / DOCKER)         │  │
│      (Node.js Container di VPS Host)      │  │
│                                           │  │
│  • Infrastructure: Cloud VPS              │  │
│  • Deployment: Docker Container / Compose │  │
│  • Endpoint: POST /api/ai/diagnose        │  │
│  • Layer 1: Rule Engine (Lookup)          │  │
│  • Layer 2: Knowledge Base Sensor         │  │
│  • Security & API Key Protection          │  │
└──────────────────────┬────────────────────┘  │
                       │                       │
                       │ HTTPS REST            │
                       ▼                       │
┌───────────────────────────────────────────┐  │
│           OPENROUTER AI API               │  │
│    (OpenRouter API Key — Multi-LLM)       │  │
│                                           │  │
│  • Reasoning & Prioritas Kerusakan        │  │
│  • Rekomendasi Langkah Pengecekan         │  │
└───────────────────────────────────────────┘  │
                                               │
                                      ┌────────▼────────┐
                                      │      4N35       │
                                      │   Optocoupler   │
                                      └────────┬────────┘
                                               │
                                      ┌────────▼────────┐
                                      │ Honda K-Line    │
                                      │ OBD Connector   │
                                      │ (10400 bps)     │
                                      └─────────────────┘
```

### 7.2 API Endpoints (ESP32)

| Method | Endpoint | Deskripsi |
|--------|---------|-----------|
| GET | `/api/status` | Status koneksi ECU |
| POST | `/api/ecu/connect` | Inisiasi koneksi K-Line |
| GET | `/api/ecu/info` | Info ECU (part number, firmware) |
| GET | `/api/dtc` | Baca semua DTC |
| DELETE | `/api/dtc` | Clear DTC |
| GET | `/api/live` | Live sensor data (snapshot) |
| WS | `/ws/live` | WebSocket stream live sensor |
| GET | `/api/freeze` | Baca Freeze Frame |
| POST | `/api/logger/start` | Mulai Data Logger |
| POST | `/api/logger/stop` | Hentikan Data Logger |
| GET | `/api/logger/export` | Download CSV |
| POST | `/api/update` | OTA firmware update |
| GET | `/api/settings` | Baca settings |
| POST | `/api/settings` | Simpan settings |

### 7.3 API Endpoints (Backend/AI)

| Method | Endpoint | Deskripsi |
|--------|---------|-----------|
| POST | `/api/ai/diagnose` | AI diagnosis lengkap |
| POST | `/api/ai/chat` | AI chat (tanya jawab bebas) |
| GET | `/api/dtc-db/:code` | Lookup DTC database |
| GET | `/api/motors` | List motor yang didukung |
| POST | `/api/sessions` | Simpan sesi servis |
| GET | `/api/sessions/:id` | Ambil sesi servis |
| POST | `/api/feedback` | Submit feedback diagnosis |

### 7.4 Infrastruktur & Deployment Backend (VPS & Docker)

Sistem backend (`wrt-backend`) dijalankan di atas **Virtual Private Server (VPS)** menggunakan teknologi **Docker Container** untuk menjamin isolasi, keamanan, dan portabilitas aplikasi:

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS HOST (Linux Server)                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             Reverse Proxy (Nginx / Caddy)             │  │
│  │             - SSL/TLS HTTPS Certificate               │  │
│  │             - Port 443 ──→ Container Port 3000        │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               DOCKER CONTAINER (wrt-backend)          │  │
│  │  - Node.js Runtime App Environment                    │  │
│  │  - Layer 1: Rule Engine (dtc_database.json)           │  │
│  │  - Layer 2: Sensor Knowledge Base Engine              │  │
│  │  - Layer 3: OpenRouter AI API Controller (OpenRouter) │  │
│  │  - Database Service (PostgreSQL / SQLite di VPS)      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Spesifikasi Layanan Docker di VPS:**
1. **Container Isolation**: Aplikasi backend terbungkus rapi dalam image Docker sehingga dependencies stabil & tidak bergantung pada OS host VPS.
2. **Keamanan API**: HTTPS (SSL) dikelola oleh Reverse Proxy di VPS. HP mengirim request aman via TLS/HTTPS ke API VPS.
3. **Kemudahan Scalability & Auto-Restart**: Konfigurasi `docker-compose.yml` dengan restart policy `unless-stopped` memastikan service backend selalu aktif dan dapat di-restart secara cepat jika terjadi kesalahan.

---

## 8. Database Schema

> **Lokasi & Arsitektur Database**: Seluruh database (PostgreSQL / SQLite) terpusat dan berjalan di **VPS Host / Docker Container** bersama service backend `wrt-backend`. Mobile App dan ESP32 tidak menyimpan database utama secara lokal, melainkan mengakses & melakukan sinkronisasi data via HTTPS REST API ke VPS.

### 8.1 Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Customer   │────▶│   Vehicle    │────▶│  ECU_Info    │
│              │ 1:N │              │ 1:1 │              │
│ - id         │     │ - id         │     │ - part_number│
│ - name       │     │ - customer_id│     │ - vehicle_id │
│ - phone      │     │ - make       │     │ - fw_version │
│ - email      │     │ - model      │     │ - diag_count │
└──────────────┘     │ - year       │     └──────────────┘
                     │ - vin        │
                     │ - mileage_km │
                     └──────┬───────┘
                            │ 1:N
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
    ┌──────────────────┐       ┌─────────────────────┐
    │  Service_Session │       │    Print_History    │
    │                  │       │                     │
    │ - id             │       │ - id                │
    │ - vehicle_id     │       │ - vehicle_id        │
    │ - date           │       │ - timestamp         │
    │ - mileage        │       │ - printer_type      │
    │ - technician     │       │ - dtc_summary       │
    │ - notes          │       │ - paper_width       │
    └────────┬─────────┘       └─────────────────────┘
    ┌────────┴────────────────────────┐
    │                                 │
    ▼                                 ▼
┌────────────────┐         ┌──────────────────────┐
│   DTC_Record   │         │   AI_Session         │
│                │         │                      │
│ - id           │         │ - id                 │
│ - session_id   │         │ - session_id         │
│ - dtc_code     │         │ - request_payload    │
│ - status       │         │ - ai_response        │
│ - first_seen   │         │ - model_used         │
│ - cleared_at   │         │ - latency_ms         │
│ - freeze_frame │         │ - feedback_score     │
└────────────────┘         └──────────────────────┘

┌────────────────────────────────────────────┐
│              Live_Data_Log                 │
│                                            │
│ - id, session_id, timestamp               │
│ - rpm, tps, map, iat, ect, o2             │
│ - battery, iacv, fuel_trim                │
│ - vehicle_speed, throttle_pos             │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│              DTC_Database (Static)         │
│                                            │
│ - code (PK)                               │
│ - name, description                       │
│ - sensor_affected                         │
│ - normal_range                            │
│ - fault_condition                         │
│ - possible_causes (JSON array)            │
│ - check_steps (JSON array)               │
│ - priority, mil_status                    │
│ - related_dtc (JSON array)               │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│           Firmware_Update_History          │
│                                            │
│ - id, device_id                           │
│ - from_version, to_version                │
│ - updated_at, method (OTA/USB)            │
│ - status (success/failed/rollback)        │
└────────────────────────────────────────────┘
```

### 8.2 Tabel Utama — Detail

#### Tabel: `vehicles`
```sql
CREATE TABLE vehicles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER REFERENCES customers(id),
    make         TEXT DEFAULT 'Honda',
    model        TEXT NOT NULL,           -- 'PCX160', 'Beat FI', dll
    year         INTEGER,
    vin          TEXT UNIQUE,
    plate_number TEXT,
    mileage_km   INTEGER DEFAULT 0,
    color        TEXT,
    notes        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabel: `service_sessions`
```sql
CREATE TABLE service_sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id     INTEGER REFERENCES vehicles(id),
    technician_id  INTEGER REFERENCES users(id),
    started_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at    DATETIME,
    mileage_at_svc INTEGER,
    complaint      TEXT,    -- Keluhan customer
    finding        TEXT,    -- Temuan mekanik
    action_taken   TEXT,    -- Perbaikan yang dilakukan
    parts_replaced TEXT,    -- Sparepart yang diganti (JSON)
    total_cost_idr INTEGER,
    status         TEXT CHECK(status IN ('open','completed','follow_up'))
);
```

#### Tabel: `ai_sessions`
```sql
CREATE TABLE ai_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER REFERENCES service_sessions(id),
    request_json    TEXT NOT NULL,    -- JSON payload ke AI
    response_json   TEXT,             -- Respons AI mentah
    parsed_summary  TEXT,             -- Summary yang ditampilkan ke user
    model_used      TEXT DEFAULT 'google/gemini-2.5-flash', -- Model ID via OpenRouter
    tokens_used     INTEGER,
    latency_ms      INTEGER,
    feedback_score  INTEGER CHECK(feedback_score BETWEEN 1 AND 5),
    feedback_note   TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 9. Mobile App — Halaman & Fitur

### 9.1 Navigasi Utama

```
┌─────────────────────────────────────────┐
│              BOTTOM NAVIGATION          │
├──────────┬──────────┬──────────┬────────┤
│ Dashboard│ Diagnosis│  History │Settings│
│    🏠    │    🔍    │    📋    │   ⚙️   │
└──────────┴──────────┴──────────┴────────┘
```

### 9.2 Halaman — Detail Per Layar

#### 🏠 Dashboard
```
┌────────────────────────────────┐
│  WRT Garage          [≡]  [🔔]│
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │  Status Koneksi ECU      │  │
│  │  🟢 Connected — PCX160   │  │
│  │  Part: 38770-K1Z-B01    │  │
│  └──────────────────────────┘  │
│                                │
│  Quick Stats                   │
│  ┌──────┐ ┌──────┐ ┌────────┐ │
│  │ RPM  │ │ ECT  │ │Battery │ │
│  │ 1450 │ │ 92°C │ │ 13.8V │ │
│  └──────┘ └──────┘ └────────┘ │
│                                │
│  ⚠️ Active DTC: 2              │
│  P0113 | P0562                 │
│                                │
│  [🔍 AI Diagnosis]             │
│  [📊 Live Data]                │
│  [🖨️ Cetak Struk]              │
└────────────────────────────────┘
```

#### 📊 Live Data
```
┌────────────────────────────────┐
│  ← Live Data            [⏸] [●]│
├────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │ RPM ▓▓▓▓▓▓░░░░░ 1450   │   │
│  │ TPS ▓░░░░░░░░░░  0.52V │   │
│  │ ECT ▓▓▓▓▓▓░░░░░  92°C  │   │
│  │ IAT ░░░░░░░░░░░ -40°C ⚠│   │
│  │ MAP ▓▓▓░░░░░░░░  32kPa │   │
│  │ O2  ▓▓▓▓░░░░░░░  0.48V │   │
│  │ VB  ▓▓▓▓▓▓▓░░░░ 13.8V │   │
│  └─────────────────────────┘   │
│                                │
│  📈 Graph (tap sensor to plot) │
│  [RPM ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁]      │
│                                │
│  [⬇ Export CSV]               │
└────────────────────────────────┘
```

#### 🔍 AI Diagnosis
```
┌────────────────────────────────┐
│  ← AI Diagnosis                │
├────────────────────────────────┤
│  DTC Terdeteksi:               │
│  🔴 P0113 — IAT High Input    │
│  🟡 P0562 — Battery Volt Low  │
│  🔵 P0171 — System Lean (Pend)│
│                                │
│  [Sertakan Live Data ✅]       │
│  [Sertakan Freeze Frame ✅]    │
│  [Keluhan]: Motor brebet ...   │
│                                │
│  [🤖 Analisis dengan AI]      │
├────────────────────────────────┤
│  Hasil Diagnosis AI:           │
│  ┌──────────────────────────┐  │
│  │ ⚠️ MEDIUM RISK           │  │
│  │ Sensor IAT open circuit  │  │
│  │ kemungkinan akibat       │  │
│  │ konektor basah (hujan)   │  │
│  │                          │  │
│  │ Confidence: 88%          │  │
│  │                          │  │
│  │ [Lihat Langkah Perbaikan]│  │
│  │ [Estimasi Biaya]         │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

#### 🖨️ Cetak Struk Diagnosis
```
┌────────────────────────────────┐
│  ← Cetak Struk Thermal        │
├────────────────────────────────┤
│  Status Printer:               │
│  🟢 Connected — POS-5802       │
│                                │
│  Preview Struk:                │
│  ┌──────────────────────────┐  │
│  │ WRT GARAGE AI DIAGNOSTIC │  │
│  │ Motor: PCX160 (2023)     │  │
│  │ DTC  : P0113 (IAT High)  │  │
│  │ Risiko: MEDIUM           │  │
│  └──────────────────────────┘  │
│                                │
│  Format: [58mm] [80mm] [Zebra] │
│                                │
│  [🖨️ Cetak Laporan Sekarang]   │
└────────────────────────────────┘
```

#### 🖥️ Manual Terminal
```
┌────────────────────────────────┐
│  ← K-Line Terminal             │
├────────────────────────────────┤
│  [72 05 71 00 18]              │
│  TX → 72 05 71 00 18          │
│  RX ← 02 04 71 7F D1          │
│  [FE 04 72 8C]                 │
│  TX → FE 04 72 8C             │
│  RX ← 04 04 72 00 F6          │
│                                │
│  ┌──────────────────────────┐  │
│  │ 72 05 71 00 18           │  │
│  └──────────────────────────┘  │
│  [Send] [Clear] [History]     │
└────────────────────────────────┘
```

### 9.3 Semua Halaman

| # | Halaman | Fitur Utama |
|---|---------|-------------|
| 1 | **Dashboard** | Status ECU, Quick Stats, DTC alert, Quick Actions |
| 2 | **Live Data** | 14 sensor realtime, progress bar, grafik, export CSV |
| 3 | **DTC** | List active/pending DTC, detail per kode, Clear DTC |
| 4 | **Freeze Frame** | Data sensor saat DTC trigger, perbandingan dengan normal |
| 5 | **AI Diagnosis** | Analisis AI, rekomendasi, estimasi biaya, langkah perbaikan |
| 6 | **AI Chat** | Tanya jawab bebas tentang kondisi motor |
| 7 | **Data Logger** | Start/stop logger, grafik post-run, export CSV |
| 8 | **Cetak Struk** | Preview & cetak laporan diagnosis ke printer thermal Bluetooth |
| 9 | **Diagnostic Analytics** | Visualisasi tren sensor & analisis histori kerusakan |
| 10 | **Terminal** | Manual HEX terminal K-Line |
| 11 | **Sensor Test** | Aktuasi output ECU untuk test komponen |
| 12 | **ECU Info** | Part number, firmware, supported features |
| 13 | **Service History** | Riwayat servis, laporan PDF, statistik |
| 14 | **Settings** | Bluetooth, baudrate, OpenRouter AI API key, model selection, tema, bahasa |
| 15 | **OTA Update** | Update firmware ESP32 via Bluetooth / WiFi |
| 16 | **Print Struk** | Cetak hasil diagnosis AI ke Thermal Mini Printer (Bluetooth / Zebra) |

---

### 9.4 Fitur Cetak Struk Diagnosis (Mini Thermal Printer & Zebra)

#### 1. Arsitektur & Jalur Koneksi Printer

```
┌───────────────────────────┐      Bluetooth (SPP / BLE)      ┌───────────────────────────┐
│     Aplikasi Mobile       │ ──────────────────────────────► │    Mini Thermal Printer   │
│   (React Native/Flutter)  │   (ESC/POS atau Zebra ZPL)      │   (58mm / 80mm / Zebra)   │
└─────────────┬─────────────┘                                 └───────────────────────────┘
              │
              │ Fetch AI Result
              ▼
┌───────────────────────────┐
│       Backend Server      │
│   (Format Struk Generator)│
└───────────────────────────┘
```

Aplikasi Mobile secara simultan mengelola 2 koneksi Bluetooth:
- **BT Channel 1**: ESP32 (Membaca data K-Line ECU)
- **BT Channel 2**: Printer Mini Thermal / Zebra (Mengirim command cetak struk)

#### 2. Spesifikasi Standar & Printer yang Didukung

| Jenis Printer | Lebar Kertas | Protokol Command | Contoh Model Printer |
|---------------|--------------|------------------|----------------------|
| **Generic Mini Thermal** | 58mm (32 Karakter) | ESC/POS | RPP02N, POS-5802, Bellav, Panda PRJ-58D |
| **Medium Thermal** | 80mm (48 Karakter) | ESC/POS | POS-8001, Epson TM-P20, Xprinter |
| **Zebra Portable** | 58mm / 80mm | ZPL II / CPCL | Zebra iMZ220, iMZ320, ZQ320, ZQ520 |

---

#### 3. Visual Layout Struk Diagnosis (Format 58mm — 32 Karakter)

```
================================
         WRT GARAGE AI          
   DIAGNOSTIC TEST REPORT       
================================
Tgl   : 06/08/2026 14:35
No.Pol: B 4589 KIZ
Motor : HONDA PCX 160 (2023)
KM    : 12.450 km
ECU   : 38770-K1Z-B01
--------------------------------
[ KODE ERROR (DTC) ]
🔴 P0113 : IAT Sensor High (Active)
🟡 P0562 : Battery Volt Low (Pend)
--------------------------------
[ RINGKASAN SENSOR REALTIME ]
RPM     : 1450 rpm  [NORMAL]
ECT     : 92 °C     [NORMAL]
IAT     : -40 °C    [FAULT ⚠️]
Teg.Aki : 13.8 V    [NORMAL]
MAP     : 32 kPa    [NORMAL]
--------------------------------
[ DIAGNOSIS OPENROUTER AI ]
Tingkat Risiko: ⚠️ MEDIUM

Penyebab Utama (88% Akurasi):
Sensor IAT Open Circuit / Kabel
Putus / Konektor Basah Air Hujan.

Langkah Pengecekan:
1. Cek konektor IAT di airbox
2. Semprot contact cleaner
3. Ukur resistansi (N: 2.4k ohm)
4. Ganti sensor jika rusak

Estimasi Biaya Sparepart:
- Sensor IAT : Rp 80.000 - 150.000
- Cleaner    : Rp 25.000
--------------------------------
 Scan QR untuk Laporan Digital:
      ┌───────────────┐
      │  [QR CODE]    │
      │  https://wrt. │
      │ garage/r/9012 │
      └───────────────┘
--------------------------------
Mekanik: Budi (WRT Garage)
Tanda Tangan:

(                             )
================================
 Terima Kasih Atas Kepercayaan 
       Servis Di Tempat Kami    
================================
```

---

#### 4. Contoh Kode Command Generation

##### A. Command ESC/POS (Generic 58mm Printer)
```javascript
// Function untuk generate buffer ESC/POS (JavaScript / React Native)
function generateEscPosReceipt(data) {
  const ESC = '\x1B';
  const GS  = '\x1D';

  let buffer = '';

  // Reset & Center Align Header
  buffer += ESC + '@';                       // Initialize printer
  buffer += ESC + 'a' + '\x01';              // Center align
  buffer += ESC + 'E' + '\x01';              // Bold ON
  buffer += 'WRT GARAGE AI DIAGNOSTIC\n';
  buffer += ESC + 'E' + '\x00';              // Bold OFF
  buffer += '--------------------------------\n';

  // Left Align Content
  buffer += ESC + 'a' + '\x00';              // Left align
  buffer += `Motor : ${data.motor}\n`;
  buffer += `Nopol : ${data.nopol}\n`;
  buffer += `DTC   : ${data.dtc_code} (${data.dtc_name})\n`;
  buffer += '--------------------------------\n';

  // AI Summary (Bold)
  buffer += ESC + 'E' + '\x01';
  buffer += `AI RISIKO: ${data.risk_level.toUpperCase()}\n`;
  buffer += ESC + 'E' + '\x00';
  buffer += `Analisis : ${data.ai_summary}\n`;
  buffer += '--------------------------------\n';

  // Feed & Cut
  buffer += '\n\n\n';
  buffer += GS + 'V' + '\x41' + '\x03';      // Cut paper (partial cut)

  return buffer;
}
```

##### B. Command Zebra ZPL II (Zebra Printer)
```zpl
^XA
^PW400
^LL800
^FO20,20^A0N,30,30^FDWRT GARAGE AI DIAGNOSTIC^FS
^FO20,60^GB360,2,2^FS
^FO20,80^A0N,22,22^FDDate: 06/08/2026^FS
^FO20,110^A0N,22,22^FDMotor: HONDA PCX160^FS
^FO20,140^A0N,22,22^FDDTC: P0113 - IAT High Input^FS
^FO20,180^GB360,2,2^FS
^FO20,200^A0N,24,24^FDAI DIAGNOSIS (Gemini):^FS
^FO20,230^FB360,5,0,L,0^FDAnalisis: Sensor IAT Open Circuit / Konektor basah akibat hujan. Lakukan pembersihan konektor dan cek kabel.^FS
^FO20,380^GB360,2,2^FS
^FO100,410^BQN,2,4^FDMM,AAC-https://wrt.garage/r/9012^FS
^FO20,600^A0N,20,20^FDScan QR untuk laporan lengkap^FS
^XZ
```

---

#### 5. Flowchart Fitur Cetak (Print Workflow)

```
  [Hasil Diagnosis Gemini AI Tampil di App]
                     │
                     ▼
       [Mekanik Tap Tombol "Cetak Struk"]
                     │
                     ▼
  [Aplikasi Scan Bluetooth Devices Nearby]
                     │
         ┌───────────┴───────────┐
   [Printer Ditemukan]     [Belum Paired]
         │                       │
         ▼                       ▼
   [Pilih Printer]       [Tampilkan Dialog Pair]
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
   [Deteksi Protocol Printer (ESC/POS / ZPL)]
                     │
                     ▼
   [Generate Command Stream Bytes (Text + QR)]
                     │
                     ▼
   [Kirim Stream Data via Bluetooth SPP / BLE]
                     │
                     ▼
      [Printer Mencetak Struk Fisik 📄]
                     │
                     ▼
   [Simpan Flag "Receipt Printed" di History Sesi]
```

---

## 10. ESP32 Firmware Architecture

### 10.1 FreeRTOS Task Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FreeRTOS SCHEDULER                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Core 0 (Protocol CPU)          Core 1 (Application CPU)  │
│  ─────────────────────          ─────────────────────────  │
│                                                             │
│  ┌─────────────────┐            ┌─────────────────────┐   │
│  │  Task: KLine    │            │  Task: WebServer    │   │
│  │  Priority: 5    │            │  Priority: 3        │   │
│  │  Stack: 8KB     │            │  Stack: 8KB         │   │
│  │  - Fast Init    │            │  - HTTP handler     │   │
│  │  - 5Baud Init   │            │  - WebSocket stream │   │
│  │  - Read/Write   │            │  - REST API         │   │
│  └─────────────────┘            └─────────────────────┘   │
│                                                             │
│  ┌─────────────────┐            ┌─────────────────────┐   │
│  │  Task: ECU Poll │            │  Task: BT Serial Mgr│   │
│  │  Priority: 4    │            │  Priority: 2        │   │
│  │  Stack: 4KB     │            │  Stack: 4KB         │   │
│  │  - Live sensor  │            │  - SPP/BLE service  │   │
│  │  - 200ms cycle  │            │  - Packet parser    │   │
│  │  - Ring Buffer  │            │  - Reconnect logic  │   │
│  └─────────────────┘            └─────────────────────┘   │
│                                                             │
│  ┌─────────────────┐            ┌─────────────────────┐   │
│  │  Task: Logger   │            │  Task: OTA          │   │
│  │  Priority: 2    │            │  Priority: 1        │   │
│  │  Stack: 4KB     │            │  Stack: 6KB         │   │
│  │  - CSV write    │            │  - HTTP download    │   │
│  │  - LittleFS     │            │  - Verify + Apply  │   │
│  └─────────────────┘            └─────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Task: WDT Monitor (Core 0, Priority 6)    │  │
│  │           - esp_task_wdt_reset() tiap task          │  │
│  │           - Auto-reset jika stuck > 30 detik        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Inter-Task Communication

```
                    FreeRTOS Queue & Semaphore

  [KLine Task] ──Queue──▶ [ECU Poll Task]
                                │
                           Queue (live data)
                                │
              ┌─────────────────┴────────────┐
              ▼                              ▼
    [WebSocket Task]               [Logger Task]
    (stream ke client)             (tulis ke LittleFS)
    
  Semaphore: kline_mutex (mencegah 2 task akses K-Line bersamaan)
  Queue: live_data_queue (capacity: 10 samples)
  EventGroup: ecu_connected_flag, logger_running_flag
```

### 10.3 WebSocket Live Data Protocol

```json
// Server → Client (setiap 200ms)
{
  "type": "live_data",
  "ts": 1722873600000,
  "data": {
    "rpm": 1450,
    "ect": 92,
    "iat": -40,
    "map": 32,
    "tps": 0.52,
    "o2": 0.48,
    "battery": 13.8,
    "iacv": 42,
    "fuel_trim": 8.5,
    "speed": 0
  }
}

// Server → Client (event DTC)
{
  "type": "dtc_alert",
  "dtc": "P0113",
  "status": "active",
  "ts": 1722873610000
}

// Client → Server
{
  "type": "subscribe",
  "channels": ["live_data", "dtc"]
}
```

### 10.4 Ring Buffer (Data Logger)

```c
// Ring buffer untuk data logger — tanpa malloc/free
// Kapasitas: 500 sample × 10 sensor × 4 byte = ~20KB
#define LOGGER_BUFFER_SIZE  500
#define LOGGER_SENSOR_COUNT 10

typedef struct {
    uint32_t timestamp_ms;
    int16_t  rpm;
    int8_t   ect;
    int8_t   iat;
    uint8_t  map;
    uint8_t  tps_raw;    // 0-255, konversi ke volt di app
    uint8_t  o2_raw;
    uint8_t  battery_raw;
    uint8_t  iacv_pct;
    int8_t   fuel_trim;
} LoggerSample;

typedef struct {
    LoggerSample buffer[LOGGER_BUFFER_SIZE];
    uint16_t     head;
    uint16_t     tail;
    uint16_t     count;
    bool         overflow;
} RingBuffer;
```

### 10.5 Bluetooth & Internet Connectivity Model

```
Modus Bluetooth (ESP32 ↔ Mobile App):
  Protocol: Bluetooth Classic SPP / Bluetooth Low Energy (BLE)
  Role: ESP32 sebagai Peripheral/Slave, HP Mobile App sebagai Central/Master
  Fungsi: Transmisi data K-Line (DTC, Live Sensor, Freeze Frame, Command Hex)

Modus Internet AI (Mobile App ↔ VPS Docker Backend):
  Source: Jaringan Seluler HP (4G/5G) atau WiFi HP yang sedang aktif
  Target: API Endpoint pada VPS Server (Layanan Docker Container via HTTPS)
  Protocol: HTTPS REST API / WSS (SSL/TLS Encrypted)
  Fungsi: Mengirim JSON Payload dari Aplikasi Mobile ke Backend API di VPS untuk diteruskan ke OpenRouter AI API (menggunakan OpenRouter API Key)
  Keuntungan: ESP32 hemat daya, backend terisolasi aman dalam Docker Container di VPS bersama Database terpusat, serta fleksibilitas pemilihan model LLM via OpenRouter.
```

### 10.6 Error Recovery

```
┌────────────────────────────────────────────┐
│           ERROR RECOVERY STRATEGY         │
├────────────────────────────────────────────┤
│                                            │
│  K-Line Timeout                           │
│    └→ Retry 3x dengan delay 300ms        │
│    └→ Jika gagal: set status DISCONNECTED │
│    └→ Notify WebSocket client             │
│                                            │
│  ECU No Response                          │
│    └→ Toggle Init Mode (Fast → 5Baud)     │
│    └→ Toggle invert polarity              │
│    └→ User notif: "Periksa konektor OBD" │
│                                            │
│  LittleFS Error                           │
│    └→ Format ulang jika corruption        │
│    └→ Backup ke SPIFFS fallback          │
│                                            │
│  Watchdog Timeout                         │
│    └→ esp_restart() otomatis             │
│    └→ Log error ke RTC memory sebelum RST│
│    └→ Recovery mode setelah restart      │
│                                            │
│  BT / Bluetooth Disconnect                 │
│    └→ Auto-reconnect BLE/SPP ke HP           │
│    └→ Notifikasi indikator di Aplikasi Mobile │
└────────────────────────────────────────────┘
```

---

## 11. Roadmap

### Overview Timeline

```
2026          2027              2028
Q3   Q4   Q1   Q2   Q3   Q4   Q1   Q2
│────│────│────│────│────│────│────│
v1.0 v2.0 v3.0      v4.0      v5.0 v6.0
```

---

### ✅ Versi 1.0 — Foundation (Q3 2026)

**Tema: "Bisa Baca, Bisa Hapus"**

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| K-Line Driver (Fast Init + 5-Baud) | ✅ Done | `kline.cpp` — Sudah implementasi |
| Read DTC | ✅ Done | Active + Pending DTC |
| Clear DTC | ✅ Done | Reset MIL |
| Live Sensor (14 sensor) | ✅ Done | WebSocket stream |
| Web UI (browser-based) | ✅ Done | Glassmorphism dark mode |
| OTA Update | ✅ Done | Via browser upload |
| ECU Info | ✅ Done | Part number, FW version |
| Print Struk Thermal | ✅ Done | Cetak hasil diagnosis AI via Bluetooth |

---

### 🔵 Versi 2.0 — Intelligence (Q4 2026)

**Tema: "Alat Cerdas di Tangan Anda"**

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| AI Diagnosis (OpenRouter) | 🔄 In Dev | Layer 1+2+3 architecture via OpenRouter API Key |
| DTC Database (200+ kode) | 🔄 In Dev | Honda PGM-FI specific |
| Freeze Frame | 📋 Planned | Kondisi sensor saat DTC |
| Data Logger | 📋 Planned | CSV export, ring buffer |
| Grafik Live Data | 📋 Planned | Multi-sensor chart |
| Mobile App (React Native) | 📋 Planned | iOS + Android |

---

### 🟡 Versi 3.0 — Prediction (Q1 2027)

**Tema: "Mencegah Sebelum Terjadi"**

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| Predictive Maintenance | 📋 Planned | ML model dari data historis |
| AI Chat | 📋 Planned | Tanya jawab bebas dengan AI |
| Service History | 📋 Planned | Riwayat digital per motor |
| Customer Report PDF | 📋 Planned | Laporan profesional |
| Cloud Sync | 📋 Planned | Backup ke cloud storage |
| Multi-user (Bengkel) | 📋 Planned | Admin + teknisi role |

---

### 🟠 Versi 4.0 — Advanced Diagnostic & Actuation (Q3 2027)

**Tema: "Pengujian Komponen Aktif & Diagnosis Mendalam"**

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| Sensor Test (Aktuasi) | 📋 Planned | Test aktif injektor, koil, idle valve |
| Active Component Test | 📋 Planned | Pengujian siklus aktuator otomatis |
| Oscilloscope View | 📋 Planned | High-speed sampling grafik sensor |
| Fault Tree Analysis | 📋 Planned | Pohon keputusan AI untuk masalah kompleks |

---

### 🔴 Versi 5.0 — Advanced Analytics & Fleet (Q4 2027)

**Tema: "Analisis Lanjutan & Manajemen Armada Bengkel"**

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| Fleet Analytics | 📋 Planned | Dashboard statistik kerusakan per tipe motor |
| Customer Loyalty System | 📋 Planned | Pengingat otomatis jadwal servis ke WA customer |
| AI Voice Diagnosis | 📋 Planned | Diagnosis berbasis perintah suara mekanik |
| Multi-Device Sync | 📋 Planned | Sinkronisasi data antar tablet/HP mekanik |

---

### 🟣 Versi 6.0 — AI Evolution (Q2 2028)

**Tema: "AI yang Belajar dari Data Servis Indonesia"**

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| AI Training dari Data Servis | 📋 Research | Fine-tune model dari real-world data |
| Komunitas Data | 📋 Research | Crowdsource DTC + solusi |
| AI Auto-Update Knowledge | 📋 Research | Adaptif terhadap model motor baru |
| Bahasa Daerah | 📋 Planned | Jawa, Sunda, Batak support |
| Offline AI | 📋 Research | Model ringan on-device (ESP32-S3) |

---

## Appendix

### A. Honda PGM-FI DTC Quick Reference (Partial)

| Kode | Nama | Sensor | Sistem |
|------|------|--------|--------|
| P0107 | MAP Low Input | MAP | Fuel |
| P0108 | MAP High Input | MAP | Fuel |
| P0112 | IAT Low Input | IAT | Fuel |
| P0113 | IAT High Input | IAT | Fuel |
| P0117 | ECT Low Input | ECT | Cooling |
| P0118 | ECT High Input | ECT | Cooling |
| P0122 | TPS Low Input | TPS | Throttle |
| P0123 | TPS High Input | TPS | Throttle |
| P0131 | O2 Low Voltage | HO2S | Fuel Trim |
| P0132 | O2 High Voltage | HO2S | Fuel Trim |
| P0171 | System Lean | Fuel Trim | Air/Fuel |
| P0172 | System Rich | Fuel Trim | Air/Fuel |
| P0335 | CKP Sensor | RPM | Ignition |
| P0562 | Battery Volt Low | VB | Charging |
| P0563 | Battery Volt High | VB | Charging |
| P1297 | EOP Sensor | Oil Pressure | Lubrication |
| P1298 | ELD Circuit | Current Sensor | Charging |

### B. Hardware Reference

| Komponen | Spesifikasi | Harga (Est.) |
|----------|------------|---------------|
| ESP32 DOIT V1 | 240MHz dual-core, 520KB SRAM, 4MB Flash | Rp 50.000 |
| Optocoupler 4N35 | Viso 5kV, CTR min 100%, 10MHz | Rp 2.000 |
| Resistor 4.7kΩ | Pull-up K-Line | Rp 500 |
| Resistor 510Ω | LED limiting | Rp 500 |
| Konektor OBD-II | 4-pin DLC Honda | Rp 15.000 |
| PCB Custom | Compact single-board | Rp 50.000 |
| Enclosure | 3D print / project box | Rp 30.000 |
| **Total** | | **~Rp 150.000** |

### C. Database Referensi Honda PGM-FI ECU (Terverifikasi)

> **Skema Database ECU**: `Model` → `Kode Model` → `Tahun` → `ECU Part Number` → `Manufacturer` → `Protocol` → `Init Method` → `Catatan`

| Model | Kode Model | Tahun | ECU Part Number | Manufacturer | Protocol | Init Method | Catatan Khusus |
|-------|------------|-------|-----------------|--------------|----------|-------------|----------------|
| **BeAT FI (Gen 1)** | K25 | 2012 – 2014 | `38770-K25-901` / `902` | Keihin | Honda K-Line (10400bps) | Fast Init | Starter kasar (Bletak), PGM-FI awal |
| **BeAT eSP** | K81 / K25G | 2014 – 2019 | `30400-K81-N01` / `38770-K25-601` | Shindengen / Keihin | Honda K-Line (10400bps) | Fast Init | Starter halus (ACG), ECM terintegrasi |
| **BeAT Deluxe / Genio** | K1A / K0J | 2020+ | `30400-K1A-N01` | Shindengen | Honda K-Line (10400bps) | Fast Init | Rangka eSAF, Engine eSP 110cc Gen baru |
| **Scoopy FI (Gen 1)** | K16G | 2013 – 2015 | `38770-K25-901` / `38770-K16-A01` | Keihin | Honda K-Line (10400bps) | Fast Init | Starter kasar, velg 14 inch |
| **Scoopy eSP** | K93 / K2F | 2017 – 2022 | `30400-K93-N01` / `30400-K2F-N01` | Shindengen | Honda K-Line (10400bps) | Fast Init | Velg 12 inch, Smart Key / ISS |
| **Vario Techno 125 FI** | KZR | 2012 – 2015 | `38770-KZR-601` / `38770-KZR-N01` | Keihin | Honda K-Line (10400bps) | Fast Init | Vario 125 PGM-FI generasi pertama |
| **Vario 110 eSP** | K46 | 2015 – 2019 | `30400-K46-N21` | Shindengen | Honda K-Line (10400bps) | Fast Init | Pendingin udara, ACG Starter |
| **Vario 125 eSP (LED)** | K60 / K60R | 2015 – 2022 | `30400-K60-901` / `30400-K60-R01` | Shindengen | Honda K-Line (10400bps) | Fast Init | Dual LED Headlight, ISS |
| **Vario 150 eSP (LED)** | K59 / K59J | 2015 – 2022 | `30400-K59-A11` / `30400-K59-J01` | Shindengen | Honda K-Line (10400bps) | Fast Init | Keyless System / ISS |
| **Vario 160 eSP+** | K2S | 2022+ | `30400-K2S-N01` | Shindengen | Honda K-Line (10400bps) | Fast Init | Engine 157cc 4-Valve eSP+ |
| **PCX 150 (CBU / Lokal)**| K36 / K97 | 2014 – 2020 | `38770-K36-T01` / `30400-K97-N01` | Keihin / Shindengen | Honda K-Line (10400bps) | Fast Init | K36 (Keihin CBU), K97 (Shindengen Lokal) |
| **PCX 160 eSP+** | K1Z | 2021+ | `30400-K1Z-N01` / `38770-K1Z-B01` | Shindengen | Honda K-Line (10400bps) | Fast Init | Engine 157cc eSP+ 4V |
| **CB150R StreetFire** | K15 | 2012 – 2014 | `38770-K15-901` / `38770-K15-903` | Keihin | Honda K-Line (10400bps) | Fast Init | Gen 1 DOHC 150cc (Bukan KPH!) |
| **All New CB150R LED** | K15G / K15P | 2015 – 2021 | `38770-K15-G01` / `38770-K15-P01` | Keihin | Honda K-Line (10400bps) | Fast Init | DOHC 150cc LED Facelift |
| **CBR 150R FI (CBU/Lokal)**| KPP / K45 | 2011 – 2020 | `38770-KPP-902` / `38770-K45-N01` | Keihin | Honda K-Line (10400bps) | Fast Init | DOHC Fairing (KPP CBU Thai, K45 Lokal) |
| **CBR 250R / RR** | KYJ / K64 | 2011+ | `38770-KYJ-901` / `38770-K64-N01` | Keihin | Honda K-Line (10400bps) | Fast Init | Single / Twin Cylinder DOHC |
| **Sonic 150R** | K56 | 2015+ | `38770-K56-N01` / `38770-K56-N11` | Keihin | Honda K-Line (10400bps) | Fast Init | Ayam Jago DOHC 150cc |
| **Supra GTR 150** | K56F | 2016+ | `38770-K56-F01` | Keihin | Honda K-Line (10400bps) | Fast Init | Bebek Super DOHC 150cc |
| **Revo FI** | K03 | 2014+ | `38770-K03-N11` | Keihin | Honda K-Line (10400bps) | Fast Init | Bebek Entry Level 110cc |
| **Supra X 125 FI** | KPH / K41 | 2007 – 2020 | `38770-KPH-881` / `38770-K41-N01` | Keihin | Honda K-Line (10400bps) | Fast / 5-Baud | KPH (PGM-FI Gen 1), K41 (Helm-In / FI Gen 2) |

---

*Dokumen ini adalah living document — akan diperbarui seiring perkembangan proyek.*

**Dibuat oleh:** WRT Garage Development Team  
**Versi:** 1.0  
**Tanggal:** Agustus 2026  
**Status:** Draft — Review Required
