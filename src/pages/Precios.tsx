import React, { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { 
  ArrowLeft, Save, Tags, Percent, CheckCircle2, XCircle, FileText, Download, Table as TableIcon, Loader2, Plus, Trash2
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useProducts } from '../hooks/useProducts';
import { usePriceLists, type PriceList } from '../hooks/usePriceLists';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Precios = () => {
  const { products, loading: loadingProducts, error: errorProducts } = useProducts();
  const { priceLists, loading: loadingLists, error: errorLists, savePriceList, deletePriceList, seedPriceLists } = usePriceLists();
  
  const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  
  // Edit Mode States
  const [listNameInput, setListNameInput] = useState('');
  const [listTargetInput, setListTargetInput] = useState('');
  const [listActiveInput, setListActiveInput] = useState(true);
  const [generalMarginStr, setGeneralMarginStr] = useState('30');
  const [priceItems, setPriceItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const globalError = errorProducts || errorLists;

  // When selected list or products change, set up the price items
  useEffect(() => {
    if (selectedList && products.length > 0) {
      setListNameInput(selectedList.name);
      setListTargetInput(selectedList.target);
      setListActiveInput(selectedList.isActive);
      setGeneralMarginStr(selectedList.margin.toString());
      
      const items = products.map(p => {
        // Calculate standard packet cost
        const kgNetos = p.pesoHorma * (1 - (p.mermaEstimada || 0) / 100);
        const paqEst = p.gramajeVenta > 0 ? Math.floor((kgNetos * 1000) / p.gramajeVenta) : 0;
        const cMat = paqEst > 0 ? p.costoHorma / paqEst : 0;
        const cTot = paqEst > 0 ? cMat + p.costoBolsa + p.costoEtiqueta + p.manoObra : 0;

        const overrideMargin = selectedList.productOverrides?.[p.id!]?.margin ?? selectedList.margin;

        return {
          id: p.id!,
          name: p.name,
          brand: p.brand || 'Al Vacío',
          gramajeVenta: p.gramajeVenta,
          active: p.isActive,
          cost: cTot,
          marginStr: overrideMargin.toString()
        };
      });
      setPriceItems(items);
    }
  }, [selectedList, products]);

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  const handleCreateNewList = () => {
    setSelectedList({
      name: 'Nueva Lista de Precios',
      target: 'Consumidores Especiales',
      margin: 30,
      isActive: true,
      productOverrides: {},
      createdAt: 0,
      updatedAt: 0
    });
    setListNameInput('Nueva Lista de Precios');
    setListTargetInput('Consumidores Especiales');
    setGeneralMarginStr('30');
    setListActiveInput(true);
    setViewMode('edit');
  };

  // When general margin changes, update all active products
  const handleGeneralMarginChange = (val: string) => {
    setGeneralMarginStr(val);
    setPriceItems(priceItems.map(item => item.active ? { ...item, marginStr: val } : item));
  };

  const updateItemMargin = (id: string, val: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, marginStr: val } : item));
  };

  const handleSavePrices = async () => {
    if (!selectedList) return;
    setIsSaving(true);
    try {
      const overrides: Record<string, { margin: number }> = {};
      priceItems.forEach(item => {
        if (item.active && item.marginStr !== generalMarginStr) {
          overrides[item.id] = { margin: parseNumber(item.marginStr) };
        }
      });

      const updatedList = {
        name: listNameInput,
        target: listTargetInput,
        margin: parseNumber(generalMarginStr),
        isActive: listActiveInput,
        productOverrides: overrides
      };

      await savePriceList(updatedList, selectedList.id);
      setViewMode('list');
      setSelectedList(null);
    } catch (e) {
      console.error(e);
      alert("Error al guardar la lista de precios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar esta lista de precios?")) {
      try {
        await deletePriceList(id);
      } catch (e) {
        alert("Error al eliminar la lista de precios");
      }
    }
  };

  const getCurrentOverrides = () => {
    const overrides: Record<string, { margin: number }> = {};
    priceItems.forEach(item => {
      if (item.active && item.marginStr !== generalMarginStr) {
        overrides[item.id] = { margin: parseNumber(item.marginStr) };
      }
    });
    return overrides;
  };

  // Helper: Get computed product prices for a list
  const getListProducts = (margin: number, overrides?: any) => {
    return products.map(p => {
      const pPeso = parseNumber(p.pesoHorma);
      const pMerma = parseNumber(p.mermaEstimada);
      const pGramaje = parseNumber(p.gramajeVenta);
      const pCostoHorma = parseNumber(p.costoHorma);
      const pCostoBolsa = parseNumber(p.costoBolsa);
      const pCostoEtiqueta = parseNumber(p.costoEtiqueta);
      const pManoObra = parseNumber(p.manoObra);

      const kgNetos = pPeso * (1 - (pMerma || 0) / 100);
      const paqEst = pGramaje > 0 ? Math.floor((kgNetos * 1000) / pGramaje) : 0;
      const cMat = paqEst > 0 ? pCostoHorma / paqEst : 0;
      const cTot = paqEst > 0 ? cMat + pCostoBolsa + pCostoEtiqueta + pManoObra : 0;
      
      const itemMargin = overrides?.[p.id!]?.margin ?? margin;
      
      return {
        name: p.name || 'Sin nombre',
        brand: p.brand || 'Al Vacío',
        gramajeVenta: pGramaje,
        cost: cTot,
        margin: itemMargin,
        price: cTot * (1 + itemMargin / 100),
        isActive: p.isActive
      };
    }).filter(p => p.isActive);
  };

  // Export: PDF
  const exportPDF = async (listName: string, margin: number, overrides?: any) => {
    const img = new Image();
    img.src = '/logo_circular.png';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; 
    });

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const activeProducts = getListProducts(margin, overrides);
    
    doc.setFillColor(230, 57, 70);
    doc.rect(0, 0, 210, 38, 'F');

    try {
      doc.addImage(img, 'PNG', 15, 4, 30, 30);
    } catch (e) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.6);
      doc.circle(30, 19, 12, 'S');
      doc.setFillColor(255, 255, 255);
      doc.rect(27, 16, 6, 6, 'F');
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('Al Vacío', 50, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('ALIMENTOS ENVASADOS • DISTRIBUCIÓN', 50, 26);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(listName.toUpperCase(), 195, 16, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 195, 22, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTADO DE PRECIOS VIGENTES', 15, 48);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 51, 195, 51);

    const tableRows = activeProducts.map(p => [
      p.name,
      p.brand,
      `${p.gramajeVenta}g`,
      formatCurrency(p.price)
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['Producto', 'Marca', 'Presentación', 'Precio Venta']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [33, 37, 41], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Al Vacío • Alimentos Envasados | Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
    }

    doc.save(`lista-precios-${listName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  // Export: Excel (CSV with UTF-8 BOM)
  const exportExcel = (listName: string, margin: number, overrides?: any) => {
    const activeProducts = getListProducts(margin, overrides);
    
    const headers = ['Producto', 'Marca', 'Gramaje', 'Costo Base ($)', 'Margen (%)', 'Precio Final ($)'];
    const rows = activeProducts.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.brand.replace(/"/g, '""')}"`,
      `"${p.gramajeVenta}g"`,
      p.cost.toFixed(2),
      `${p.margin}%`,
      p.price.toFixed(2)
    ]);

    const csvContent = "\uFEFF" 
      + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lista-precios-${listName.toLowerCase().replace(/\s+/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (viewMode === 'edit' && selectedList) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => { setViewMode('list'); setSelectedList(null); }}
              className="btn btn-icon"
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{listNameInput || 'Nueva Lista'}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Configuración de precios y márgenes comerciales</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportPDF(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides())} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={18} /> Exportar PDF
            </button>
            <button onClick={() => exportExcel(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides())} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <TableIcon size={18} /> Exportar Excel
            </button>
            <button onClick={handleSavePrices} disabled={isSaving} className="btn btn-primary">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Nombre de la Lista</div>
              <input 
                type="text" 
                value={listNameInput} 
                onChange={e => setListNameInput(e.target.value)}
                className="form-input" 
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Segmento / Destino</div>
              <input 
                type="text" 
                value={listTargetInput} 
                onChange={e => setListTargetInput(e.target.value)}
                className="form-input" 
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Margen General (%)</div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Percent size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px' }} />
                <input 
                  type="number" 
                  value={generalMarginStr} 
                  onChange={e => handleGeneralMarginChange(e.target.value)} 
                  className="form-input" 
                  style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Estado</div>
              <select
                value={listActiveInput ? 'active' : 'inactive'}
                onChange={e => setListActiveInput(e.target.value === 'active')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
            </div>
          </div>
        </Card>

        <Card padding="none">
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Ajuste Individual por Producto</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Producto</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Estado</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Costo Base</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ajuste %</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precio Final (Auto)</th>
              </tr>
            </thead>
            <tbody>
              {priceItems.map((item) => {
                const margin = parseNumber(item.marginStr);
                const finalPrice = item.active ? item.cost * (1 + margin / 100) : 0;
                
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: item.active ? '#fff' : 'var(--bg-primary)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: item.active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.brand}</div>
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
                        disabled={!item.active} 
                        value={item.marginStr} 
                        onChange={e => updateItemMargin(item.id, e.target.value)} 
                        className="form-input"
                        style={{ width: '80px', margin: '0 0 0 auto', textAlign: 'right', padding: '6px 8px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} 
                      />
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: item.active ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                      {item.active ? formatCurrency(finalPrice) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Listas de Precios" description="Administración y exportación de listas de precios comerciales por segmento" />
        <div style={{ display: 'flex', gap: '12px' }}>
          {priceLists.length === 0 && !loadingLists && (
            <button onClick={seedPriceLists} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tags size={18} /> Inicializar Listas por Defecto
            </button>
          )}
          <button onClick={handleCreateNewList} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Nueva Lista
          </button>
        </div>
      </div>

      {loadingLists || loadingProducts ? (
        <LoadingSpinner message="Cargando catálogos de precios..." />
      ) : priceLists.length === 0 ? (
        <Card padding="lg">
          <EmptyState 
            icon={Tags} 
            title="No hay listas de precios" 
            description="Crea una nueva lista de precios o inicializa las listas predeterminadas." 
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {priceLists.map((list) => (
            <Card key={list.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '12px' }}>
                    <Tags size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{list.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{list.target}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span 
                    onClick={async (e) => {
                      e.stopPropagation();
                      await savePriceList({
                        name: list.name,
                        target: list.target,
                        margin: list.margin,
                        isActive: !list.isActive,
                        productOverrides: list.productOverrides || {}
                      }, list.id);
                    }}
                    style={{ 
                      padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      backgroundColor: list.isActive ? '#dcfce7' : '#fee2e2',
                      color: list.isActive ? '#166534' : '#991b1b',
                      cursor: 'pointer'
                    }}
                    title="Haga clic para cambiar estado"
                  >
                    {list.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                  <button 
                    onClick={() => handleDelete(list.id!)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                    title="Eliminar Lista"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MARGEN BASE</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-color)' }}>{list.margin}%</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SOBRE COSTOS</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', display: 'block' }}>Productos Activos</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    onClick={() => exportPDF(list.name, list.margin, list.productOverrides)}
                    className="btn btn-secondary" 
                    style={{ padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    title="Descargar Catálogo PDF comercial"
                  >
                    <FileText size={16} /> PDF
                  </button>
                  <button 
                    onClick={() => exportExcel(list.name, list.margin, list.productOverrides)}
                    className="btn btn-secondary" 
                    style={{ padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    title="Descargar Planilla Excel"
                  >
                    <Download size={16} /> Excel
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    setSelectedList(list);
                    setViewMode('edit');
                  }}
                  className="btn btn-primary-light"
                  style={{ width: '100%', padding: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  Editar Catálogo y Precios
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default Precios;
