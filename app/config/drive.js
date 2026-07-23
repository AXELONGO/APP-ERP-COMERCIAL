const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../../drive-token.json');

const OAUTH_CLIENT_ID = process.env.DRIVE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.DRIVE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

let driveClient = null;

function getOAuth2Client() {
  return new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI);
}

function getAuthUrl() {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

async function saveTokenFromCode(code) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

async function getDrive() {
  if (driveClient) return driveClient;

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('DRIVE_NO_TOKEN');
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', newTokens => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    Object.assign(existing, newTokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(existing, null, 2));
  });
  driveClient = google.drive({ version: 'v3', auth: oauth2 });
  console.log('[DRIVE] Usando OAuth 2.0');
  return driveClient;
}

async function uploadFile(fileBuffer, fileName, mimeType, parentFolderId = null) {
  const drive = await getDrive();
  const fileMetadata = {
    name: fileName,
    ...(parentFolderId ? { parents: [parentFolderId] } : {}),
  };
  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: Readable.from([fileBuffer]),
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime',
  });

  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return res.data;
}

async function getFile(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
  });
  return res.data;
}

async function listFiles(query = '', pageSize = 50) {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: query,
    pageSize,
    fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)',
    orderBy: 'createdTime desc',
  });
  return res.data.files || [];
}

async function deleteFile(fileId) {
  const drive = await getDrive();
  await drive.files.delete({ fileId });
}

async function downloadFile(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res.data;
}

module.exports = {
  getDrive, uploadFile, getFile, listFiles, deleteFile, downloadFile,
  getAuthUrl, saveTokenFromCode,
};
