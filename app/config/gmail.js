const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const TOKEN_PATH = path.join(__dirname, '../../gmail-token.json');
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.DRIVE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.DRIVE_CLIENT_SECRET || '';
const REDIRECT_URI = String(process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/gmail/callback')
  .trim()
  .replace(/^URI\s*=\s*/i, '')
  .replace(/^['"]|['"]$/g, '');

function getGmailOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('GMAIL_OAUTH_NOT_CONFIGURED');
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getGmailAuthUrl() {
  const oauth2 = getGmailOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_SCOPE]
  });
}

async function saveGmailTokenFromCode(code) {
  const oauth2 = getGmailOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

function hasGmailToken() {
  return fs.existsSync(TOKEN_PATH) || Boolean(process.env.GMAIL_REFRESH_TOKEN);
}

async function getGmail() {
  if (!hasGmailToken()) throw new Error('GMAIL_NO_TOKEN');
  const tokens = fs.existsSync(TOKEN_PATH)
    ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
    : { refresh_token: process.env.GMAIL_REFRESH_TOKEN, scope: GMAIL_SCOPE };
  if (tokens.scope && !tokens.scope.split(/\s+/).includes(GMAIL_SCOPE)) {
    throw new Error('GMAIL_SCOPE_REQUIRED');
  }
  const oauth2 = getGmailOAuth2Client();
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', newTokens => {
    if (fs.existsSync(TOKEN_PATH)) {
      const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...newTokens }, null, 2));
    }
  });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

module.exports = { GMAIL_SCOPE, getGmailAuthUrl, saveGmailTokenFromCode, getGmail, hasGmailToken };
