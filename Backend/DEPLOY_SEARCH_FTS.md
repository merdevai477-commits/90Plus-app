# خطوات تطبيق Full-Text Search Optimization

## 📋 نظرة عامة

هذا الدليل يشرح خطوات تطبيق تحسين البحث باستخدام PostgreSQL Full-Text Search على بيئة الإنتاج.

---

## ⚠️ قبل البدء

### المتطلبات
- ✅ PostgreSQL 12 or higher
- ✅ Node.js 18 or higher
- ✅ Prisma CLI installed
- ✅ Database backup (مهم جداً!)
- ✅ Access to production database

### التحقق من الإصدار
```bash
# Check PostgreSQL version
psql --version

# Check Node.js version
node --version

# Check Prisma version
npx prisma --version
```

---

## 🔄 خطوات التطبيق

### الخطوة 1: Backup Database

**مهم جداً:** قم بعمل backup للـ database قبل تطبيق أي migration!

```bash
# Create backup
pg_dump -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Railway CLI (if using Railway)
railway db backup
```

### الخطوة 2: Test in Development

```bash
# Navigate to Backend directory
cd Backend

# Apply migration in development
npx prisma migrate dev

# Test the search functionality
npx ts-node test-search-fts.ts
```

**Expected output:**
```
🔍 Testing Full-Text Search...

Test 1: English search for "mohamed"
✅ Found 10 results in 25ms

Test 2: Arabic search for "محمد"
✅ Found 8 results in 22ms

Test 3: Partial match for "moh"
✅ Found 15 results in 28ms

Test 4: Autocomplete for "ah"
✅ Found 5 autocomplete suggestions in 18ms

Test 5: Search stats for "mohamed"
✅ Stats retrieved in 12ms

Test 6: Pagination (offset=10)
✅ Found 10 results in 24ms

📊 Performance Summary:
Average query time: 21ms

✅ All tests completed successfully!
```

### الخطوة 3: Review Migration

```bash
# Review the migration SQL
cat Backend/prisma/migrations/20240409000000_add_fulltext_search_indexes/migration.sql
```

**What it does:**
- Creates 6 GIN indexes for Full-Text Search
- Supports both English and Arabic text
- No data changes (indexes only)
- Safe to apply (no downtime)

### الخطوة 4: Apply to Staging (Optional)

```bash
# Set staging database URL
export DATABASE_URL="postgresql://user:pass@staging-host:5432/db"

# Apply migration
npx prisma migrate deploy

# Test on staging
curl -X GET "https://staging-api.example.com/api/clerk/search?q=test&limit=10" \
  -H "Authorization: Bearer STAGING_TOKEN"
```

### الخطوة 5: Apply to Production

```bash
# Set production database URL
export DATABASE_URL="postgresql://user:pass@prod-host:5432/db"

# Apply migration (this will create the indexes)
npx prisma migrate deploy
```

**Expected output:**
```
Prisma Migrate applied the following migration(s):

migrations/
  └─ 20240409000000_add_fulltext_search_indexes/
    └─ migration.sql

✔ Generated Prisma Client
```

**Note:** Index creation may take 1-5 minutes depending on database size.

### الخطوة 6: Monitor Index Creation

```sql
-- Check index creation progress
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename = 'users'
  AND indexname LIKE '%gin%';
```

**Expected output:**
```
 schemaname | tablename |           indexname                    | index_size 
------------+-----------+----------------------------------------+------------
 public     | users     | idx_users_username_gin_en              | 8192 kB
 public     | users     | idx_users_displayname_gin_en           | 7856 kB
 public     | users     | idx_users_username_gin_simple          | 8192 kB
 public     | users     | idx_users_displayname_gin_simple       | 7856 kB
 public     | users     | idx_users_combined_search_gin_en       | 12 MB
 public     | users     | idx_users_combined_search_gin_simple   | 12 MB
```

### الخطوة 7: Deploy Backend Code

```bash
# Build the backend
npm run build

# Deploy to production (Railway example)
railway up

# Or using Docker
docker build -t backend:latest .
docker push your-registry/backend:latest
```

### الخطوة 8: Verify Deployment

```bash
# Test search endpoint
curl -X GET "https://api.example.com/api/clerk/search?q=mohamed&limit=10" \
  -H "Authorization: Bearer PROD_TOKEN"

# Check response time (should be <50ms)
curl -w "@curl-format.txt" -o /dev/null -s \
  "https://api.example.com/api/clerk/search?q=test&limit=10" \
  -H "Authorization: Bearer PROD_TOKEN"
```

**Expected response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "users": [
      {
        "id": "...",
        "username": "mohamed",
        "displayName": "Mohamed Ali",
        "avatar": "...",
        "isVerified": true,
        "level": 15
      }
    ]
  }
}
```

### الخطوة 9: Update Statistics

```sql
-- Update PostgreSQL statistics for better query planning
ANALYZE users;

-- Or full vacuum analyze (during low traffic)
VACUUM ANALYZE users;
```

### الخطوة 10: Monitor Performance

```bash
# Monitor API response times
# Check your monitoring dashboard (e.g., Datadog, New Relic)

