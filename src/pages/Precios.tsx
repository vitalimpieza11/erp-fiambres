import React, { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { 
  ArrowLeft, Save, Tags, Percent, CheckCircle2, XCircle, FileText, Download, Table as TableIcon, Loader2, Plus, Trash2
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { usePriceLists, type PriceList } from '../hooks/usePriceLists';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { useRecipes } from '../hooks/useRecipes';
import { calculatePresentationCost } from '../core/calculations';
import { useSettings } from '../hooks/useSettings';
import { Edit } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Precios = () => {
  // Solo Presentaciones son la entidad de venta
  const { priceLists, loading: loadingLists, error: errorLists, savePriceList, deletePriceList } = usePriceLists();
  
  const { presentaciones, savePresentacion, loading: loadingPres, error: errorPres } = usePresentaciones();
  const { mercaderias, loading: loadingMerc, error: errorMerc } = useMercaderias();
  const { insumos, loading: loadingIns, error: errorIns } = useInsumos();
  const { recipes, loading: loadingRec, error: errorRec } = useRecipes();
  const { settings } = useSettings();

  const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  
  // Edit Mode States
  const [listNameInput, setListNameInput] = useState('');
  const [listTargetInput, setListTargetInput] = useState('');
  const [listActiveInput, setListActiveInput] = useState(true);
  const [generalMarginStr, setGeneralMarginStr] = useState('30');
  const [includedTypes, setIncludedTypes] = useState<string[]>(['presentacion']);
  const [listModeInput, setListModeInput] = useState<'auto' | 'manual'>('auto');
  const [priceItems, setPriceItems] = useState<any[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simulatorIncreasePct, setSimulatorIncreasePct] = useState(0);
  const [editingPresentation, setEditingPresentation] = useState<any | null>(null);

  const globalError = errorLists || errorPres || errorMerc || errorIns || errorRec;

  // Build items function
  const buildItems = (types: string[], mode: 'auto' | 'manual', baseMargin: number, overrides: any) => {
    let items: any[] = [];
    
    if (types.includes('presentacion')) {
      const presItems = presentaciones.filter(p => p.isActive).map(p => {
        const cTot = calculatePresentationCost(p, mercaderias, insumos, recipes);
        const overrideMargin = overrides?.[p.id!]?.margin ?? baseMargin;
        const isExcluded = overrides?.[p.id!]?.excluded ?? false;
        const itemMode = overrides?.[p.id!]?.mode ?? mode;
        const autoPrice = overrideMargin >= 100 ? cTot * 2 : (cTot / (1 - overrideMargin / 100));
        const manualPrice = overrides?.[p.id!]?.manualPrice ?? autoPrice;

        return {
          id: p.id!, name: p.name, brand: p.customerName || 'Al Vacío', gramajeVenta: p.pesoObjetivoGramos,
          active: p.isActive, excluded: isExcluded, cost: cTot, marginStr: overrideMargin.toString(),
          mode: itemMode, manualPriceStr: manualPrice.toString(),
          itemType: 'presentacion', unit: 'Unidad',
          unidadesPorCaja: p.unidadesPorCaja || 1, commercialStatus: p.commercialStatus || 'activo'
        };
      });
      items = [...items, ...presItems];
    }
    
    if (types.includes('mercaderia')) {
      const mercItems = mercaderias.filter(m => m.isActive).map(m => {
        const cTot = m.costoKg || 0;
        const overrideMargin = overrides?.[m.id!]?.margin ?? baseMargin;
        const isExcluded = overrides?.[m.id!]?.excluded ?? false;
        const itemMode = overrides?.[m.id!]?.mode ?? mode;
        const autoPrice = overrideMargin >= 100 ? cTot * 2 : (cTot / (1 - overrideMargin / 100));
        const manualPrice = overrides?.[m.id!]?.manualPrice ?? autoPrice;

        return {
          id: m.id!, name: m.name, brand: 'Mercadería', gramajeVenta: 1000,
          active: m.isActive, excluded: isExcluded, cost: cTot, marginStr: overrideMargin.toString(),
          mode: itemMode, manualPriceStr: manualPrice.toString(),
          itemType: 'mercaderia', unit: 'Kg',
          unidadesPorCaja: 1, commercialStatus: 'activo'
        };
      });
      items = [...items, ...mercItems];
    }
    return items;
  };
  useEffect(() => {
    if (selectedList) {
      setListNameInput(selectedList.name);
      setListTargetInput(selectedList.target);
      setListActiveInput(selectedList.isActive);
      setGeneralMarginStr(selectedList.margin.toString());
      
      let initTypes = selectedList.includedTypes && selectedList.includedTypes.length > 0 
        ? selectedList.includedTypes 
        : ['presentacion', 'mercaderia'];
      
      if (selectedList.type === 'presentaciones' && (!selectedList.includedTypes || selectedList.includedTypes.length === 0)) initTypes = ['presentacion'];
      if (selectedList.type === 'mercaderias' && (!selectedList.includedTypes || selectedList.includedTypes.length === 0)) initTypes = ['mercaderia'];
      
      const initialMode = selectedList.mode || 'auto';
      setIncludedTypes(initTypes);
      setListModeInput(initialMode);
      setPriceItems(buildItems(initTypes, initialMode, selectedList.margin, selectedList.productOverrides));
    }
  }, [selectedList, presentaciones, mercaderias, insumos, recipes]);

  const handleCreateNewList = () => {
    setSelectedList({
      name: 'Nueva Lista de Precios',
      target: 'Consumidores Especiales',
      margin: 30,
      type: 'presentaciones',
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
    setIncludedTypes(['presentacion', 'mercaderia']);
    setListModeInput('auto');
    setViewMode('edit');
  };

  // When general margin changes, update all active products
  const handleGeneralMarginChange = (val: string) => {
    setGeneralMarginStr(val);
    setPriceItems(priceItems.map(item => !item.excluded ? { ...item, marginStr: val } : item));
  };

  const updateItemMargin = (id: string, val: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, marginStr: val } : item));
  };

  const toggleItemExclusion = (id: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, excluded: !item.excluded } : item));
  };

  const updateItemMode = (id: string, mode: 'auto' | 'manual') => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, mode } : item));
  };

  const updateItemManualPrice = (id: string, priceStr: string) => {
    setPriceItems(priceItems.map(item => item.id === id ? { ...item, manualPriceStr: priceStr } : item));
  };

  const handleTypeToggle = (typeStr: string) => {
    let newTypes = [...includedTypes];
    if (newTypes.includes(typeStr)) {
      newTypes = newTypes.filter(t => t !== typeStr);
    } else {
      newTypes.push(typeStr);
    }
    setIncludedTypes(newTypes);
    setPriceItems(buildItems(newTypes, listModeInput, parseNumber(generalMarginStr), selectedList?.productOverrides));
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as 'auto' | 'manual';
    setListModeInput(newMode);
    setPriceItems(buildItems(includedTypes, newMode, parseNumber(generalMarginStr), selectedList?.productOverrides));
  };

  const handleApplyGeneralMargin = () => {
    if (window.confirm("¿Aplicar el margen general a todos los productos activos?")) {
      setPriceItems(priceItems.map(item => ({ ...item, marginStr: generalMarginStr })));
    }
  };

  const handleAdvancedRound = (mode: string) => {
    if (window.confirm(`¿Aplicar redondeo comercial y pasar los productos a modo Manual?`)) {
      setPriceItems(priceItems.map(item => {
        if (!item.active || item.excluded) return item;
        const margin = parseNumber(item.marginStr);
        const manualPriceNum = parseNumber(item.manualPriceStr);
        const isManual = item.mode === 'manual';
        const autoPrice = margin >= 100 ? item.cost * 2 : (item.cost / (1 - margin / 100));
        let finalPrice = isManual ? manualPriceNum : autoPrice;
        
        if (mode === 'end_90') {
           finalPrice = Math.floor(finalPrice / 100) * 100 + 90;
           if (finalPrice < (isManual ? manualPriceNum : autoPrice)) finalPrice += 100;
        } else if (mode === 'end_99') {
           finalPrice = Math.floor(finalPrice / 100) * 100 + 99;
           if (finalPrice < (isManual ? manualPriceNum : autoPrice)) finalPrice += 100;
        } else if (mode === 'end_50') {
           finalPrice = Math.floor(finalPrice / 100) * 100 + 50;
           if (finalPrice < (isManual ? manualPriceNum : autoPrice)) finalPrice += 100;
        } else if (mode === 'round_10') {
           finalPrice = Math.round(finalPrice / 10) * 10;
        } else if (mode === 'round_50') {
           finalPrice = Math.round(finalPrice / 50) * 50;
        } else if (mode === 'round_100') {
           finalPrice = Math.round(finalPrice / 100) * 100;
        } else if (mode === 'round_500') {
           finalPrice = Math.round(finalPrice / 500) * 500;
        }
        
        return {
          ...item,
          mode: 'manual',
          manualPriceStr: finalPrice.toString()
        };
      }));
    }
  };

  const handleReviewChanges = () => {
    if (!selectedList) return;

    const rItems = priceItems.map(item => {
      if (!item.active || item.excluded) return null;
      
      const oldOverride = selectedList?.productOverrides?.[item.id];
      const oldMargin = oldOverride?.margin ?? selectedList?.margin ?? parseNumber(generalMarginStr);
      const oldMode = oldOverride?.mode ?? selectedList?.mode ?? listModeInput;
      const oldAutoPrice = oldMargin >= 100 ? item.cost * 2 : (item.cost / (1 - oldMargin / 100));
      const oldFinalPrice = oldMode === 'manual' ? (oldOverride?.manualPrice ?? oldAutoPrice) : oldAutoPrice;
      const oldRealMargin = oldFinalPrice > 0 ? ((oldFinalPrice - item.cost) / oldFinalPrice) * 100 : 0;
      
      const newMargin = parseNumber(item.marginStr);
      const newManualPrice = parseNumber(item.manualPriceStr);
      const isManual = item.mode === 'manual';
      const newAutoPrice = newMargin >= 100 ? item.cost * 2 : (item.cost / (1 - newMargin / 100));
      const newFinalPrice = isManual ? newManualPrice : newAutoPrice;
      const newRealMargin = newFinalPrice > 0 ? ((newFinalPrice - item.cost) / newFinalPrice) * 100 : 0;
      
      const diffPrice = newFinalPrice - oldFinalPrice;
      const diffMargin = newRealMargin - oldRealMargin;
      const diffPct = oldFinalPrice > 0 ? (diffPrice / oldFinalPrice) * 100 : 0;
      
      return {
        id: item.id,
        name: item.name,
        cost: item.cost,
        oldPrice: oldFinalPrice,
        oldMargin: oldRealMargin,
        newPrice: newFinalPrice,
        newMargin: newRealMargin,
        diffPrice,
        diffMargin,
        diffPct
      };
    }).filter(Boolean);
    
    setReviewItems(rItems);
    setShowReviewModal(true);
  };

  const handleSavePrices = async () => {
    if (!selectedList) return;

    const belowCostItems = priceItems.filter(item => {
      if (!item.active || item.excluded) return false;
      const margin = parseNumber(item.marginStr);
      const manualPriceNum = parseNumber(item.manualPriceStr);
      const isManual = item.mode === 'manual';
      const autoPrice = margin >= 100 ? item.cost * 2 : (item.cost / (1 - margin / 100));
      const finalPrice = isManual ? manualPriceNum : autoPrice;
      return finalPrice < item.cost;
    });

    if (belowCostItems.length > 0) {
      if (!window.confirm(`ATENCIÓN: Hay ${belowCostItems.length} producto(s) con precio final por debajo del costo (ej. ${belowCostItems[0].name}). ¿Está seguro que desea guardarlos así?`)) {
        return;
      }
    }

    setIsSaving(true);
    try {
      const overrides: Record<string, { margin: number; mode?: 'auto' | 'manual'; manualPrice?: number; excluded?: boolean; itemType?: 'mercaderia' | 'presentacion' | 'receta' }> = {};
      priceItems.forEach(item => {
        if (item.marginStr !== generalMarginStr || item.excluded || item.mode !== listModeInput || item.mode === 'manual') {
          overrides[item.id] = {
            margin: parseNumber(item.marginStr),
            ...(item.excluded ? { excluded: true } : {}),
            mode: item.mode,
            manualPrice: parseNumber(item.manualPriceStr),
            itemType: item.itemType
          };
        }
      });

      const updatedList = {
        name: listNameInput,
        target: listTargetInput,
        // Eliminamos el type estricto, o lo dejamos indefinido ya que ahora se basa en los items.
        // type: ...,
        mode: listModeInput,
        margin: parseNumber(generalMarginStr),
        isActive: listActiveInput,
        includedTypes: includedTypes,
        productOverrides: overrides
      };

      await savePriceList(updatedList, selectedList.id);
      setShowReviewModal(false);
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
    const overrides: Record<string, { margin: number; mode?: 'auto' | 'manual'; manualPrice?: number; excluded?: boolean; itemType?: 'mercaderia' | 'presentacion' | 'receta' }> = {};
    priceItems.forEach(item => {
      if (item.marginStr !== generalMarginStr || item.excluded || item.mode !== listModeInput || item.mode === 'manual') {
        overrides[item.id] = {
          margin: parseNumber(item.marginStr),
          ...(item.excluded ? { excluded: true } : {}),
          mode: item.mode,
          manualPrice: parseNumber(item.manualPriceStr),
          itemType: item.itemType
        };
      }
    });
    return overrides;
  };

  // Helper: Get computed presentation prices for a list
  const getListProducts = (margin: number, overrides?: any, listMode?: 'auto' | 'manual') => {
    const mode = listMode || 'auto';
    let results: any[] = [];
    
    // Evaluate if types are implicitly needed based on overrides, but by default we check all active entities
    const presItems = presentaciones.filter(p => p.isActive).map(p => {
      const cTot = calculatePresentationCost(p, mercaderias, insumos, recipes);
      const overrideMargin = overrides?.[p.id!]?.margin ?? margin;
      const isExcluded = overrides?.[p.id!]?.excluded ?? false;
      const itemMode = overrides?.[p.id!]?.mode ?? mode;
      const autoPrice = overrideMargin >= 100 ? cTot * 2 : (cTot / (1 - overrideMargin / 100));
      const manualPrice = overrides?.[p.id!]?.manualPrice ?? autoPrice;
      const itemType = overrides?.[p.id!]?.itemType || 'presentacion';
      
      const finalPrice = itemMode === 'manual' ? manualPrice : autoPrice;
      const realMargin = finalPrice > 0 ? ((finalPrice - cTot) / finalPrice) * 100 : 0;

      return {
        name: p.name || 'Sin nombre',
        brand: p.customerName || 'Al Vacío',
        gramajeVenta: p.pesoObjetivoGramos,
        cost: cTot,
        margin: realMargin,
        price: finalPrice,
        mode: itemMode,
        itemType: itemType,
        unit: 'Unidad',
        unidadesPorCaja: p.unidadesPorCaja || 1,
        precioCaja: finalPrice * (p.unidadesPorCaja || 1),
        commercialStatus: p.commercialStatus || 'activo',
        isActive: p.isActive && !isExcluded
      };
    }).filter(p => p.isActive && (overrides ? overrides[p.name] !== undefined || true : true)); // Filter by excluded is inside

    const mercItems = mercaderias.filter(m => m.isActive).map(m => {
      const cTot = m.costoKg || 0;
      const overrideMargin = overrides?.[m.id!]?.margin ?? margin;
      const isExcluded = overrides?.[m.id!]?.excluded ?? false;
      const itemMode = overrides?.[m.id!]?.mode ?? mode;
      const autoPrice = overrideMargin >= 100 ? cTot * 2 : (cTot / (1 - overrideMargin / 100));
      const manualPrice = overrides?.[m.id!]?.manualPrice ?? autoPrice;
      const itemType = overrides?.[m.id!]?.itemType || 'mercaderia';
      
      const finalPrice = itemMode === 'manual' ? manualPrice : autoPrice;
      const realMargin = finalPrice > 0 ? ((finalPrice - cTot) / finalPrice) * 100 : 0;

      return {
        name: m.name,
        brand: 'Mercadería',
        gramajeVenta: 1000,
        cost: cTot,
        margin: realMargin,
        price: finalPrice,
        mode: itemMode,
        itemType: itemType,
        unit: 'Kg',
        unidadesPorCaja: 1,
        precioCaja: finalPrice,
        commercialStatus: 'activo',
        isActive: m.isActive && !isExcluded
      };
    }).filter(m => m.isActive);

    results = [...presItems, ...mercItems];
    return results;
  };

  // Export: PDF
  const exportPDF = async (listName: string, margin: number, overrides?: any, listMode?: 'auto' | 'manual') => {
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

    const activeProducts = getListProducts(margin, overrides, listMode);
    
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
      p.itemType === 'mercaderia' ? 'Mercadería' : 'Presentación',
      p.unit,
      formatCurrency(p.price),
      p.itemType === 'presentacion' && p.unidadesPorCaja > 1 ? formatCurrency(p.precioCaja) : '-'
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['Producto', 'Marca', 'Tipo', 'Unidad', 'P. Unit', 'P. Caja']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [33, 37, 41], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 15 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' }
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
  const exportExcel = (listName: string, margin: number, overrides?: any, listMode?: 'auto' | 'manual') => {
    const activeProducts = getListProducts(margin, overrides, listMode);
    
    const headers = ['Producto', 'Marca', 'Gramaje', 'Tipo', 'Unidad', 'Costo Base ($)', 'Modo', 'Margen Real (%)', 'Precio Unitario ($)', 'Unidades x Caja', 'Precio Caja ($)', 'Estado Comercial'];
    const rows = activeProducts.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.brand.replace(/"/g, '""')}"`,
      `"${p.gramajeVenta}g"`,
      p.itemType === 'mercaderia' ? 'Mercadería' : 'Presentación',
      p.unit,
      p.cost.toFixed(2),
      p.mode === 'manual' ? 'Manual' : 'Automático',
      `${p.margin.toFixed(2)}%`,
      p.price.toFixed(2),
      p.itemType === 'presentacion' ? p.unidadesPorCaja.toString() : '1',
      p.precioCaja.toFixed(2),
      p.commercialStatus
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
            <button onClick={() => setShowSimulatorModal(true)} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Simular Costos
            </button>
            <button onClick={() => exportPDF(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides(), listModeInput)} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={18} /> Exportar PDF
            </button>
            <button onClick={() => exportExcel(listNameInput, parseNumber(generalMarginStr), getCurrentOverrides(), listModeInput)} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <TableIcon size={18} /> Exportar Excel
            </button>
            <button onClick={handleReviewChanges} disabled={isSaving} className="btn btn-primary">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
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
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Incluir artículos</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '10px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includedTypes.includes('mercaderia')} onChange={() => handleTypeToggle('mercaderia')} style={{ transform: 'scale(1.1)' }} />
                  Mercaderías
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includedTypes.includes('presentacion')} onChange={() => handleTypeToggle('presentacion')} style={{ transform: 'scale(1.1)' }} />
                  Presentaciones
                </label>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Modo de Precio</div>
              <select value={listModeInput} onChange={handleModeChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="auto">Automático por Margen</option>
                <option value="manual">Manual</option>
              </select>
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
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Ajuste Individual por Producto</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <input type="checkbox" checked={filterStatuses.includes('activo')} onChange={(e) => {
                     if (e.target.checked) setFilterStatuses([...filterStatuses, 'activo']);
                     else setFilterStatuses(filterStatuses.filter(s => s !== 'activo'));
                   }} /> Activos
                 </label>
                 <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <input type="checkbox" checked={filterStatuses.includes('destacado')} onChange={(e) => {
                     if (e.target.checked) setFilterStatuses([...filterStatuses, 'destacado']);
                     else setFilterStatuses(filterStatuses.filter(s => s !== 'destacado'));
                   }} /> Destacados
                 </label>
                 <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <input type="checkbox" checked={filterStatuses.includes('promocion')} onChange={(e) => {
                     if (e.target.checked) setFilterStatuses([...filterStatuses, 'promocion']);
                     else setFilterStatuses(filterStatuses.filter(s => s !== 'promocion'));
                   }} /> Promociones
                 </label>
                 <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <input type="checkbox" checked={filterStatuses.includes('lanzamiento')} onChange={(e) => {
                     if (e.target.checked) setFilterStatuses([...filterStatuses, 'lanzamiento']);
                     else setFilterStatuses(filterStatuses.filter(s => s !== 'lanzamiento'));
                   }} /> Lanzamientos
                 </label>
               </div>
               <button onClick={handleApplyGeneralMargin} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Aplicar Margen General a Todos</button>
               <select onChange={(e) => { handleAdvancedRound(e.target.value); e.target.value = ""; }} className="form-input" style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }} defaultValue="">
                 <option value="" disabled>Redondear precios...</option>
                 <option value="end_90">Terminar en $90</option>
                 <option value="end_99">Terminar en $99</option>
                 <option value="end_50">Terminar en $50</option>
                 <option value="round_10">Redondear a $10</option>
                 <option value="round_50">Redondear a $50</option>
                 <option value="round_100">Redondear a $100</option>
                 <option value="round_500">Redondear a $500</option>
               </select>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Producto</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tipo</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unidad de Venta</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Incluido</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Costo Base</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modo</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen / Precio</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen Real</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Estado</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precio Final</th>
                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {priceItems.filter(item => filterStatuses.length === 0 || filterStatuses.includes(item.commercialStatus || 'activo')).map((item) => {
                const margin = parseNumber(item.marginStr);
                const manualPriceNum = parseNumber(item.manualPriceStr);
                
                const isManual = item.mode === 'manual';
                const autoPrice = margin >= 100 ? item.cost * 2 : (item.cost / (1 - margin / 100));
                const finalPrice = isManual ? manualPriceNum : autoPrice;
                const realMargin = finalPrice > 0 ? ((finalPrice - item.cost) / finalPrice) * 100 : 0;
                
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: item.active && !item.excluded ? '#fff' : 'var(--bg-primary)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: item.active && !item.excluded ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.brand}</div>
                      {!item.active && (
                        <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px' }}>Inactivo en sistema</div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {item.itemType === 'mercaderia' ? 'Mercadería' : 'Presentación'}
                      {item.commercialStatus && item.commercialStatus !== 'activo' && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', marginTop: '2px', fontWeight: 600 }}>
                          {item.commercialStatus.toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {item.unit} {item.unit === 'Unidad' ? `(${item.gramajeVenta}g)` : ''}
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
                      {item.active && !item.excluded ? `${realMargin.toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {item.active && !item.excluded ? (
                        <span style={{ 
                          display: 'inline-block', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                          backgroundColor: realMargin > (settings?.comercial_margenOptimo ?? 30) ? '#dcfce7' : realMargin >= (settings?.comercial_margenRiesgo ?? 15) ? '#fef08a' : '#fee2e2',
                          color: realMargin > (settings?.comercial_margenOptimo ?? 30) ? '#166534' : realMargin >= (settings?.comercial_margenRiesgo ?? 15) ? '#854d0e' : '#991b1b'
                        }}>
                          {realMargin > (settings?.comercial_margenOptimo ?? 30) ? '🟢 Rentable' : realMargin >= (settings?.comercial_margenRiesgo ?? 15) ? '🟡 Ajustado' : '🔴 Riesgo'}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: item.active && !item.excluded ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                      {item.active && !item.excluded ? formatCurrency(finalPrice) : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {item.itemType === 'presentacion' && (
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
          <button onClick={handleCreateNewList} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Nueva Lista
          </button>
        </div>
      </div>

      {(() => {
        const activeList = priceLists.find(l => l.isActive);
        let rentables = 0, riesgo = 0, totalMargin = 0;
        let sortedItems: any[] = [];
        const opt = settings?.comercial_margenOptimo ?? 30;
        const rsg = settings?.comercial_margenRiesgo ?? 15;
        
        if (activeList) {
          const items = getListProducts(activeList.margin, activeList.productOverrides, activeList.mode);
          items.forEach((item: any) => {
            if (item.margin > opt) rentables++;
            if (item.margin < rsg) riesgo++;
            totalMargin += item.margin;
            sortedItems.push(item);
          });
          sortedItems.sort((a, b) => b.margin - a.margin);
        }
        
        const avgMargin = sortedItems.length > 0 ? totalMargin / sortedItems.length : 0;
        const topMargin = sortedItems.slice(0, 3).map(i => i.name).join(', ') || '-';
        const lowMargin = sortedItems.slice().reverse().slice(0, 3).map(i => i.name).join(', ') || '-';
        
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
            <Card padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '10px' }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Rentables (&gt;{opt}%)</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rentables}</h3>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '10px' }}>
                  <XCircle size={20} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>En Riesgo (&lt;{rsg}%)</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{riesgo}</h3>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: '#e0e7ff', color: '#4f46e5', borderRadius: '10px' }}>
                  <Percent size={20} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Margen Promedio</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{avgMargin.toFixed(1)}%</h3>
                </div>
              </div>
            </Card>
            <Card padding="sm" style={{ gridColumn: 'span 2' }}>
               <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                 <strong>Top Margen:</strong> {topMargin}<br/>
                 <strong>Menor Margen:</strong> {lowMargin}
               </div>
            </Card>
          </div>
        );
      })()}

      {loadingLists || loadingPres ? (
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
                    onClick={() => exportPDF(list.name, list.margin, list.productOverrides, list.mode)}
                    className="btn btn-secondary" 
                    style={{ padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    title="Descargar Catálogo PDF comercial"
                  >
                    <FileText size={16} /> PDF
                  </button>
                  <button 
                    onClick={() => exportExcel(list.name, list.margin, list.productOverrides, list.mode)}
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

      {editingPresentation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            width: '90%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
              Editar Presentación: {editingPresentation.name}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nombre de la Presentación
                </label>
                <input 
                  type="text" 
                  value={editingPresentation.name} 
                  onChange={e => setEditingPresentation({ ...editingPresentation, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Peso Objetivo (g)
                  </label>
                  <input 
                    type="number" 
                    value={editingPresentation.pesoObjetivoGramos} 
                    onChange={e => setEditingPresentation({ ...editingPresentation, pesoObjetivoGramos: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Cant. Fetas Estimada
                  </label>
                  <input 
                    type="number" 
                    value={editingPresentation.cantidadFetasEstimada} 
                    onChange={e => setEditingPresentation({ ...editingPresentation, cantidadFetasEstimada: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Mano de Obra ($)
                  </label>
                  <input 
                    type="number" 
                    value={editingPresentation.manoObra || 0} 
                    onChange={e => setEditingPresentation({ ...editingPresentation, manoObra: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Precio Venta por Kg ($)
                  </label>
                  <input 
                    type="number" 
                    value={editingPresentation.precioVentaKg} 
                    onChange={e => setEditingPresentation({ ...editingPresentation, precioVentaKg: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Estado Global (Activo en Catálogo)
                </label>
                <select
                  value={editingPresentation.isActive ? 'active' : 'inactive'}
                  onChange={e => setEditingPresentation({ ...editingPresentation, isActive: e.target.value === 'active' })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Observaciones
                </label>
                <textarea 
                  value={editingPresentation.observations || ''} 
                  onChange={e => setEditingPresentation({ ...editingPresentation, observations: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '60px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => setEditingPresentation(null)} 
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  try {
                    const { id, createdAt, updatedAt, ...rest } = editingPresentation;
                    await savePresentacion(rest, id);
                    setEditingPresentation(null);
                  } catch (e: any) {
                    alert('Error al guardar presentación: ' + e.message);
                  }
                }} 
                className="btn btn-primary"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Revisión de Cambios de Precios</h3>
            
            {reviewItems.filter(i => Math.abs(i.diffPrice) > 0.01 || Math.abs(i.diffMargin) > 0.01).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No hay cambios de precios o rentabilidad detectados en los productos activos.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.8rem' }}>Producto</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Costo</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Precio Actual</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Margen Actual</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Precio Nuevo</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Margen Nuevo</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.filter(i => Math.abs(i.diffPrice) > 0.01 || Math.abs(i.diffMargin) > 0.01).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{item.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem' }}>{formatCurrency(item.cost)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatCurrency(item.oldPrice)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.oldMargin.toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(item.newPrice)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{item.newMargin.toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: item.diffMargin > 0 ? '#16a34a' : (item.diffMargin < 0 ? '#dc2626' : 'inherit') }}>
                        {item.diffMargin > 0 ? '🟢 ' : (item.diffMargin < 0 ? '🔴 ' : '🟡 ')}
                        {item.diffPct > 0 ? '+' : ''}{item.diffPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowReviewModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => { setShowReviewModal(false); handleSavePrices(); }} className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSimulatorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Simulador de Aumento de Costos</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Aumento General de Costos (%)</label>
              <input type="number" value={simulatorIncreasePct} onChange={e => setSimulatorIncreasePct(Number(e.target.value))} className="form-input" style={{ marginLeft: '12px', width: '100px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }} />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.8rem' }}>Producto</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Costo Actual</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Costo Simulado</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Precio Actual</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Margen Actual</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '0.8rem' }}>Margen Futuro</th>
                </tr>
              </thead>
              <tbody>
                {priceItems.filter(item => item.active && !item.excluded).map((item, idx) => {
                  const costoSimulado = item.cost * (1 + (simulatorIncreasePct / 100));
                  const marginNum = parseNumber(item.marginStr);
                  const manualPriceNum = parseNumber(item.manualPriceStr);
                  const isManual = item.mode === 'manual';
                  const autoPrice = marginNum >= 100 ? item.cost * 2 : (item.cost / (1 - marginNum / 100));
                  const finalPrice = isManual ? manualPriceNum : autoPrice;
                  
                  const realMargin = finalPrice > 0 ? ((finalPrice - item.cost) / finalPrice) * 100 : 0;
                  const futureMargin = finalPrice > 0 ? ((finalPrice - costoSimulado) / finalPrice) * 100 : 0;
                  
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{item.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem' }}>{formatCurrency(item.cost)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(costoSimulado)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatCurrency(finalPrice)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{realMargin.toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: futureMargin < 15 ? '#dc2626' : (futureMargin < 30 ? '#d97706' : '#16a34a') }}>
                        {futureMargin.toFixed(1)}% {futureMargin < 15 && '(Riesgo)'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowSimulatorModal(false)} className="btn btn-secondary">Cerrar Simulador</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Precios;
