const crypto = require('crypto');
const { getPool } = require('../config/database');

const INTEGRATION_DEFINITIONS = {
  waha: {
    label: 'WhatsApp Business API / WAHA',
    fields: [
      ['baseUrl', 'URL de WAHA', false], ['apiKey', 'API key', true], ['session', 'Sesión', false],
      ['webhookUrl', 'URL pública del webhook', false], ['webhookSecret', 'Secreto del webhook', true]
    ]
  },
  google_calendar: {
    label: 'Google Calendar',
    fields: [['clientId', 'Client ID', false], ['clientSecret', 'Client secret', true], ['refreshToken', 'Refresh token', true], ['calendarId', 'Calendar ID', false]]
  },
  gmail: {
    label: 'Gmail',
    fields: [['clientId', 'Client ID', false], ['clientSecret', 'Client secret', true], ['refreshToken', 'Refresh token', true], ['fromAddress', 'Correo remitente', false]]
  },
  google_drive: {
    label: 'Google Drive',
    fields: [['clientId', 'Client ID', false], ['clientSecret', 'Client secret', true], ['refreshToken', 'Refresh token', true], ['folderId', 'Folder ID', false]]
  },
  google_sheets: {
    label: 'Google Sheets',
    fields: [['credentialsJson', 'Credenciales JSON', true], ['spreadsheetId', 'Spreadsheet ID', false]]
  },
  shopify: {
    label: 'Shopify',
    fields: [['storeUrl', 'URL de la tienda', false], ['accessToken', 'Access token', true], ['apiVersion', 'API version', false]]
  },
  meta: {
    label: 'Meta Business · Messenger e Instagram',
    fields: [
      ['appId', 'Meta App ID', false], ['appSecret', 'Meta App Secret', true], ['redirectUri', 'URL de callback OAuth', false],
      ['webhookUrl', 'URL pública del webhook', false], ['verifyToken', 'Token de verificación', true],
      ['userAccessToken', 'User access token', true], ['pageId', 'Facebook Page ID', false], ['pageName', 'Facebook Page', false],
      ['pageAccessToken', 'Page access token', true], ['instagramAccountId', 'Instagram Professional ID', false], ['instagramAccessToken', 'Instagram access token', true]
    ]
  }
};

function definitionFor(provider) {
  const definition = INTEGRATION_DEFINITIONS[provider];
  if (!definition) {
    const error = new Error(`Integración no soportada: ${provider}`);
    error.status = 400;
    throw error;
  }
  return definition;
}

function encryptionKey() {
  const secret = process.env.ERP_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('ERP_AUTH_SECRET debe tener al menos 32 caracteres para guardar secretos');
  return crypto.createHash('sha256').update(`integration-config:${secret}`).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptSecret(value) {
  if (!String(value || '').startsWith('enc:v1:')) return value || '';
  const [, , ivValue, tagValue, dataValue] = String(value).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataValue, 'base64url')), decipher.final()]).toString('utf8');
}

async function getIntegrationConfig(workspaceId, provider) {
  definitionFor(provider);
  const result = await getPool().query(
    'SELECT provider, config, enabled, updated_at FROM integration_configs WHERE workspace_id = $1 AND provider = $2',
    [workspaceId, provider]
  );
  const row = result.rows[0];
  if (!row) return { provider, enabled: false, config: {} };
  const secretFields = new Set(definitionFor(provider).fields.filter(field => field[2]).map(field => field[0]));
  const config = Object.fromEntries(Object.entries(row.config || {}).map(([key, value]) => [key, secretFields.has(key) ? decryptSecret(value) : value]));
  return { provider, enabled: row.enabled, config, updated_at: row.updated_at };
}

async function saveIntegrationConfig(workspaceId, provider, input = {}) {
  const definition = definitionFor(provider);
  const current = await getIntegrationConfig(workspaceId, provider);
  const secretFields = new Set(definition.fields.filter(field => field[2]).map(field => field[0]));
  const allowedFields = new Set(definition.fields.map(field => field[0]));
  const config = { ...current.config };
  for (const [key, value] of Object.entries(input)) {
    if (!allowedFields.has(key)) continue;
    if (secretFields.has(key)) {
      if (String(value || '').trim()) config[key] = String(value).trim();
    } else if (value !== undefined) {
      config[key] = String(value).trim();
    }
  }
  const enabled = input.enabled === undefined ? current.enabled : Boolean(input.enabled);
  const persistedConfig = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, secretFields.has(key) && value ? encryptSecret(value) : value]));
  await getPool().query(
    `INSERT INTO integration_configs (workspace_id, provider, config, enabled)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (workspace_id, provider) DO UPDATE SET config = EXCLUDED.config, enabled = EXCLUDED.enabled, updated_at = now()`,
    [workspaceId, provider, persistedConfig, enabled]
  );
  return getIntegrationConfig(workspaceId, provider);
}

function publicIntegrationConfig(saved) {
  const definition = definitionFor(saved.provider);
  const secretFields = new Set(definition.fields.filter(field => field[2]).map(field => field[0]));
  return {
    provider: saved.provider,
    label: definition.label,
    enabled: saved.enabled,
    configured: Object.keys(saved.config || {}).length > 0,
    updated_at: saved.updated_at || null,
    fields: definition.fields.map(([key, label, secret]) => ({
      key,
      label,
      secret,
      value: secret ? '' : (saved.config?.[key] || ''),
      hasValue: Boolean(saved.config?.[key]) && (!secret || saved.config[key] !== '')
    }))
  };
}

module.exports = { INTEGRATION_DEFINITIONS, getIntegrationConfig, saveIntegrationConfig, publicIntegrationConfig, definitionFor };
