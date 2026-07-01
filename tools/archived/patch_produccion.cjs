const fs = require('fs');

let content = fs.readFileSync('src/pages/Produccion.tsx', 'utf-8');

// 1. Icons
content = content.replace(
    "import { Play, CheckCircle, ClipboardList, Calendar, ShoppingBag, Layers, Scissors, Package, Printer } from 'lucide-react';",
    "import { Play, CheckCircle, ClipboardList, Calendar, ShoppingBag, Layers, Scissors, Package, Printer, ChevronDown, ChevronRight } from 'lucide-react';"
);

// 2. States
const state_injection = `  const activeOrders = useMemo(() => {
    return orders.filter(o => filterDate(o.date) && (o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION'));
  }, [orders, filterDate]);

  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const toggleClient = (client: string) => {
    setExpandedClients(prev => ({ ...prev, [client]: !prev[client] }));
  };

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const groupedOrders = useMemo(() => {
    const map: Record<string, typeof activeOrders> = {};
    activeOrders.forEach(order => {
      const customer = order.customerName || 'Cliente Desconocido';
      if (!map[customer]) map[customer] = [];
      map[customer].push(order);
    });
    return map;
  }, [activeOrders]);`;

content = content.replace(
    /  const activeOrders = useMemo\(\(\) => \{\n    return orders\.filter\(o => filterDate\(o\.date\) && \(o\.status === 'PENDIENTE' \|\| o\.status === 'EN_PRODUCCION'\)\);\n  \}, \[orders, filterDate\]\);/,
    state_injection
);

// 3. Render accordion for pedidos tab
const render_start = `        {activeTab === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Gestión Individual de Pedidos</h2>
            {activeOrders.length === 0 ? <EmptyState icon={ClipboardList} title="Al día" description="No hay pedidos pendientes." /> : 
              activeOrders.map((order) => (`;

const render_end = `                </Card>
              ))
            }
          </div>
        )}`;

// Wait, doing this via regex is tricky because we need to replace the entire map block.
// The block spans from `activeOrders.map((order) => (` to the closing of that map.
// Instead, I'll provide the exact replacement block.
const accordion_pedidos = `        {activeTab === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Gestión Individual de Pedidos</h2>
            {Object.keys(groupedOrders).length === 0 ? <EmptyState icon={ClipboardList} title="Al día" description="No hay pedidos pendientes." /> : 
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px' }}>
                {Object.entries(groupedOrders).map(([clientName, clientOrders]) => (
                  <div key={clientName} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div 
                      onClick={() => toggleClient(clientName)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {expandedClients[clientName] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span>{clientName}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: 'auto' }}>
                        {clientOrders.length} pedido(s)
                      </span>
                    </div>

                    {expandedClients[clientName] && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-primary)' }}>
                        {clientOrders.map(order => (
                          <div key={order.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div 
                              onClick={() => toggleOrder(order.id!)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: order.status === 'EN_PRODUCCION' ? '#fffbeb' : 'var(--bg-secondary)', cursor: 'pointer', borderLeft: order.status === 'EN_PRODUCCION' ? '4px solid #d97706' : '4px solid #94a3b8' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {expandedOrders[order.id!] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600 }}>Pedido {order.id?.slice(-6) || 'N/A'}</span>
                                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: order.status === 'EN_PRODUCCION' ? '#fef3c7' : '#e2e8f0', color: order.status === 'EN_PRODUCCION' ? '#b45309' : '#475569' }}>
                                      {order.status === 'EN_PRODUCCION' ? 'En Preparación' : 'Pendiente'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> 
                                    {new Date(order.date).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                {order.status === 'PENDIENTE' ? (
                                  <button onClick={() => handleTransitionStatus(order.id!, 'EN_PRODUCCION')} className="btn btn-secondary-light btn-sm"><Play size={14} /> Comenzar</button>
                                ) : (
                                  <button onClick={() => handleDeliverOrder(order)} className="btn btn-primary btn-sm" style={{ backgroundColor: '#059669', border: 'none' }}><CheckCircle size={14} /> Marcar como Producido</button>
                                )}
                              </div>
                            </div>

                            {expandedOrders[order.id!] && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                                {order.items.map((item, idx) => {
                                  const pres = presentaciones.find(p => p.id === item.productId);
                                  const recipe = pres ? recipes.find(r => r.productId === item.productId || r.id === pres.recipeId || r.id === pres.recetaId || (r.productId === pres.productoBaseId && r.customerId === pres.customerId)) : undefined;
                                  const rows = pres ? buildIngredientRows(item, pres, recipe, mercaderias) : [];
                                  return (
                                    <div key={idx} style={{ backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={14} color="var(--primary-color)" /> <span style={{ fontWeight: 600 }}>{item.productName}</span></div>
                                        {order.status === 'EN_PRODUCCION' ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pesos Reales por Paquete (Kg):</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                              {Array.from({ length: item.quantity }).map((_, pIdx) => {
                                                const weights = actualProduced[\`\${order.id}_\${item.productId}\`] || Array(item.quantity).fill(0);
                                                return (
                                                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>P{pIdx+1}</span>
                                                    <WeightInput 
                                                      value={weights[pIdx] || 0}
                                                      onChange={(num) => {
                                                        const newWeights = [...weights];
                                                        newWeights[pIdx] = num;
                                                        handleChangeProducedWeights(order.id!, item.productId, newWeights);
                                                      }}
                                                    />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '4px' }}>
                                              {item.quantity} paquetes
                                            </span>
                                            {order.status === 'PRODUCIDO' && (
                                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                Peso total: {(actualProduced[\`\${order.id}_\${item.productId}\`] || []).reduce((a, b) => a + b, 0).toFixed(3)} Kg
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.85rem' }}>
                                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {rows.map(row => {
                                              const stateKey = \`\${order.id}_\${item.productId}_\${row.productId}\`;
                                              const saved = order.actualConsumptions?.[stateKey] || actualConsumptions[stateKey];
                                              return (
                                                <IngredientInput
                                                  key={row.productId} orderId={order.id!} itemId={item.productId} productId={row.productId} name={row.name}
                                                  theoreticalQty={row.theoreticalQty} unit={row.unit} currentValue={saved?.value ?? row.theoreticalQty} currentUnit={(saved?.unit as ConsumptionUnit) ?? row.unit}
                                                  isEditable={order.status === 'EN_PRODUCCION'} onChangeValue={handleChangeValue} onChangeUnit={handleChangeUnit}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </div>
        )}`;

content = content.replace(
    /        \{activeTab === 'pedidos' && \([\s\S]*?\)\}\n      <\/div>\n    <\/>\n  \);\n\};\nexport default Produccion;/m,
    accordion_pedidos + '\n      </div>\n    </>\n  );\n};\nexport default Produccion;'
);

fs.writeFileSync('src/pages/Produccion.tsx', content, 'utf-8');
