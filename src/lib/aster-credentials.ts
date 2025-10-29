/**
 * ASTER Credentials Manager
 * Securely manages per-agent API credentials from environment variables
 */

export interface AsterCredentials {
  apiKey: string;
  secretKey: string;
}

const CREDENTIAL_KEY_MAP: Record<string, { apiKey: string; secretKey: string }> = {
  GPT: {
    apiKey: 'ASTER_API_KEY_GPT',
    secretKey: 'ASTER_SECRET_KEY_GPT',
  },
  CLAUDE: {
    apiKey: 'ASTER_API_KEY_GPT',
    secretKey: 'ASTER_SECRET_KEY_GPT',
  },
  DEEPSEEK: {
    apiKey: 'ASTER_API_KEY_DEEPSEEK',
    secretKey: 'ASTER_SECRET_KEY_DEEPSEEK',
  },
  GEMINI: {
    apiKey: 'ASTER_API_KEY_GEMINI',
    secretKey: 'ASTER_SECRET_KEY_GEMINI',
  },
  GROK: {
    apiKey: 'ASTER_API_KEY_GROK',
    secretKey: 'ASTER_SECRET_KEY_GROK',
  },
  DEFAULT: {
    apiKey: 'ASTER_API_KEY_DEFAULT',
    secretKey: 'ASTER_SECRET_KEY_DEFAULT',
  },
};

export function getAgentCredentials(credentialKey: string): AsterCredentials {
  const normalizedKey = credentialKey.toUpperCase().trim();
  const envVarNames = CREDENTIAL_KEY_MAP[normalizedKey];
  
  if (!envVarNames) {
    throw new Error(
      `Unknown credential key: ${credentialKey}. Valid keys: ${Object.keys(CREDENTIAL_KEY_MAP).join(', ')}`
    );
  }

  const apiKey = process.env[envVarNames.apiKey];
  const secretKey = process.env[envVarNames.secretKey];

  if (!apiKey || !secretKey) {
    throw new Error(
      `Credentials not configured for ${credentialKey}. ` +
        `Please set ${envVarNames.apiKey} and ${envVarNames.secretKey} in .env.local`
    );
  }

  return { apiKey, secretKey };
}

export function hasCredentials(credentialKey: string): boolean {
  try {
    getAgentCredentials(credentialKey);
    return true;
  } catch {
    return false;
  }
}

export function logCredentialStatus(): void {
  const configured: string[] = [];
  const missing: string[] = [];

  for (const key of Object.keys(CREDENTIAL_KEY_MAP)) {
    if (hasCredentials(key)) {
      configured.push(key);
    } else {
      missing.push(key);
    }
  }

  console.log('[ASTER Credentials] Status:');
  console.log(`  ✅ Configured: ${configured.join(', ') || 'None'}`);
  if (missing.length > 0) {
    console.warn(`  ❌ Missing: ${missing.join(', ')}`);
  }
}