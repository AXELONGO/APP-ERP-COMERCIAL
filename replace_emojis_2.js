const fs = require('fs');

const mappings = [
  // webhooks.js template literals
  { file: 'public/webhooks.js', search: '`✅', replace: '`<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i>' },
  { file: 'public/webhooks.js', search: '`❌', replace: '`<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i>' },

  // app.js template literals
  { file: 'public/app.js', search: '`✅', replace: '`<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i>' },
  { file: 'public/app.js', search: '`❌', replace: '`<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i>' },
];

['public/app.js', 'public/webhooks.js'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  mappings.filter(m => m.file === file).forEach(m => {
    content = content.split(m.search).join(m.replace);
  });
  fs.writeFileSync(file, content);
});
