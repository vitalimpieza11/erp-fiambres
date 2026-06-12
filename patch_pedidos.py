import re

with open('src/pages/Pedidos.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Icons
content = content.replace(
    "Truck, CheckCircle, Play, Eye, FileText, ShoppingCart\n} from 'lucide-react';",
    "Truck, CheckCircle, Play, Eye, FileText, ShoppingCart,\n  ChevronDown, ChevronRight\n} from 'lucide-react';"
)

# 2. State
state_injection = """  const [status, setStatus] = useState<any>('PENDIENTE');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; price: number; priceOrigin?: string }[]>([]);
  const [realProductionCostStr, setRealProductionCostStr] = useState<string>('');

  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const toggleClient = (client: string) => {
    setExpandedClients(prev => ({ ...prev, [client]: !prev[client] }));
  };

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const globalError = errorOrders;

  const filteredOrders = orders.filter(o => filterDate(o.date));

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const customer = order.customerName || 'Cliente Desconocido';
    if (!acc[customer]) acc[customer] = [];
    acc[customer].push(order);
    return acc;
  }, {} as Record<string, typeof filteredOrders>);"""

content = re.sub(
    r"  const \[status, setStatus\] = useState<any>\('PENDIENTE'\);\n  const \[orderItems, setOrderItems\] = useState<\{[^\}]+\}\[\]>\(\[\]\);\n\n  const globalError = errorOrders;\n\n  // Filtered orders by Date context\n  const filteredOrders = orders\.filter\(o => filterDate\(o\.date\)\);",
    state_injection,
    content,
    flags=re.MULTILINE
)

# 3. openForm
content = content.replace(
    "setOrderItems(order.items.map((i: any) => ({\n        productId: i.productId,\n        quantity: i.quantity,\n        price: i.price,\n        priceOrigin: i.priceOrigin || 'Precio Base'\n      })));\n    } else {\n      setEditingId(null);\n      setCustomerId('');\n      setDiscountStr('0');\n      setObservaciones('');\n      setStatus('PENDIENTE');\n      setOrderItems([{ productId: '', quantity: 1, price: 0, priceOrigin: '' }]);\n    }",
    "setOrderItems(order.items.map((i: any) => ({\n        productId: i.productId,\n        quantity: i.quantity,\n        price: i.price,\n        priceOrigin: i.priceOrigin || 'Precio Base'\n      })));\n      setRealProductionCostStr(order.realProductionCost ? order.realProductionCost.toString() : '');\n    } else {\n      setEditingId(null);\n      setCustomerId('');\n      setDiscountStr('0');\n      setObservaciones('');\n      setStatus('PENDIENTE');\n      setOrderItems([{ productId: '', quantity: 1, price: 0, priceOrigin: '' }]);\n      setRealProductionCostStr('');\n    }"
)

# 4. resetFormStates
content = content.replace(
    "setOrderItems([]);\n  };",
    "setOrderItems([]);\n    setRealProductionCostStr('');\n  };"
)

# 5. handleSave payload
content = content.replace(
    "observations: observaciones,\n      date: Date.now()",
    "observations: observaciones,\n      realProductionCost: parseNumber(realProductionCostStr) || undefined,\n      date: Date.now()"
)

# 6. intention card
intention_injection = """                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Costo Est. de Producción</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(totalProdCost)}</span>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <Input 
                    label="Costo Real (Opcional)"
                    type="number"
                    value={realProductionCostStr}
                    onChange={e => setRealProductionCostStr(e.target.value)}
                    placeholder="Reemplaza costo calculado"
                  />
                </div>"""
content = content.replace(
    """                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Costo Est. de Producción</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(totalProdCost)}</span>
                </div>""",
    intention_injection
)

# 7. Render Accordion
table_code_start = "          <Table"
table_code_end = "          />"

accordion_code = """          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
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
                  <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {clientOrders.map(order => {
                      const colors: any = {
                        PENDIENTE: { bg: '#e2e8f0', text: '#475569', label: 'Pendiente' },
                        EN_PRODUCCION: { bg: '#fef3c7', text: '#d97706', label: 'En Producción' },
                        PRODUCIDO: { bg: '#dcfce7', text: '#15803d', label: 'Producido' },
                        ENTREGADO: { bg: '#cffafe', text: '#0891b2', label: 'Entregado' },
                        FACTURADO: { bg: '#e0e7ff', text: '#4f46e5', label: 'Facturado' },
                        CERRADO: { bg: '#f3f4f6', text: '#9ca3af', label: 'Cerrado' }
                      };
                      const color = colors[order.status] || colors['PENDIENTE'];

                      return (
                      <div key={order.id} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div 
                          onClick={() => toggleOrder(order.id!)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'var(--bg-primary)', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {expandedOrders[order.id!] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span style={{ fontWeight: 600 }}>Pedido {order.id?.slice(-6) || 'N/A'}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {new Date(order.date).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: color.bg, color: color.text }}>
                              {color.label}
                            </span>
                            
                            <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => setSelectedOrderForView(order)} className="btn btn-icon" title="Ver Detalles" style={{ color: 'var(--primary-color)' }}>
                                <Eye size={16} />
                              </button>
                              {order.status === 'PENDIENTE' && (
                                <button onClick={() => handleTransitionStatus(order.id!, 'EN_PRODUCCION')} className="btn btn-secondary-light btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                                  <Play size={12} /> A Producción
                                </button>
                              )}
                              {(order.status === 'PRODUCIDO' || order.status === 'EN_PRODUCCION') && (
                                <button onClick={() => handleTransitionStatus(order.id!, 'ENTREGADO')} className="btn btn-success-light btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: '#cffafe', color: '#0891b2', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                  <Truck size={12} /> Entregar
                                </button>
                              )}
                              {['PENDIENTE', 'EN_PRODUCCION'].includes(order.status) && (
                                <button onClick={() => openForm(order)} className="btn btn-icon" title="Editar">
                                  <Edit2 size={16} color="#2563eb" />
                                </button>
                              )}
                              <button onClick={() => handleDelete(order.id!)} className="btn btn-icon" title="Eliminar">
                                <Trash2 size={16} color="#dc2626" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {expandedOrders[order.id!] && (
                          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {order.items.map((item: any, idx: number) => (
                                <li key={idx}>
                                  {item.quantity}x {item.productName}
                                </li>
                              ))}
                            </ul>
                            <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <strong>Costo Est. Prod:</strong> {formatCurrency(order.productionCost || 0)}
                              {order.realProductionCost !== undefined && (
                                <span style={{ marginLeft: '12px', color: '#ef4444' }}>
                                  <strong>Costo Real:</strong> {formatCurrency(order.realProductionCost)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            ))}
          </div>"""

# Replace table block with accordion block
content = re.sub(r"          <Table[\s\S]*?/>\n        \)}", accordion_code + "\n        )}", content)

with open('src/pages/Pedidos.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
