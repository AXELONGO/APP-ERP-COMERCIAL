const fs = require('fs');

const mappings = [
  // index.html
  { file: 'public/index.html', search: '📢', replace: '<i class="ph-fill ph-megaphone"></i>' },
  { file: 'public/index.html', search: '✅', replace: '<i class="ph-fill ph-check-circle" style="color:#10b981;"></i>' },
  { file: 'public/index.html', search: '🏷️', replace: '<i class="ph-fill ph-tag"></i>' },
  { file: 'public/index.html', search: '📤', replace: '<i class="ph-fill ph-paper-plane-tilt"></i>' },
  { file: 'public/index.html', search: '📊', replace: '<i class="ph-fill ph-chart-bar"></i>' },
  { file: 'public/index.html', search: '📁', replace: '<i class="ph-fill ph-folder"></i>' },
  { file: 'public/index.html', search: '📝', replace: '<i class="ph-fill ph-pencil-simple"></i>' },

  // app.js (UI strings in showToast and innerHTML)
  { file: 'public/app.js', search: '✅', replace: '<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i>' },
  { file: 'public/app.js', search: '❌', replace: '<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i>' },
  { file: 'public/app.js', search: '🔄', replace: '<i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i>' },
  { file: 'public/app.js', search: '♻️', replace: '<i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i>' },

  // webhooks.js (UI strings in showToast and HTML)
  { file: 'public/webhooks.js', search: "'✅", replace: "'<i class=\"ph-fill ph-check-circle\" style=\"color:#10b981; vertical-align:middle; margin-right:4px;\"></i>" },
  { file: 'public/webhooks.js', search: "'❌", replace: "'<i class=\"ph-fill ph-x-circle\" style=\"color:#ef4444; vertical-align:middle; margin-right:4px;\"></i>" },
  { file: 'public/webhooks.js', search: "'⚠️", replace: "'<i class=\"ph-fill ph-warning\" style=\"color:#f59e0b; vertical-align:middle; margin-right:4px;\"></i>" },
  { file: 'public/webhooks.js', search: '📈', replace: '<i class="ph-fill ph-trend-up"></i>' },
  { file: 'public/webhooks.js', search: '🔁', replace: '<i class="ph-bold ph-arrows-left-right"></i>' },
  { file: 'public/webhooks.js', search: '📅', replace: '<i class="ph-fill ph-calendar-blank"></i>' },
];

['public/index.html', 'public/app.js', 'public/webhooks.js'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  mappings.filter(m => m.file === file).forEach(m => {
    // Escape string for regex if needed, or just use split/join
    content = content.split(m.search).join(m.replace);
  });

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
