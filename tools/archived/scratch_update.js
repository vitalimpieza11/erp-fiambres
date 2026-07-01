const fs = require('fs');

let content = fs.readFileSync('src/pages/Precios.tsx', 'utf-8');

// Replace states
content = content.replace(
  "  const [generalMarginStr, setGeneralMarginStr] = useState('30');",
  "  const [generalMarginStr, setGeneralMarginStr] = useState('30');\n" +
  "  const [listTypeInput, setListTypeInput] = useState<'presentaciones' | 'mercaderias'>('presentaciones');\n" +
  "  const [listModeInput, setListModeInput] = useState<'auto' | 'manual'>('auto');"
);

const old_use_effect = `  // When selected list or presentaciones change, set up the price items from presentaciones only
  useEffect(() => {
    if (selectedList && presentaciones.length > 0) {
      setListNameInput(selectedList.name);
      setListTargetInput(selectedList.target);
      setListActiveInput(selectedList.isActive);
      setGeneralMarginStr(selectedList.margin.toString());
      
      const items = presentaciones
        .filter(p => p.isActive)
        .map(p => {
          const cTot = calculatePresentationCost(p, mercaderias, insumos, recipes);

          const overrideMargin = selectedList.productOverrides?.[p.id!]?.margin ?? selectedList.margin;
          const isExcluded = selectedList.productOverrides?.[p.id!]?.excluded ?? false;

          return {
            id: p.id!,
            name: p.name,
            brand: p.customerName || 'Al Vacío',
            gramajeVenta: p.pesoObjetivoGramos,
            active: p.isActive,
            excluded: isExcluded,
            cost: cTot,
            marginStr: overrideMargin.toString()
          };
        });
      setPriceItems(items);
    }
  }, [selectedList, presentaciones, mercaderias, insumos, recipes]);`;

const new_use_effect = `  // Build items function
  const buildItems = (type: 'presentaciones' | 'mercaderias', mode: 'auto' | 'manual', baseMargin: number, overrides: any) => {
    if (type === 'presentaciones') {
      return presentaciones.filter(p => p.isActive).map(p => {
        const cTot = calculatePresentationCost(p, mercaderias, insumos, recipes);
        const overrideMargin = overrides?.[p.id!]?.margin ?? baseMargin;
        const isExcluded = overrides?.[p.id!]?.excluded ?? false;
        const itemMode = overrides?.[p.id!]?.mode ?? mode;
        const manualPrice = overrides?.[p.id!]?.manualPrice ?? (cTot * (1 + overrideMargin / 100));

        return {
          id: p.id!, name: p.name, brand: p.customerName || 'Al Vacío', gramajeVenta: p.pesoObjetivoGramos,
          active: p.isActive, excluded: isExcluded, cost: cTot, marginStr: overrideMargin.toString(),
          mode: itemMode, manualPriceStr: manualPrice.toString()
        };
      });
    } else {
      return mercaderias.filter(m => m.isActive).map(m => {
        const cTot = m.costoKg || 0;
        const overrideMargin = overrides?.[m.id!]?.margin ?? baseMargin;
        const isExcluded = overrides?.[m.id!]?.excluded ?? false;
        const itemMode = overrides?.[m.id!]?.mode ?? mode;
        const manualPrice = overrides?.[m.id!]?.manualPrice ?? (cTot * (1 + overrideMargin / 100));

        return {
          id: m.id!, name: m.name, brand: 'Mercadería', gramajeVenta: 1000,
          active: m.isActive, excluded: isExcluded, cost: cTot, marginStr: overrideMargin.toString(),
          mode: itemMode, manualPriceStr: manualPrice.toString()
        };
      });
    }
  };

  useEffect(() => {
    if (selectedList) {
      setListNameInput(selectedList.name);
      setListTargetInput(selectedList.target);
      setListActiveInput(selectedList.isActive);
      setGeneralMarginStr(selectedList.margin.toString());
      const initialType = selectedList.type || 'presentaciones';
      const initialMode = selectedList.mode || 'auto';
      setListTypeInput(initialType);
      setListModeInput(initialMode);
      setPriceItems(buildItems(initialType, initialMode, selectedList.margin, selectedList.productOverrides));
    }
  }, [selectedList, presentaciones, mercaderias, insumos, recipes]);`;

content = content.replace(old_use_effect, new_use_effect);

