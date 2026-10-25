# Unified Twitter Scraping Cycle - Implementation Guide

## Overview

The Twitter backend has been implemented with a **UNIFIED SCRAPING CYCLE** system that processes all monitored accounts together in a single, centralized cycle. This design prevents duplicate scraping jobs, optimizes resource usage, and automatically includes newly added accounts.

## Architecture

### Core Concept

```
┌─────────────────────────────────────────────────────────────┐
│                   UNIFIED CYCLE SYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Server Start                                                │
│       ↓                                                       │
│  startMonitoring() called ONCE                              │
│       ↓                                                       │
│  Creates ONE scheduler (cron OR interval)                   │
│       ↓                                                       │
│  ┌─ Runs every N minutes/seconds ─┐                        │
│  │                                 │                        │
│  │  runMonitoringCycle()           │                        │
│  │  • Discover ALL current accounts│                        │
│  │  • Process all together         │                        │
│  │  • Create alerts                │                        │
│  │  • Update account state         │                        │
│  │                                 │                        │
│  └─────────────────────────────────┘                        │
│                                                              │
│  Key: Newly added accounts are automatically                │
│       included in the NEXT cycle                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Processing Flow Per Cycle

```
Cycle Start
    ↓
Fetch ALL monitored accounts
    ↓
For each account:
    • Get latest tweets since lastTweetId
    • Deduplicate posts
    • Create alerts for new posts
    • Update account state (lastTweetId, lastChecked)
    ↓
Cycle Complete
    ↓
Wait for next scheduled cycle
```

## Implementation Files

### 1. **jobs/monitoringJob.js** - Unified Job Scheduler
- **Purpose**: Manages the SINGLE cycle scheduler
- **Key Features**:
  - Starts ONE cron job or interval (never multiple)
  - Logs indicate "UNIFIED CYCLE" at startup
  - Cycle counter tracks executions
  - No account-specific job creation

### 2. **worker/monitor.js** - Cycle Worker
- **Purpose**: Executes the monitoring cycle
- **Key Features**:
  - `runMonitoringCycle()` - Core unified cycle function
  - Prevents concurrent execution with `isRunning` flag
  - Dynamically discovers accounts each cycle
  - Processes all accounts sequentially in one cycle
  - Enhanced logging with cycle markers

### 3. **controllers/dashboardController.js** - Status Endpoint
- **Purpose**: Provides monitoring status information
- **Endpoint**: `GET /api/dashboard/monitoring-status`
- **Response**: Unified cycle status, account counts, alerts

### 4. **routes/dashboard.js** - Route Registration
- **Change**: Added `/monitoring-status` endpoint

## Unified Cycle Behavior

### Single Cycle Guarantee

```javascript
// ONLY ONE of these runs - never multiple
const startMonitoring = () => {
  if (isMonitoringStarted) {
    logger.warn('Only ONE unified cycle is active');
    return; // Prevents duplicate schedulers
  }
  
  // Create ONE scheduler
  cronJob = cron.schedule(pattern, runMonitoringCycle);
  // or
  monitoringInterval = setInterval(runMonitoringCycle, interval);
};
```

### Dynamic Account Discovery

```javascript
const runMonitoringCycle = async () => {
  // EVERY cycle, fetch CURRENT list of accounts
  const accounts = await MonitoredAccount.find({
    monitoringStatus: { $in: ['active', 'error'] }
  });
  
  // Process ALL of them together
  for (const account of accounts) {
    await checkAccount(account);
  }
};
```

### Newly Added Accounts

When a new account is added:

```
1. API call: POST /api/accounts
   └─ Creates MonitoredAccount in database
   └─ Sets monitoringStatus: 'active'

2. Waiting for next cycle...

3. runMonitoringCycle() executes
   └─ Queries database for ALL accounts
   └─ New account is now included
   └─ Processed together with existing accounts
```

## Verification

### 1. Check Unified Cycle is Running

```bash
# Run verification script
node server/twitter/scripts/verify-unified-cycle.js

# Or check logs at startup
# Should show:
# [UnifiedCycle] STARTING UNIFIED TWITTER MONITORING SYSTEM
# [UnifiedCycle] - ONE centralized cycle for ALL accounts
```

### 2. Monitor Log Output

Each cycle produces logs:

```
[UnifiedCycle] Starting cycle #1...
[UnifiedCycle] CYCLE STARTED - Discovering accounts...
[UnifiedCycle] Discovered 3 account(s) for processing in THIS cycle
[UnifiedCycle] Account list: @account1, @account2, @account3
[UnifiedCycle] Processing all accounts together...
[UnifiedCycle] Processing @account1...
[UnifiedCycle] ✓ @account1: 2 new post(s)
[UnifiedCycle] Processing @account2...
[UnifiedCycle] ✓ @account2: 0 new post(s)
[UnifiedCycle] Processing @account3...
[UnifiedCycle] ✓ @account3: 1 new post(s)
[UnifiedCycle] CYCLE COMPLETED
[UnifiedCycle] - Processed: 3 account(s)
[UnifiedCycle] - Duration: 1234ms
[UnifiedCycle] - Next cycle will auto-include any newly added accounts
```

### 3. Check Status Endpoint

```bash
curl http://localhost:5000/api/dashboard/monitoring-status

