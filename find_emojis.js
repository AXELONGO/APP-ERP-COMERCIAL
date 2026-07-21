const fs = require('fs');
const files = ['public/index.html', 'public/app.js', 'public/webhooks.js'];
const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const emojis = [...new Set(content.match(emojiRegex) || [])];
  if(emojis.length > 0) console.log(f, emojis.join(' '));
});
