import fs from 'fs';

const logPath = 'c:/Users/Usuario/OneDrive/Documentos/GitHub/erp-fiambres/panther_log.txt';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  console.log(content.slice(0, 1000));
} else {
  console.log("Not found");
}