# Response shows:
{
  "success": true,
  "data": {
    "unifiedCycle": {
      "isRunning": true,
      "cyclesExecuted": 42,
      "scheduler": "cron",
      "description": "ONE centralized monitoring cycle for all Twitter accounts",
      "isUnified": true
    },
    "accounts": {
      "total": 3,
      "active": 3,
      "paused": 0
    },
    "alerts": {
      "total": 15
    },
    "info": {
      "newAccountsAutoIncluded": "Yes - automatically included in next cycle",
      "separateJobsPerAccount": "No - single unified cycle processes all",
      "message": "Twitter backend uses ONE shared scraping cycle for all monitored accounts"
    }
  }
}
```

## Testing Unified Cycle Behavior

### Test 1: Verify Only ONE Cycle Exists

```bash
# Check logs for startup message
grep "STARTING UNIFIED TWITTER MONITORING SYSTEM" logs/twitter-*.log

# Should appear exactly ONCE when server starts
```

### Test 2: Add Multiple Accounts and Verify All Processed Together

```bash
# Add Account A
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username": "account_a"}'

# Wait for 1 cycle...

# Add Account B
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"username": "account_b"}'

# Check logs in next cycle - should show BOTH accounts processed:
# [UnifiedCycle] Account list: @account_a, @account_b
# [UnifiedCycle] Processing @account_a...
# [UnifiedCycle] Processing @account_b...
```

### Test 3: Verify No Separate Jobs

```bash
# Check process list - should show only ONE Node.js server
ps aux | grep "node.*twitter"

# Should output ONE process, not multiple scrapers
```

### Test 4: Verify Frontend Receives Data

```bash
# Add account via API
# Check frontend displays alerts
# Verify frontend shows data from all accounts
# All data should come from the single unified cycle
```

## Configuration

### Monitoring Interval

Set via environment variable:

```bash
# .env file
MONITORING_INTERVAL=10  # Check every 10 minutes

# or for frequent checking
MONITORING_INTERVAL=30  # Check every 30 seconds
```

### Important Notes

- **Interval < 60**: Uses `setInterval` (high-frequency polling)
- **Interval >= 60**: Uses cron schedule (minute-based)
- **Dynamic accounts**: New accounts included automatically in next cycle
- **Error handling**: Failed accounts don't stop the cycle
- **Concurrent protection**: `isRunning` flag prevents overlapping cycles

## Frontend Integration

The frontend automatically receives data from the unified cycle:

1. **Account Monitoring**: User adds account via frontend
2. **Backend Processing**: Account included in next unified cycle
3. **Alert Generation**: Cycle creates alerts
4. **WebSocket Update**: Alerts pushed to frontend via Socket.io
5. **Frontend Display**: User sees alerts in real-time

No frontend changes needed - the unified backend cycle automatically feeds data.

## Troubleshooting

### Monitoring Not Running

```bash
# Check logs
tail -f logs/twitter-*.log

# Should show:
# [UnifiedCycle] STARTING UNIFIED TWITTER MONITORING SYSTEM

# If not visible, check server started successfully
```

### Accounts Not Being Processed

```bash
# Check database for accounts
db.monitoredaccounts.find()

# Verify monitoringStatus is 'active'
# Check logs for account discovery messages
```

### Duplicate Accounts Being Processed

```bash
# This shouldn't happen - check logs for errors
# Verify only ONE monitoring job exists in logs
```

## Summary

✓ **ONE Unified Cycle**: Single scheduler processes all accounts  
✓ **Auto-Include New Accounts**: Dynamically discovered each cycle  
✓ **No Duplicate Jobs**: Prevented by `isMonitoringStarted` flag  
✓ **Centralized Backend**: Complete flow managed in Twitter backend  
✓ **Frontend Compatible**: Automatically receives unified cycle data  
✓ **Professional Logging**: Clear cycle execution visibility  
✓ **Error Resilient**: Failed accounts don't break the cycle  

The implementation is complete, production-ready, and follows professional backend architecture patterns.