const old_create = `      isActive: true,
      productOverrides: {},
      createdAt: 0,
      updatedAt: 0
    });
    setListNameInput('Nueva Lista de Precios');
    setListTargetInput('Consumidores Especiales');
    setGeneralMarginStr('30');
    setListActiveInput(true);
    setViewMode('edit');`;

const new_create = `      type: 'presentaciones',
      mode: 'auto',
      isActive: true,
      productOverrides: {},
      createdAt: 0,
      updatedAt: 0
    });
    setListNameInput('Nueva Lista de Precios');
    setListTargetInput('Consumidores Especiales');
    setGeneralMarginStr('30');
    setListActiveInput(true);
    setListTypeInput('presentaciones');
    setListModeInput('auto');
    setViewMode('edit');`;

content = content.replace(old_create, new_create);

const old_handlers = `  const toggleItemExclusion = (id: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, excluded: !item.excluded } : item));
  };`;

const new_handlers = `  const toggleItemExclusion = (id: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, excluded: !item.excluded } : item));
  };

  const updateItemMode = (id: string, mode: 'auto' | 'manual') => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, mode } : item));
  };

  const updateItemManualPrice = (id: string, priceStr: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, manualPriceStr: priceStr } : item));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'presentaciones' | 'mercaderias';
    setListTypeInput(newType);
    setPriceItems(buildItems(newType, listModeInput, parseNumber(generalMarginStr), selectedList?.productOverrides));
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as 'auto' | 'manual';
    setListModeInput(newMode);
    setPriceItems(buildItems(listTypeInput, newMode, parseNumber(generalMarginStr), selectedList?.productOverrides));
  };`;

content = content.replace(old_handlers, new_handlers);

const old_save = `        if (item.marginStr !== generalMarginStr || item.excluded) {
          overrides[item.id] = {
            margin: parseNumber(item.marginStr),
            ...(item.excluded ? { excluded: true } : {})
          };
        }`;

const new_save = `        if (item.marginStr !== generalMarginStr || item.excluded || item.mode !== listModeInput || item.mode === 'manual') {
          overrides[item.id] = {
            margin: parseNumber(item.marginStr),
            ...(item.excluded ? { excluded: true } : {}),
            mode: item.mode,
            manualPrice: parseNumber(item.manualPriceStr)
          };
        }`;
content = content.replace(old_save, new_save);

const old_updatedList = `      const updatedList = {
        name: listNameInput,
        target: listTargetInput,
        margin: parseNumber(generalMarginStr),
        isActive: listActiveInput,
        productOverrides: overrides
      };`;

const new_updatedList = `      const updatedList = {
        name: listNameInput,
        target: listTargetInput,
        type: listTypeInput,
        mode: listModeInput,
        margin: parseNumber(generalMarginStr),
        isActive: listActiveInput,
        productOverrides: overrides
      };`;
content = content.replace(old_updatedList, new_updatedList);

const old_getCur = `      if (item.marginStr !== generalMarginStr || item.excluded) {
        overrides[item.id] = {
          margin: parseNumber(item.marginStr),
          ...(item.excluded ? { excluded: true } : {})
        };
      }`;
const new_getCur = `      if (item.marginStr !== generalMarginStr || item.excluded || item.mode !== listModeInput || item.mode === 'manual') {
        overrides[item.id] = {
          margin: parseNumber(item.marginStr),
          ...(item.excluded ? { excluded: true } : {}),
          mode: item.mode,
          manualPrice: parseNumber(item.manualPriceStr)
        };
      }`;
content = content.replace(old_getCur, new_getCur);

const old_getListProducts = `  const getListProducts = (margin: number, overrides?: any) => {
    return presentaciones
      .filter(p => p.isActive)
      .map(p => {
        const cTot = calculatePresentationCost(p, mercaderias, insumos, recipes);
        
        const itemMargin = overrides?.[p.id!]?.margin ?? margin;
        const isExcluded = overrides?.[p.id!]?.excluded ?? false;
        
        return {
          name: p.name || 'Sin nombre',
          brand: p.customerName || 'Al Vacío',
          gramajeVenta: p.pesoObjetivoGramos,
          cost: cTot,
          margin: itemMargin,
          price: cTot * (1 + itemMargin / 100),
          isActive: p.isActive && !isExcluded
        };
      }).filter(p => p.isActive);
  };`;

