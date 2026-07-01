import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/caja');

  // Wait until window.__CAJA_MOVEMENTS__ is available
  await page.waitForFunction(() => window.__CAJA_MOVEMENTS__ !== undefined && window.__CAJA_MOVEMENTS__.length > 0, { timeout: 15000 });

  const auditData = await page.evaluate(() => {
    return window.__CAJA_MOVEMENTS__;
  });

  if (auditData) {
    const movements = auditData;
    let normalCount = 0;
    let annulmentCount = 0;
    let compensationsCount = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let bankIncome = 0;
    let bankExpense = 0;
    let efecIncome = 0;
    let efecExpense = 0;

    movements.forEach(m => {
      const amount = Number(m.amount) || 0;
      const isAnnulment = m.category === 'ANULACION' || m.description?.toLowerCase().includes('anulaci');
      
      if (isAnnulment) {
        annulmentCount++;
        compensationsCount++;
      } else {
        normalCount++;
      }

      if (m.type === 'INCOME') totalIncome += amount;
      else if (m.type === 'EXPENSE') totalExpense += amount;

      const desc = (m.description || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const isBanco = desc.includes('banco') || 
                      desc.includes('transferencia') || 
                      desc.includes('transf') || 
                      desc.includes('deposito') || 
                      desc.includes('depósito') ||
                      desc.includes('cheque') ||
                      cat.includes('banco') || 
                      cat.includes('transferencia');
      
      if (isBanco) {
        if (m.type === 'INCOME') bankIncome += amount;
        else if (m.type === 'EXPENSE') bankExpense += amount;
      } else {
        if (m.type === 'INCOME') efecIncome += amount;
        else if (m.type === 'EXPENSE') efecExpense += amount;
      }
    });

    console.log("=== REPORTE DE AUDITORIA DE CAJA ===");
    console.log("Total Movimientos:", movements.length);
    console.log("Cantidad Normales:", normalCount);
    console.log("Cantidad Anulaciones/Compensaciones:", annulmentCount);
    console.log("Saldo Efectivo (Aprox):", efecIncome - efecExpense);
    console.log("Saldo Bancos (Aprox):", bankIncome - bankExpense);
    console.log("Saldo Dashboard / Total Global:", totalIncome - totalExpense);

  } else {
    console.log("Could not find movements.");
  }
  
  await browser.close();
})();
