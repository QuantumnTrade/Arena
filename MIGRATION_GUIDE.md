# 📋 Supabase Migration Guide - QuantumnTrade

Panduan lengkap untuk migrasi database dari Supabase lama ke Supabase instance baru Anda.

---

## 📊 Analisis Struktur Database

Berdasarkan analisis file JSON response, database terdiri dari **3 tabel utama**:

### 1. **`agents`** - Trading Agent Information
Menyimpan informasi dan performa setiap AI trading agent (LLM).

**Kolom Utama:**
- `id` - Primary key (BIGSERIAL)
- `model` - Nama LLM (claude, openai, gemini, grok, deepseek, qwen)
- `balance` - Saldo akun saat ini
- `total_pnl` - Total profit/loss
- `roi` - Return on investment (decimal)
- `trade_count` - Jumlah total trade
- `win_count` / `loss_count` - Jumlah trade menang/kalah
- `win_rate` - Win rate percentage
- `active_positions` - Jumlah posisi aktif
- `is_active` - Status agent aktif/tidak
- `available_capital` - Modal tersedia untuk trading
- `system_prompt` - AI system instructions (TEXT)
- `last_user_prompt` - Prompt terakhir (TEXT)
- `created_at` / `updated_at` - Timestamps

### 2. **`positions`** - Trading Positions
Menyimpan data posisi trading (aktif dan closed).

**Kolom Utama:**
- `id` - Primary key (BIGSERIAL)
- `agent_id` - Foreign key ke `agents`
- `symbol` - Simbol trading (BTC, ETH, SOL, BNB)
- `side` - LONG atau SHORT
- `entry_price` / `exit_price` - Harga masuk/keluar
- `stop_loss` / `take_profit` - Target SL/TP
- `size_usd` - Ukuran posisi dalam USD
- `size_pct` - Ukuran sebagai % dari balance
- `confidence` - Confidence level (0-1)
- `entry_time` / `exit_time` - Waktu buka/tutup
- `reasoning` - Alasan trade (TEXT)
- `exit_strategy` - Strategi exit (TEXT)
- `pnl_usd` / `pnl_pct` - Profit/loss
- `is_active` - Status posisi aktif/tidak
- `exit_reason` - Alasan penutupan
- `leverage` - Leverage multiplier
- `quantity` - Jumlah asset
- `risk_usd` - Jumlah risiko
- `liquidation_price` - Harga likuidasi
- `entry_order_id` / `take_profit_order_id` / `stop_loss_order_id` - Exchange order IDs
- `invalidation_condition` - Kondisi invalidasi (TEXT)
- `created_at` / `updated_at` - Timestamps

### 3. **`agent_summaries`** - Decision Snapshots
Menyimpan snapshot keputusan agent secara periodik.

**Kolom Utama:**
- `id` - Primary key (BIGSERIAL)
- `agent_id` - Foreign key ke `agents`
- `session_timestamp` - Timestamp sesi
- `invocation_count` - Jumlah invokasi
- `runtime_minutes` - Total runtime dalam menit
- `total_decisions` - Total keputusan dibuat
- `decisions_made` - Array decision objects (JSONB)
- `balance_at_time` - Balance saat snapshot
- `total_exposure_at_time` - Total exposure
- `active_positions_at_time` - Jumlah posisi aktif
- `conclusion` - Kesimpulan agent (TEXT)
- `created_at` / `updated_at` - Timestamps

### 4. **`market_data`** (Optional) - Market Cache
Untuk caching data market dan optimasi performa.

---

## 🚀 Langkah-Langkah Migrasi

### **Step 1: Persiapan Supabase Baru**