const new_getListProducts = `  const getListProducts = (margin: number, overrides?: any, listType?: 'presentaciones' | 'mercaderias', listMode?: 'auto' | 'manual') => {
    const type = listType || 'presentaciones';
    const mode = listMode || 'auto';
    
    if (type === 'presentaciones') {
      return presentaciones.filter(p => p.isActive).map(p => {
        const cTot = calculatePresentationCost(p, mercaderias, insumos, recipes);
        const overrideMargin = overrides?.[p.id!]?.margin ?? margin;
        const isExcluded = overrides?.[p.id!]?.excluded ?? false;
        const itemMode = overrides?.[p.id!]?.mode ?? mode;
        const manualPrice = overrides?.[p.id!]?.manualPrice ?? (cTot * (1 + overrideMargin / 100));
        
        const finalPrice = itemMode === 'manual' ? manualPrice : cTot * (1 + overrideMargin / 100);
        const realMargin = cTot > 0 ? ((finalPrice / cTot) - 1) * 100 : 0;

        return {
          name: p.name || 'Sin nombre',
          brand: p.customerName || 'Al Vacío',
          gramajeVenta: p.pesoObjetivoGramos,
          cost: cTot,
          margin: realMargin, // Report real margin
          price: finalPrice,
          isActive: p.isActive && !isExcluded
        };
      }).filter(p => p.isActive);
    } else {
      return mercaderias.filter(m => m.isActive).map(m => {
        const cTot = m.costoKg || 0;
        const overrideMargin = overrides?.[m.id!]?.margin ?? margin;
        const isExcluded = overrides?.[m.id!]?.excluded ?? false;
        const itemMode = overrides?.[m.id!]?.mode ?? mode;
        const manualPrice = overrides?.[m.id!]?.manualPrice ?? (cTot * (1 + overrideMargin / 100));
        
        const finalPrice = itemMode === 'manual' ? manualPrice : cTot * (1 + overrideMargin / 100);
        const realMargin = cTot > 0 ? ((finalPrice / cTot) - 1) * 100 : 0;

        return {
          name: m.name,
          brand: 'Mercadería',
          gramajeVenta: 1000,
          cost: cTot,
          margin: realMargin,
          price: finalPrice,
          isActive: m.isActive && !isExcluded
        };
      }).filter(m => m.isActive);
    }
  };`;

content = content.replace(old_getListProducts, new_getListProducts);

content = content.replace(
  "exportPDF(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides())",
  "exportPDF(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides(), listTypeInput, listModeInput)"
);
content = content.replace(
  "exportExcel(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides())",
  "exportExcel(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides(), listTypeInput, listModeInput)"
);

content = content.replace(
  "exportPDF = async (listName: string, margin: number, overrides?: any)",
  "exportPDF = async (listName: string, margin: number, overrides?: any, listType?: 'presentaciones' | 'mercaderias', listMode?: 'auto' | 'manual')"
);
content = content.replace(
  "exportExcel = (listName: string, margin: number, overrides?: any)",
  "exportExcel = (listName: string, margin: number, overrides?: any, listType?: 'presentaciones' | 'mercaderias', listMode?: 'auto' | 'manual')"
);
content = content.replace(
  "const activeProducts = getListProducts(margin, overrides);",
  "const activeProducts = getListProducts(margin, overrides, listType, listMode);"
);

content = content.replace(
  "exportPDF(list.name, list.margin, list.productOverrides)",
  "exportPDF(list.name, list.margin, list.productOverrides, list.type, list.mode)"
);
content = content.replace(
  "exportExcel(list.name, list.margin, list.productOverrides)",
  "exportExcel(list.name, list.margin, list.productOverrides, list.type, list.mode)"
);

