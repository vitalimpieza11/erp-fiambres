import fs from 'fs';
import path from 'path';

const logPath = 'c:/Users/Usuario/OneDrive/Documentos/GitHub/erp-fiambres/panther_log.txt';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  console.log("Log file size:", content.length);
  const lines = content.split('\n');
  let matchCount = 0;
  lines.forEach((line, index) => {
    if (/error|exception|nan|undefined|failed|invalid/i.test(line)) {
      matchCount++;
      if (matchCount < 100) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    }
  });
  console.log(`Total matching lines: ${matchCount}`);
} else {
  console.log("panther_log.txt not found");
}
