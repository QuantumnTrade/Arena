# ⚡ Quick Deployment Commands

## 🚀 Deploy to Vercel (3 Steps)

### 1️⃣ Generate CRON_SECRET
```bash
openssl rand -base64 32
```
**Copy the output!** You'll need it in Step 2.

---

### 2️⃣ Set Environment Variable in Vercel
1. Go to: https://vercel.com/dashboard
2. Select project → **Settings** → **Environment Variables**
3. Add:
   ```
   Name:  CRON_SECRET
   Value: <paste from step 1>
   Environment: Production, Preview, Development
   ```
4. Click **Save**

---

### 3️⃣ Deploy
```bash
# Commit changes
git add .
git commit -m "Fix: Disable instrumentation for Vercel, use Cron Jobs"
git push origin main

# Vercel will auto-deploy!
# Wait 2-3 minutes, then check dashboard
```

---

## ✅ Verify Deployment

### Check Logs (2 minutes after deploy):
```bash
# Go to: Vercel Dashboard → Deployments → Latest → Functions
# Look for: "Background jobs DISABLED" ✓
```

### Check Cron Jobs:
```bash
# Go to: Vercel Dashboard → Cron Jobs
# Verify:
#   ✓ /api/ai-analysis-all (every 2 min)
#   ✓ /api/recalculate-stats (every 1 min)
```

### Check Execution (5 minutes after deploy):
```bash
# Go to: Your App → Analysis History
# Verify: Executions at 2-minute intervals (no duplicates)
```

---

## 🐛 Quick Troubleshooting

### Cron jobs not running?
```bash
# 1. Check CRON_SECRET is set in Vercel
# 2. Redeploy:
vercel --prod
```

### Still seeing duplicates?
```bash
# 1. Check logs for "Background jobs DISABLED"
# 2. Wait 5-10 minutes for pattern to stabilize
# 3. Clear build cache: Vercel Dashboard → Settings → Clear Build Cache
```

---

## 📝 Summary

**What Changed:**
- ✅ `instrumentation.ts` disabled for production
- ✅ `vercel.json` added with cron jobs
- ✅ API routes support Vercel Cron authentication

**Result:**
- ✅ Single execution per schedule (no duplicates)
- ✅ Predictable timing (every 2 minutes)
- ✅ Lower costs (no wasted API calls)

**Status:** 🎉 Ready for production!

---

**Need help?** See `DEPLOYMENT_CHECKLIST.md` for detailed steps.
