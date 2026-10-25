# Quick Reference: Unified Twitter Scraping Cycle

## What Changed?

The Twitter backend now uses **ONE unified scraping cycle** for all accounts instead of separate processes per account.

## Key Files Updated

```
server/twitter/
├── jobs/monitoringJob.js          ← Enhanced with unified cycle logic
├── worker/monitor.js              ← Enhanced with better logging
├── controllers/dashboardController.js ← Added status endpoint
├── routes/dashboard.js            ← Added route for status
├── UNIFIED_CYCLE_IMPLEMENTATION.md ← Full documentation
├── UNIFIED_SCRAPING_CYCLE_SUMMARY.md ← Implementation summary
└── scripts/verify-unified-cycle.js ← Verification tool
```

## How It Works

### Simple Flow

```
Server starts
  ↓
startMonitoring() creates ONE scheduler
  ↓
Every N minutes:
  runMonitoringCycle() runs
    ↓
    Fetch ALL accounts from database
    ↓
    For each account: fetch posts, create alerts
    ↓
    Cycle complete
  ↓
Next cycle includes newly added accounts automatically
```

## What Developers Need to Know

### Adding an Account

```javascript
// This just adds the account to the database
// The unified cycle automatically picks it up in the next execution
POST /api/accounts
  body: { username: "@newaccount" }
```

### Unified Cycle Behavior

```javascript
// Unified cycle runs every MONITORING_INTERVAL (e.g., 10 minutes)
// It AUTOMATICALLY includes all accounts with status: 'active'

const runMonitoringCycle = async () => {
  // DYNAMIC: Fetches ALL current accounts from DB
  const accounts = await MonitoredAccount.find({ 
    monitoringStatus: { $in: ['active', 'error'] } 
  });
  
  // Processes ALL of them in this single cycle
  for (const account of accounts) {
    await checkAccount(account);  // Process one account
  }
  
  // Newly added accounts will be in the next cycle automatically
};
```

### Only ONE Job Exists

```javascript
// This guard prevents duplicate schedulers
if (isMonitoringStarted) {
  logger.warn('Only ONE unified cycle is active');
  return;  // Exits, doesn't create another job
}
```

## Verification

### Check Logs for Startup Message

```
[UnifiedCycle] STARTING UNIFIED TWITTER MONITORING SYSTEM
[UnifiedCycle] - ONE centralized cycle for ALL accounts
```

### Check Logs for Cycle Execution

```
[UnifiedCycle] Starting cycle #1...
[UnifiedCycle] Discovered 3 account(s) for processing
[UnifiedCycle] Account list: @user1, @user2, @user3
```

### Check Status Endpoint

```bash
GET /api/dashboard/monitoring-status

# Shows isUnified: true
# Shows all accounts being processed
```

### Run Verification Script

```bash
node server/twitter/scripts/verify-unified-cycle.js
```

## Important Notes

| Aspect | Behavior |
|--------|----------|
| **Job Count** | 1 (unified) |
| **Account Discovery** | Dynamic (each cycle) |
| **New Account Inclusion** | Automatic (next cycle) |
| **Process Management** | Single Node.js server |
| **Database Queries** | Once per cycle (all accounts) |
| **Error Handling** | Individual account errors don't stop cycle |
| **Concurrency Protection** | `isRunning` flag prevents overlapping cycles |

## Testing New Accounts

```bash
# Add Account A
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username": "account_a"}'

# Check logs - Account A processed in next cycle

# Add Account B
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username": "account_b"}'

# Check logs - Next cycle shows BOTH Account A and B processed together
# [UnifiedCycle] Account list: @account_a, @account_b
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Server won't start | Check port 5000 is available |
| No monitoring logs | Check `MONITORING_INTERVAL` env var is set |
| Account not processed | Verify `monitoringStatus` is 'active' in DB |
| Duplicate cycles running | Restart server (check no zombie processes) |
| Alerts not appearing | Check unified cycle logs for errors |

## Environment Variables

```bash
MONITORING_INTERVAL=10  # Minutes (or seconds if < 60)
MONGODB_URI=...         # Database connection
TWITTER_API_KEY=...     # Twitter API credentials
NODE_ENV=development    # Environment
```

## Key Methods

### In `jobs/monitoringJob.js`

```javascript
startMonitoring()           // Starts ONE unified cycle
stopMonitoring()            // Stops the cycle
getUnifiedCycleStatus()     // Returns current status
```

### In `worker/monitor.js`

```javascript
runMonitoringCycle()        // Executes ONE cycle (all accounts)
checkAccount(account)       // Processes single account
```

### In `controllers/dashboardController.js`

```javascript
getMonitoringStatus()       // Returns cycle status and stats
```

## Architecture Highlights

✅ **Singleton Pattern**: Only one cycle exists  
✅ **Dynamic Discovery**: Accounts fetched each cycle  
✅ **Automatic Inclusion**: New accounts need no code changes  
✅ **Error Resilient**: Failed accounts don't break cycle  
✅ **Efficient**: Single DB query per cycle  
✅ **Observable**: Rich logging for debugging  

## Example Logs

```
[UnifiedCycle] STARTING UNIFIED TWITTER MONITORING SYSTEM
[UnifiedCycle] - ONE centralized cycle for ALL accounts
[UnifiedCycle] - New accounts auto-included in next cycle
[UnifiedCycle] - NO separate jobs per account
[UnifiedCycle] ✓ Unified scheduler started with cron pattern: */10 * * * *

[UnifiedCycle] Starting cycle #1...
[UnifiedCycle] CYCLE STARTED - Discovering accounts...
[UnifiedCycle] Discovered 2 account(s) for processing in THIS cycle
[UnifiedCycle] Account list: @twitter_user_1, @twitter_user_2
[UnifiedCycle] Processing all accounts together...
[UnifiedCycle] Processing @twitter_user_1 (update)
[UnifiedCycle] ✓ @twitter_user_1: 5 new post(s) (1234ms)
[UnifiedCycle] Processing @twitter_user_2 (update)
[UnifiedCycle] ✓ @twitter_user_2: 2 new post(s) (567ms)
[UnifiedCycle] CYCLE COMPLETED
[UnifiedCycle] - Processed: 2 account(s)
[UnifiedCycle] - Errors: 0
[UnifiedCycle] - Duration: 1801ms
```

## Summary

The Twitter backend now implements a professional, unified scraping cycle that:
- Processes ALL accounts in ONE cycle
- Automatically includes newly added accounts
- Never creates separate jobs per account
- Manages the complete scraping flow
- Works seamlessly with the existing frontend

No frontend changes needed. The system is production-ready.
