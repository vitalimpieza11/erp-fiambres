const fs = require('fs');
const path = './src/hooks/useSales.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/status: data\.status \|\| 'pending',/g, "status: data.status || 'PENDIENTE',");
code = code.replace(/status: 'completed' as const/g, "status: 'PENDIENTE' as const");
code = code.replace(/status: 'completed'/g, "status: 'PENDIENTE'");
code = code.replace(/paymentStatusToProcess === 'paid'/g, "paymentStatusToProcess === 'PAGADA'");
code = code.replace(/saleData\.status === 'completed' \|\| saleData\.paymentStatus === 'paid'/g, "saleData.status === 'PAGADA'");
code = code.replace(/oldSale\.status === 'completed' \|\| oldSale\.paymentStatus === 'paid'/g, "oldSale.status === 'PAGADA'");

// In createSale
code = code.replace(
  /subtotal: calc\.subtotal,\n\s*total: calc\.total,\n\s*discount: discountPercent,/,
  `subtotal: calc.subtotal,
      total: calc.total,
      saldoPendiente: calc.total,
      discount: discountPercent,`
);

// We need to initialize statuses appropriately
code = code.replace(
  /const newSale = \{\n\s*\.\.\.saleData,\n\s*subtotal: calc\.subtotal,\n\s*total: calc\.total,\n\s*saldoPendiente: calc\.total,\n\s*discount: discountPercent,\n\s*id: saleId,\n\s*createdAt: Date\.now\(\),\n\s*updatedAt: Date\.now\(\),\n\s*userId: currentUserId\n\s*\};/,
  `const newSale = {
      ...saleData,
      status: 'PENDIENTE',
      subtotal: calc.subtotal,
      total: calc.total,
      saldoPendiente: calc.total,
      discount: discountPercent,
      id: saleId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: currentUserId
    };`
);

fs.writeFileSync(path, code, 'utf8');
console.log('Sales hook updated');
