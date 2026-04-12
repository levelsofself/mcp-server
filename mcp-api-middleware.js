// MCP API Key Middleware - Shared module for all 3 MCP servers
// Validates API keys, enforces tier limits, tracks free tier usage
const fs = require('fs');
const crypto = require('crypto');

const KEYS_FILE = '/root/family-data/mcp-api-keys.json';
const SIGNUP_URL = 'https://api.100levelup.com/mcp-pricing/';

// Tier limits
const TIER_LIMITS = {
  free: { daily_calls: 10 },
  pro: { daily_calls: 1000 },
  team: { daily_calls: 5000 },
  enterprise: { daily_calls: 999999 }
};

// Free tool definitions per server
const FREE_TOOLS = {
  'levels-of-self': ['get_scenario', 'get_game_info'],
  'palyan-ai-ops': ['get_business_ops', 'get_family_info'],
  'nervous-system': ['get_framework', 'get_nervous_system_info', 'drift_audit', 'security_audit', 'page_health', 'mcp_analyzer', 'self_check']
};

// Free tier daily limits per server (for free tools, no key needed)
const FREE_TIER_LIMITS = {
  'levels-of-self': 10,
  'palyan-ai-ops': 5,
  'nervous-system': 10
};

function loadKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  } catch (e) {
    return { keys: {}, free_tier_usage: {} };
  }
}

function saveKeys(data) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

// Reset daily counters at midnight UTC
function getFreeTierCount(data, ip, serverName) {
  const key = `${ip}:${serverName}`;
  const usage = data.free_tier_usage[key];
  if (!usage || usage.date !== todayUTC()) {
    return 0;
  }
  return usage.count || 0;
}

function incrementFreeTier(data, ip, serverName) {
  const key = `${ip}:${serverName}`;
  const today = todayUTC();
  if (!data.free_tier_usage[key] || data.free_tier_usage[key].date !== today) {
    data.free_tier_usage[key] = { date: today, count: 0 };
  }
  data.free_tier_usage[key].count++;
  saveKeys(data);
}

function getKeyDailyCount(data, apiKey) {
  const keyData = data.keys[apiKey];
  if (!keyData) return 0;
  if (!keyData.usage_date || keyData.usage_date !== todayUTC()) {
    return 0;
  }
  return keyData.usage_count || 0;
}

function incrementKeyUsage(data, apiKey) {
  const today = todayUTC();
  if (!data.keys[apiKey].usage_date || data.keys[apiKey].usage_date !== today) {
    data.keys[apiKey].usage_date = today;
    data.keys[apiKey].usage_count = 0;
  }
  data.keys[apiKey].usage_count++;
  saveKeys(data);
}

// Generate a new API key
function generateAPIKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Create a new API key entry
function createAPIKey(tier, email, stripeCustomerId) {
  const data = loadKeys();
  const key = generateAPIKey();
  data.keys[key] = {
    tier: tier,
    daily_calls: TIER_LIMITS[tier]?.daily_calls || TIER_LIMITS.free.daily_calls,
    created_at: new Date().toISOString(),
    stripe_customer_id: stripeCustomerId || null,
    email: email || null,
    active: true
  };
  saveKeys(data);
  return key;
}

// Main validation function - call this before handling any tool call
// Returns: { allowed: true } or { allowed: false, status: 401|429, message: string }
function validateRequest(req, serverName, toolName) {
  const data = loadKeys();
  const ip = getClientIP(req);

  // Localhost bypass - internal calls (Tamara, bridge, smoke tests) skip rate limiting
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
  if (isLocal) {
    return { allowed: true, tier: 'internal' };
  }
  const freeTools = FREE_TOOLS[serverName] || [];
  const isFreeTool = freeTools.includes(toolName);

  // Get API key from header or query param
  const apiKey = req.headers['x-api-key'] ||
    new URL(req.url, 'http://localhost').searchParams.get('api_key');

  // If API key provided, validate it
  if (apiKey) {
    const keyData = data.keys[apiKey];
    if (!keyData) {
      return {
        allowed: false,
        status: 401,
        message: 'Invalid API key. Get a valid key at ' + SIGNUP_URL
      };
    }
    if (!keyData.active) {
      return {
        allowed: false,
        status: 401,
        message: 'API key is deactivated. Contact support or get a new key at ' + SIGNUP_URL
      };
    }

    // Check daily limit for this key
    const dailyLimit = TIER_LIMITS[keyData.tier]?.daily_calls || keyData.daily_calls;
    const currentCount = getKeyDailyCount(data, apiKey);
    if (currentCount >= dailyLimit) {
      return {
        allowed: false,
        status: 429,
        message: `Daily limit reached (${dailyLimit} calls/day for ${keyData.tier} tier). Resets at midnight UTC. Upgrade at ${SIGNUP_URL}`
      };
    }

    // Valid key, within limits
    incrementKeyUsage(data, apiKey);
    return { allowed: true, tier: keyData.tier };
  }

  // No API key - check if this is a free tool
  if (!isFreeTool) {
    return {
      allowed: false,
      status: 401,
      message: `The tool "${toolName}" requires an API key. Free tools for this server: ${freeTools.join(', ')}. Get your API key at ${SIGNUP_URL}`
    };
  }

  // Free tool, check rate limit by IP
  const freeLimit = FREE_TIER_LIMITS[serverName] || 10;
  const freeCount = getFreeTierCount(data, ip, serverName);
  if (freeCount >= freeLimit) {
    return {
      allowed: false,
      status: 429,
      message: `Free tier limit reached (${freeLimit} calls/day). Get an API key for unlimited access at ${SIGNUP_URL}`
    };
  }

  // Free tool within limits
  incrementFreeTier(data, ip, serverName);
  return { allowed: true, tier: 'free' };
}

// MCP error response for blocked requests
function mcpErrorResponse(id, validation) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: validation.status === 429 ? 'rate_limit_exceeded' : 'authentication_required',
          message: validation.message,
          upgrade_url: SIGNUP_URL
        }, null, 2)
      }]
    }
  });
}

module.exports = {
  validateRequest,
  mcpErrorResponse,
  createAPIKey,
  generateAPIKey,
  loadKeys,
  saveKeys,
  FREE_TOOLS,
  TIER_LIMITS,
  SIGNUP_URL
};