1. **Buat Project Baru di Supabase**
   - Login ke [https://supabase.com](https://supabase.com)
   - Klik "New Project"
   - Isi nama project, database password, dan region
   - Tunggu hingga project selesai dibuat (~2 menit)

2. **Catat Credentials**
   ```
   Project URL: https://xxxxx.supabase.co
   Project API Key (anon): eyJhbGc...
   Service Role Key: eyJhbGc...
   Database Password: [password yang Anda buat]
   ```

### **Step 2: Jalankan SQL Schema**

1. **Buka SQL Editor**
   - Di dashboard Supabase, klik menu **"SQL Editor"** di sidebar kiri
   - Klik **"New Query"**

2. **Copy & Paste Schema**
   - Buka file `supabase_schema.sql`
   - Copy seluruh isi file
   - Paste ke SQL Editor
   - Klik **"Run"** (atau tekan `Ctrl+Enter`)

3. **Verifikasi Tabel Berhasil Dibuat**
   - Klik menu **"Table Editor"** di sidebar
   - Anda harus melihat 4 tabel:
     - ✅ `agents`
     - ✅ `positions`
     - ✅ `agent_summaries`
     - ✅ `market_data`

### **Step 3: Setup Environment Variables**

1. **Update `.env.local`**
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   
   # Optional: External API fallback
   NEXT_PUBLIC_API_BASE_URL=https://your-api.com
   ```

2. **Restart Development Server**
   ```bash
   npm run dev
   ```

### **Step 4: Migrasi Data (Jika Ada Data Lama)**

#### **Option A: Manual Export/Import via CSV**

1. **Export dari Supabase Lama**
   - Di Supabase lama, buka Table Editor
   - Pilih tabel → Klik "Export" → Download CSV
   - Ulangi untuk semua tabel

2. **Import ke Supabase Baru**
   - Di Supabase baru, buka Table Editor
   - Pilih tabel → Klik "Insert" → "Import from CSV"
   - Upload file CSV yang sudah di-export

#### **Option B: Programmatic Migration (Recommended)**

Buat script Node.js untuk migrasi:

```javascript
// migrate-data.js
import { createClient } from '@supabase/supabase-js';

// Old Supabase
const oldSupabase = createClient(
  'OLD_SUPABASE_URL',
  'OLD_SUPABASE_KEY'
);

// New Supabase
const newSupabase = createClient(
  'NEW_SUPABASE_URL',
  'NEW_SUPABASE_KEY'
);

async function migrateAgents() {
  console.log('Migrating agents...');
  const { data, error } = await oldSupabase
    .from('agents')
    .select('*');
  
  if (error) throw error;
  
  const { error: insertError } = await newSupabase
    .from('agents')
    .insert(data);
  
  if (insertError) throw insertError;
  console.log(`✅ Migrated ${data.length} agents`);
}

async function migratePositions() {
  console.log('Migrating positions...');
  const { data, error } = await oldSupabase
    .from('positions')
    .select('*');
  
  if (error) throw error;
  
  const { error: insertError } = await newSupabase
    .from('positions')
    .insert(data);
  
  if (insertError) throw insertError;
  console.log(`✅ Migrated ${data.length} positions`);
}

async function migrateAgentSummaries() {
  console.log('Migrating agent summaries...');
  const { data, error } = await oldSupabase
    .from('agent_summaries')
    .select('*');
  
  if (error) throw error;
  
  const { error: insertError } = await newSupabase
    .from('agent_summaries')
    .insert(data);
  
  if (insertError) throw insertError;
  console.log(`✅ Migrated ${data.length} summaries`);
}

async function migrate() {
  try {
    await migrateAgents();
    await migratePositions();
    await migrateAgentSummaries();
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrate();
```

Jalankan:
```bash
node migrate-data.js
```

### **Step 5: Setup Row Level Security (RLS) - Optional**

Jika Anda ingin membatasi akses data:

```sql
-- Enable RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access
CREATE POLICY "Allow public read" ON public.agents 
  FOR SELECT USING (true);

CREATE POLICY "Allow public read" ON public.positions 
  FOR SELECT USING (true);

CREATE POLICY "Allow public read" ON public.agent_summaries 
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert/update
CREATE POLICY "Allow authenticated insert" ON public.agents 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON public.agents 
  FOR UPDATE USING (auth.role() = 'authenticated');
```

### **Step 6: Update API Functions (Jika Perlu)**

Jika Anda menggunakan Supabase RPC functions, buat ulang di Supabase baru:

```sql
-- Example: Function to get latest market data
CREATE OR REPLACE FUNCTION get_latest_market_data(p_symbol TEXT)
RETURNS TABLE (
  symbol TEXT,
  price DECIMAL,
  volume_24h DECIMAL,
  indicators JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.symbol,
    m.price,
    m.volume_24h,
    m.indicators
  FROM market_data m
  WHERE m.symbol = p_symbol
  ORDER BY m.timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ Verifikasi Migrasi

### **1. Test Database Connection**

```typescript
// test-connection.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

async function testConnection() {
  // Test agents table
  const { data: agents, error: agentsError } = await supabase
    .from('agents')
    .select('*')
    .limit(1);
  
  console.log('Agents:', agents, agentsError);
  
  // Test positions table
  const { data: positions, error: positionsError } = await supabase
    .from('positions')
    .select('*')
    .limit(1);
  
  console.log('Positions:', positions, positionsError);
}

testConnection();
```

### **2. Test Frontend Integration**

1. Jalankan development server: `npm run dev`
2. Buka browser: `http://localhost:3000`
3. Verifikasi:
   - ✅ Agents table menampilkan data
   - ✅ Market tiles menampilkan data
   - ✅ Performance chart ter-render
   - ✅ Tidak ada error di console

### **3. Test Data Fetching**

Buka browser console dan jalankan:

```javascript
// Test fetch agents
fetch('https://xxxxx.supabase.co/rest/v1/agents', {
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log);
```

---

## 🔧 Troubleshooting

### **Error: "relation does not exist"**
- **Solusi**: Pastikan schema SQL sudah dijalankan dengan benar
- Cek di Table Editor apakah tabel sudah ada

### **Error: "permission denied"**
- **Solusi**: Periksa RLS policies atau disable RLS untuk testing:
  ```sql
  ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
  ```

### **Error: "invalid input syntax for type numeric"**
- **Solusi**: Pastikan data yang diinsert sesuai dengan tipe data
- Contoh: `balance` harus DECIMAL, bukan string

### **Data tidak muncul di frontend**
- **Solusi**: 
  1. Cek environment variables di `.env.local`
  2. Restart development server
  3. Clear browser cache
  4. Cek Network tab di browser DevTools

### **CORS Error**
- **Solusi**: Pastikan domain Anda sudah ditambahkan di Supabase Settings → API → CORS

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase SQL Editor**: https://supabase.com/docs/guides/database/overview
- **Supabase Client Library**: https://supabase.com/docs/reference/javascript/introduction
- **PostgreSQL Data Types**: https://www.postgresql.org/docs/current/datatype.html

---

## 🎯 Next Steps

Setelah migrasi berhasil:

1. ✅ **Setup Backup Otomatis**
   - Di Supabase Dashboard → Settings → Backups
   - Enable automatic backups

2. ✅ **Monitor Performance**
   - Gunakan Supabase Dashboard → Database → Performance
   - Tambahkan indexes jika query lambat

3. ✅ **Setup Webhooks (Optional)**
   - Untuk real-time notifications
   - Database → Webhooks

4. ✅ **Deploy ke Production**
   - Update environment variables di Vercel/Netlify
   - Test production build: `npm run build && npm start`

---

## 📞 Support

Jika mengalami masalah:
- Cek Supabase Logs: Dashboard → Logs
- Supabase Community: https://github.com/supabase/supabase/discussions
- Discord: https://discord.supabase.com

---

**Good luck with your migration! 🚀**
