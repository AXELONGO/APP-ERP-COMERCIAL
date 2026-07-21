const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Replace standard throw
code = code.replace(/if \(!res\.ok\) throw new Error\(`Error al actualizar \$\{payloadKey\}`\);/g, 
  "if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || `Error al actualizar ${payloadKey}`); }");

code = code.replace(/if \(!res\.ok\) throw new Error\('Error al guardar el estado'\);/g, 
  "if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'Error al guardar el estado'); }");

code = code.replace(/if \(!res\.ok\) throw new Error\('Error al actualizar'\);/g, 
  "if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'Error al actualizar'); }");

code = code.replace(/if \(!res\.ok\) throw new Error\('Error al guardar la actividad'\);/g, 
  "if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'Error al guardar la actividad'); }");

fs.writeFileSync('public/app.js', code);
console.log('Fixed app.js error handling');
