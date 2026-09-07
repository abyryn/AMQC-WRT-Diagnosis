# 🐳 Panduan Deploy Backend WRT Garage ke Dokploy (VPS)

Panduan langkah demi langkah untuk mempublikasikan service backend `wrt-backend` ke VPS menggunakan **Dokploy**.

---

## 📋 Persyaratan Sebelum Deploy

1. Server VPS (Ubuntu 22.04 / 24.04 LTS).
2. Dokploy sudah terinstall di VPS (`curl -sSL https://dokploy.com/install.sh | sh`).
3. Akses ke Dashboard Dokploy (contoh: `https://dokploy.domainanda.com` atau `http://IP-VPS:3000`).
4. Subdomain terarah ke IP VPS (contoh: `api.wrtgarage.com`).

---

## 🚀 Metode 1: Deploy via Docker Compose (Disarankan)

Metode ini akan secara otomatis menjalankan **Node.js API Server** dan **Database PostgreSQL 16** dalam satu container stack yang saling terhubung.

### Langkah 1: Buat Project & Service di Dokploy
1. Buka Dashboard Dokploy Anda.
2. Klik tombol **Projects** → Klik **Create Project**.
   - **Name**: `WRT Garage`
3. Masuk ke project `WRT Garage`, klik **Create Service** → Pilih **Compose**.
   - **Service Name**: `wrt-backend-stack`

### Langkah 2: Hubungkan ke Repository GitHub
1. Di tab **Source**:
   - Pilih Provider: **GitHub**.
   - Repository: `username/wrt-garage` *(atau nama repo GitHub Anda)*.
   - Branch: `main`.
   - Compose Path: `wrt-backend/docker-compose.yml`.
   - Build Context: `wrt-backend`.

*(Alternatif: Jika memilih **Raw Compose**, cukup salin seluruh isi file [`wrt-backend/docker-compose.yml`](file:///c:/Users/A%20D%20M%20I%20N/Downloads/coding/wrt-backend/docker-compose.yml) ke kolom editor Dokploy).*

### Langkah 3: Atur Environment Variables di Dokploy
Masuk ke tab **Environment**:
Tambahkan variabel berikut:

```env
NODE_ENV=production
PORT=3000

# OpenRouter AI Key Anda
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemini-2.5-flash

# Security
API_KEY_SECRET=wrt-garage-api-key-change-this-in-production

# PostgreSQL Configuration
POSTGRES_USER=wrt_user
POSTGRES_PASSWORD=wrt_secret
POSTGRES_DB=wrt_garage
DATABASE_URL=postgresql://wrt_user:wrt_secret@postgres:5432/wrt_garage
```

### Langkah 4: Atur Domain & SSL (HTTPS)
1. Masuk ke tab **Domains**.
2. Klik **Add Domain**:
   - **Domain**: `api.wrtgarage.com` *(sesuaikan dengan subdomain Anda)*.
   - **Container Port**: `3000`.
   - **HTTPS / SSL**: Centang **Enable HTTPS (Let's Encrypt)**.
3. Klik **Save**.

### Langkah 5: Deploy!
1. Klik tombol **Deploy** di sudut kanan atas.
2. Tunggu proses build & container startup (~1-2 menit).
3. Setelah status berubah menjadi **Healthy / Running**, tes API Anda:
   - Buka browser: `https://api.wrtgarage.com/api/health`
   - Respons sukses:
     ```json
     {
       "status": "ok",
       "service": "WRT Garage Backend API",
       "version": "2.0.0",
       "uptime": 12.4
     }
     ```

---

## 🗄️ Metode 2: Deploy App & Database Terpisah di Dokploy

Jika Anda ingin menggunakan **Managed Database PostgreSQL** bawaan Dokploy UI:

### 1. Buat Database PostgreSQL
1. Di Dokploy Project `WRT Garage`, klik **Create Service** → **Database** → Pilih **PostgreSQL**.
2. Dokploy akan memberikan `Connection String` (misal `postgresql://postgres:pass@dokploy-postgres:5432/wrt_garage`).

### 2. Buat Service Application
1. Klik **Create Service** → **Application**.
2. Pilih Repository `wrt-backend`, Build Type: **Dockerfile**.
3. Masukkan `DATABASE_URL` dari database yang dibuat di langkah 1.
4. Masukkan `OPENROUTER_API_KEY` dan `API_KEY_SECRET`.
5. Klik **Deploy**.

---

## 🛠️ Maintenance & Troubleshooting Dokploy

### 1. Cek Log Server Realtime
Di Dokploy UI: Masuk ke Service `wrt-backend` → Tab **Logs**.
Anda akan melihat log koneksi PostgreSQL, migration auto-run, dan request AI diagnosis.

### 2. Eksekusi Ulang Database Migration
Jika ada perubahan schema DDL:
```bash
# Di terminal Dokploy Container Shell:
npm run db:migrate
```

### 3. Tes Diagnostic AI API via Terminal (cURL)
```bash
curl -X POST https://api.wrtgarage.com/api/ai/diagnose \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrt-garage-api-key-change-this-in-production" \
  -d '{
    "motor": { "model": "PCX160", "year": 2023 },
    "dtc": { "active": ["P0113"] },
    "live_data": { "rpm": 1450, "iat_celsius": -40, "ect_celsius": 92 }
  }'
```
