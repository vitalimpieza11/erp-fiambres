export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const newObj = {} as any;
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        newObj[key] = removeUndefinedFields(val);
      }
    }
    return newObj as T;
  }
  return obj;
}

const testMappedItems = [
  {
    productId: "jamon-panther-001",
    cantidad: 2,
    unidad: "UNIDADES",
    precioUnitario: 9780,
    subtotal: 27530.70,
    pesoReal: 2.815,
    pesosReales: [1.475, 1.340]
  }
];

console.log('SALE_GUARDADA', JSON.stringify(testMappedItems, null, 2));

const saleData = {
  orderId: "TEST_ORDER_123",
  items: testMappedItems,
  status: "FACTURADO"
};

const sanitized = removeUndefinedFields(saleData);
console.log('SANITIZED', JSON.stringify(sanitized, null, 2));