# Or use PostgreSQL slow query log
tail -f /var/log/postgresql/postgresql-*.log | grep "duration:"
```

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] Migration applied successfully
- [ ] All 6 GIN indexes created
- [ ] Search endpoint returns results
- [ ] Response time <50ms
- [ ] Arabic search works
- [ ] Pagination works
- [ ] Cache is working
- [ ] No errors in logs
- [ ] Database CPU usage normal
- [ ] Memory usage normal

---

## 🔧 Troubleshooting

### Issue 1: Migration Fails

**Error:** `relation "users" does not exist`

**Solution:**
```bash
# Check if you're connected to the right database
psql $DATABASE_URL -c "\dt users"

# If table doesn't exist, run all migrations
npx prisma migrate deploy
```

### Issue 2: Index Creation Takes Too Long

**Error:** Migration hangs for >10 minutes

**Solution:**
```sql
-- Check if index creation is in progress
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query
FROM pg_stat_activity
WHERE query LIKE '%CREATE INDEX%';

-- If stuck, cancel and retry during low traffic
SELECT pg_cancel_backend(PID);
```

### Issue 3: Search Returns No Results

**Error:** Search endpoint returns empty array

**Solution:**
```bash
# Check if service is using the new code
curl https://api.example.com/health

# Check logs for errors
railway logs

# Test with simple query
curl "https://api.example.com/api/clerk/search?q=a&limit=10" \
  -H "Authorization: Bearer TOKEN"
```

### Issue 4: Slow Performance

**Error:** Response time >100ms

**Solution:**
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM users
WHERE (to_tsvector('english', username) || to_tsvector('english', COALESCE("displayName", '')))
      @@ plainto_tsquery('english', 'mohamed')
LIMIT 10;

-- If not using index, update statistics
ANALYZE users;

-- Check index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'users'
  AND indexname LIKE '%gin%';
```

### Issue 5: High Memory Usage

**Error:** Database memory usage increased

**Solution:**
```sql
-- Check shared_buffers setting
SHOW shared_buffers;

-- Increase if needed (requires restart)
ALTER SYSTEM SET shared_buffers = '256MB';

-- Or adjust work_mem for queries
SET work_mem = '64MB';
```

---

## 🔄 Rollback Plan

If something goes wrong, rollback:

### Option 1: Drop Indexes Only

```sql
-- Drop all FTS indexes
DROP INDEX IF EXISTS idx_users_username_gin_en;
DROP INDEX IF EXISTS idx_users_displayname_gin_en;
DROP INDEX IF EXISTS idx_users_username_gin_simple;
DROP INDEX IF EXISTS idx_users_displayname_gin_simple;
DROP INDEX IF EXISTS idx_users_combined_search_gin_en;
DROP INDEX IF EXISTS idx_users_combined_search_gin_simple;
```

**Note:** This will revert to the old search behavior (slower but working).

### Option 2: Full Rollback

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Redeploy old backend code
git checkout previous-commit
railway up
```

---

## 📈 Post-Deployment Monitoring

### Metrics to Monitor

1. **API Response Time**
   - Target: <50ms average
   - Alert if: >100ms for 5 minutes

2. **Database CPU Usage**
   - Target: <70% average
   - Alert if: >90% for 5 minutes

3. **Database Memory Usage**
   - Target: <80% of available
   - Alert if: >95% for 5 minutes

4. **Error Rate**
   - Target: 0% errors
   - Alert if: >1% errors

5. **Cache Hit Rate**
   - Target: >80% hit rate
   - Alert if: <50% hit rate

### Monitoring Queries

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'users'
  AND indexname LIKE '%gin%'
ORDER BY idx_scan DESC;

-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%to_tsvector%'
ORDER BY mean_time DESC
LIMIT 10;

-- Check cache statistics
SELECT 
  schemaname,
  tablename,
  heap_blks_read,
  heap_blks_hit,
  idx_blks_read,
  idx_blks_hit
FROM pg_statio_user_tables
WHERE tablename = 'users';
```

---

## ✅ Success Criteria

Deployment is successful when:

1. ✅ All migrations applied without errors
2. ✅ All 6 GIN indexes created
3. ✅ Search endpoint response time <50ms
4. ✅ Arabic search returns correct results
5. ✅ Pagination works correctly
6. ✅ Cache hit rate >80%
7. ✅ No errors in application logs
8. ✅ Database CPU usage <70%
9. ✅ Database memory usage <80%
10. ✅ User feedback is positive

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review application logs
3. Check database logs
4. Review monitoring dashboards
5. Contact the development team

---

## 📚 Related Documentation

- [SEARCH_FTS_OPTIMIZATION_AR.md](./SEARCH_FTS_OPTIMIZATION_AR.md) - Full documentation (Arabic)
- [SEARCH_PERFORMANCE_COMPARISON.md](./SEARCH_PERFORMANCE_COMPARISON.md) - Performance comparison
- [Backend/prisma/migrations/.../README.md](./prisma/migrations/20240409000000_add_fulltext_search_indexes/README.md) - Migration details

---

**Last Updated:** April 9, 2026  
**Status:** Ready for Production Deployment  
**Estimated Deployment Time:** 15-30 minutes
