const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Inject requires at top
const imports = `
const asyncHandler = require('./utils/asyncHandler');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { reportBug } = require('./utils/bugReporter');

// Uncaught Exception / Unhandled Rejection Handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  reportBug({ level: 'critical', message: 'Uncaught Exception: ' + err.message, error: err })
    .finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  reportBug({ level: 'critical', message: 'Unhandled Rejection: ' + (reason?.message || reason), error: reason });
});
`;

code = code.replace("const rateLimit = require('express-rate-limit');", "const rateLimit = require('express-rate-limit');\n" + imports);

// 2. Wrap routes and remove try/catch

// For GET
code = code.replace(/app\.get\(`\/api\/\$\{endpoint\}`,\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\s*\n\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\s*\n\s*\}\n\s*\}\);/g, 
  "app.get(`/api/${endpoint}`, asyncHandler(async (req, res) => {\n$1\n}));");

// For POST
code = code.replace(/app\.post\(`\/api\/\$\{endpoint\}`,\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\s*\}\n\s*\}\);/g,
  "app.post(`/api/${endpoint}`, asyncHandler(async (req, res) => {\n$1\n}));");

// For PUT
code = code.replace(/app\.put\(`\/api\/\$\{endpoint\}\/:id`,\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\s*\}\n\s*\}\);/g,
  "app.put(`/api/${endpoint}/:id`, asyncHandler(async (req, res) => {\n$1\n}));");

// For DELETE
code = code.replace(/app\.delete\(`\/api\/\$\{endpoint\}\/:id`,\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\s*\}\n\s*\}\);/g,
  "app.delete(`/api/${endpoint}/:id`, asyncHandler(async (req, res) => {\n$1\n}));");

// Dashboard
code = code.replace(/app\.get\('\/api\/dashboard',\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\s*\}\n\}\);/g,
  "app.get('/api/dashboard', asyncHandler(async (req, res) => {\n$1\n}));");

// Tracker
code = code.replace(/app\.get\('\/api\/tracker',\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\n\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\n\s*\}\n\}\);/g,
  "app.get('/api/tracker', asyncHandler(async (req, res) => {\n$1\n}));");

// Webhook Proxy
code = code.replace(/app\.post\('\/api\/webhook-proxy',\s*async\s*\(req,\s*res\)\s*=>\s*\{\n\s*try\s*\{\n([\s\S]*?)\n\s*\}\s*catch\s*\(e\)\s*\{\n\s*res\.status\(500\)\.json\(\{ error: e\.message \}\);\n\s*\}\n\}\);/g,
  "app.post('/api/webhook-proxy', asyncHandler(async (req, res) => {\n$1\n}));");

// 3. Add global handlers at the end
const foot = `
app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => console.log(\`\\n🚀 ERP LUMARK → http://localhost:\${PORT}\\n\`));
`;

code = code.replace(/app\.listen\(PORT, \(\) => console\.log\(`\\n🚀 ERP LUMARK → http:\/\/localhost:\$\{PORT\}\\n`\)\);/g, foot);

fs.writeFileSync('server.js', code);
console.log('Refactor complete!');
