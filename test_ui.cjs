const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[STEP') || text.includes('[FORENSIC]')) {
      logs.push(text);
      console.log(text);
    }
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // Attempt to login if needed
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.fill('admin@alvacio.com'); 
      const pwdInput = await page.$('input[type="password"]');
      if (pwdInput) await pwdInput.fill('admin123'); // guess
      const btn = await page.$('button[type="submit"]');
      if (btn) {
        await btn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=> {});
      }
    }

    // Wait for the side menu to appear
    await page.waitForTimeout(2000);
    
    // Go to Precios
    const preciosLink = await page.$('text="Precios"');
    if (preciosLink) {
      await preciosLink.click();
    } else {
      await page.goto('http://localhost:5173/precios', { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(2000);

    // Click "Editar Catálogo y Precios"
    const btnEdit = await page.waitForSelector('button:has-text("Editar Catálogo y Precios")', { timeout: 5000 });
    await btnEdit.click();
    await page.waitForTimeout(2000);

    // Uncheck a checkbox
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      await checkboxes[checkboxes.length - 1].click(); // uncheck the last one
    }
    
    // Change margin
    const margins = await page.$$('input[type="number"]');
    if (margins.length > 2) {
      await margins[2].fill('42');
    }

    // Click Guardar Cambios
    const btnGuardar = await page.waitForSelector('button:has-text("Guardar Cambios")');
    await btnGuardar.click();
    await page.waitForTimeout(1000);

    // Click Confirmar y Guardar
    const btnConfirm = await page.waitForSelector('button:has-text("Confirmar y Guardar")');
    await btnConfirm.click();
    await page.waitForTimeout(3000);

  } catch (err) {
    console.error("Test error:", err.message);
    await page.screenshot({ path: 'test_error.png' });
  } finally {
    await browser.close();
  }
})();
