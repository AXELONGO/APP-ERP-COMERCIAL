const crypto = require('crypto');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphRequest(path, options = {}) {
  const response = await fetch(`${GRAPH_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok || data?.error) {
    const error = new Error(data?.error?.message || data?.message || `Meta respondió HTTP ${response.status}`);
    error.status = response.status;
    error.meta = data?.error || data;
    throw error;
  }
  return data;
}

function metaOAuthUrl({ appId, redirectUri, state }) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ['business_management', 'pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'pages_messaging', 'instagram_basic', 'instagram_manage_messages'].join(','));
  return url.toString();
}

async function exchangeCode({ appId, appSecret, redirectUri, code }) {
  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  return graphRequest(`/oauth/access_token${url.search}`);
}

async function listPages(accessToken) {
  const fields = 'id,name,access_token,instagram_business_account{id,username}';
  return graphRequest(`/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`);
}

async function sendMessage({ channel, recipientId, text, pageId, instagramAccountId, pageAccessToken, instagramAccessToken }) {
  const objectId = channel === 'instagram' ? instagramAccountId : pageId;
  const accessToken = channel === 'instagram' ? (instagramAccessToken || pageAccessToken) : pageAccessToken;
  if (!objectId || !accessToken) throw new Error(`Meta no está configurado para ${channel}`);
  return graphRequest(`/${encodeURIComponent(objectId)}/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } })
  });
}

function verifySignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const left = Buffer.from(String(signature));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = { graphRequest, metaOAuthUrl, exchangeCode, listPages, sendMessage, verifySignature, GRAPH_VERSION };