const old_form = \`        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>\`;
const new_form = \`        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>\`;
content = content.replace(old_form, new_form);

const old_estado = \`            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Estado</div>\`;
const new_estado = \`            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo de Lista</div>
              <select value={listTypeInput} onChange={handleTypeChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="presentaciones">Presentaciones</option>
                <option value="mercaderias">Productos Base (Mercaderías)</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Modo de Precio</div>
              <select value={listModeInput} onChange={handleModeChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="auto">Automático por Margen</option>
                <option value="manual">Manual</option>
              </select>
            </div>
\` + old_estado;
content = content.replace(old_estado, new_estado);

const old_thead = \`                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Producto</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Incluido en Lista</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Estado Global</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Costo Base</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ajuste %</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precio Final (Auto)</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acciones</th>\`;
const new_thead = \`                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{listTypeInput === 'presentaciones' ? 'Producto' : 'Mercadería'}</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Incluido</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{listTypeInput === 'presentaciones' ? 'Costo Base' : 'Costo x Kg'}</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modo</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen / Precio</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen Real</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precio Final</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acciones</th>\`;
content = content.replace(old_thead, new_thead);

const old_tbody = \`              {priceItems.map((item) => {
                const margin = parseNumber(item.marginStr);
                const finalPrice = item.active && !item.excluded ? item.cost * (1 + margin / 100) : 0;
                
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: item.active && !item.excluded ? '#fff' : 'var(--bg-primary)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: item.active && !item.excluded ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.brand}</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={!item.excluded} 
                        onChange={() => toggleItemExclusion(item.id)}
                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {item.active ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#166534', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '9999px' }}>
                          <CheckCircle2 size={14} /> Activo
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#991b1b', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '9999px' }}>
                          <XCircle size={14} /> Inactivo
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500 }}>{formatCurrency(item.cost)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <input 
                        type="number" 
                        disabled={item.excluded} 
                        value={item.marginStr} 
                        onChange={e => updateItemMargin(item.id, e.target.value)} 
                        className="form-input"
                        style={{ width: '80px', margin: '0 0 0 auto', textAlign: 'right', padding: '6px 8px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} 
                      />
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: item.active && !item.excluded ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                      {item.active && !item.excluded ? formatCurrency(finalPrice) : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button 
                        onClick={() => {
                          const pres = presentaciones.find(p => p.id === item.id);
                          if (pres) {
                            setEditingPresentation(pres);
                          } else {
                            alert("No se encontró la presentación para editar.");
                          }
                        }}
                        className="btn btn-icon btn-sm"
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Editar presentación en base de datos"
                      >
                        <Edit size={14} /> Editar
                      </button>
                    </td>
                  </tr>
                );
              })}\`;

const new_tbody = \`              {priceItems.map((item) => {
                const margin = parseNumber(item.marginStr);
                const manualPriceNum = parseNumber(item.manualPriceStr);
                
                const isManual = item.mode === 'manual';
                const finalPrice = isManual ? manualPriceNum : (item.cost * (1 + margin / 100));
                const realMargin = item.cost > 0 ? ((finalPrice / item.cost) - 1) * 100 : 0;
                
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: item.active && !item.excluded ? '#fff' : 'var(--bg-primary)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: item.active && !item.excluded ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.brand}</div>
                      {!item.active && (
                        <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px' }}>Inactivo en sistema</div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={!item.excluded} 
                        onChange={() => toggleItemExclusion(item.id)}
                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500 }}>{formatCurrency(item.cost)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <select 
                        disabled={item.excluded}
                        value={item.mode}
                        onChange={e => updateItemMode(item.id, e.target.value as 'auto' | 'manual')}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', fontSize: '0.75rem' }}
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {!isManual ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <input 
                            type="number" 
                            disabled={item.excluded} 
                            value={item.marginStr} 
                            onChange={e => updateItemMargin(item.id, e.target.value)} 
                            className="form-input"
                            style={{ width: '70px', textAlign: 'right', padding: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} 
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>%</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>$</span>
                          <input 
                            type="number" 
                            disabled={item.excluded} 
                            value={item.manualPriceStr} 
                            onChange={e => updateItemManualPrice(item.id, e.target.value)} 
                            className="form-input"
                            style={{ width: '90px', textAlign: 'right', padding: '6px', backgroundColor: '#fef3c7', color: 'var(--text-primary)', border: '1px solid #fcd34d', borderRadius: '8px', fontWeight: 600 }} 
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: realMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                      {item.active && !item.excluded ? \`\${realMargin.toFixed(2)}%\` : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: item.active && !item.excluded ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                      {item.active && !item.excluded ? formatCurrency(finalPrice) : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {listTypeInput === 'presentaciones' && (
                        <button 
                          onClick={() => {
                            const pres = presentaciones.find(p => p.id === item.id);
                            if (pres) {
                              setEditingPresentation(pres);
                            } else {
                              alert("No se encontró la presentación para editar.");
                            }
                          }}
                          className="btn btn-icon btn-sm"
                          style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Editar presentación en base de datos"
                        >
                          <Edit size={14} /> Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}\`;
content = content.replace(old_tbody, new_tbody);

fs.writeFileSync('src/pages/Precios.tsx', content, 'utf-8');
console.log('Update finished.');
