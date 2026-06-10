import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Plus, Edit2, Trash2, Tag, Layers, Settings, HelpCircle, 
  Percent, Hash, Anchor, DollarSign, Package, User, FileText, ShoppingBag,
  Activity, ShieldAlert
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useRecipes } from '../hooks/useRecipes';
import { useCustomers } from '../hooks/useCustomers';
import { calculatePresentationCost } from '../core/calculations';
import type { Mercaderia, Insumo, Presentacion, Recipe, RecipeIngredient } from '../types/database';

export const Productos = () => {
  // Tabs: 'presentaciones' | 'mercaderias' | 'insumos' | 'recetas'
  const [activeTab, setActiveTab] = useState<'presentaciones' | 'mercaderias' | 'insumos' | 'recetas'>('presentaciones');

  // Hooks
  const { mercaderias, loading: loadingMerc, error: errorMerc, saveMercaderia, deleteMercaderia } = useMercaderias();
  const { insumos, loading: loadingIns, error: errorIns, saveInsumo, deleteInsumo } = useInsumos();
  const { presentaciones, loading: loadingPres, error: errorPres, savePresentacion, deletePresentacion } = usePresentaciones();
  const { recipes, loading: loadingRec, error: errorRec, saveRecipe, deleteRecipe } = useRecipes();
  const { customers, loading: loadingCust } = useCustomers();

  // Modals / Form Open States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form States - Mercadería
  const [mercName, setMercName] = useState('');
  const [mercCategory, setMercCategory] = useState('fiambres');
  const [mercCostoKg, setMercCostoKg] = useState('');
  const [mercPesoFeta, setMercPesoFeta] = useState('');
  const [mercMerma, setMercMerma] = useState('10');
  const [mercProvider, setMercProvider] = useState('');
  const [mercObs, setMercObs] = useState('');

  // Form States - Insumo
  const [insName, setInsName] = useState('');
  const [insCosto, setInsCosto] = useState('');
  const [insObs, setInsObs] = useState('');

  // Form States - Presentación
  const [presName, setPresName] = useState('');
  const [presCustomerId, setPresCustomerId] = useState('');
  const [presBaseId, setPresBaseId] = useState('');
  const [presRecetaId, setPresRecetaId] = useState('');
  const [presPesoGramos, setPresPesoGramos] = useState('200');
  const [presFetas, setPresFetas] = useState('0');
  const [presBolsaId, setPresBolsaId] = useState('');
  const [presEtiquetaId, setPresEtiquetaId] = useState('');
  const [presPrecioKg, setPresPrecioKg] = useState('');
  const [presMargenObjetivo, setPresMargenObjetivo] = useState('40');
  const [presManoObra, setPresManoObra] = useState('0');
  const [presObs, setPresObs] = useState('');
  const [presTypeToggle, setPresTypeToggle] = useState<'simple' | 'recipe'>('simple');
  const [presUnidadesCaja, setPresUnidadesCaja] = useState('1');
  const [presCommercialStatus, setPresCommercialStatus] = useState<'activo' | 'destacado' | 'lanzamiento' | 'promocion' | 'descontinuado'>('activo');

  // Form States - Recetas
  const [recName, setRecName] = useState('');
  const [recProductId, setRecProductId] = useState('');
  const [recCustomerId, setRecCustomerId] = useState('');
  const [recLaborCost, setRecLaborCost] = useState('0');
  const [recAdditionalCost, setRecAdditionalCost] = useState('0');
  const [recMethod, setRecMethod] = useState<'weight' | 'percentage' | 'fetas'>('weight');
  const [recIngredients, setRecIngredients] = useState<any[]>([]);

  const loading = loadingMerc || loadingIns || loadingPres || loadingRec || loadingCust;
  const error = errorMerc || errorIns || errorPres || errorRec;

  // Open Handlers
  const handleOpenMercForm = (item?: Mercaderia) => {
    if (item) {
      setEditingId(item.id!);
      setMercName(item.name);
      setMercCategory(item.category);
      setMercCostoKg(item.costoKg.toString());
      setMercPesoFeta(item.pesoFeta.toString());
      setMercMerma(item.mermaEstimada.toString());
      setMercProvider(item.provider);
      setMercObs(item.observations);
    } else {
      setEditingId(null);
      setMercName('');
      setMercCategory('fiambres');
      setMercCostoKg('');
      setMercPesoFeta('15');
      setMercMerma('10');
      setMercProvider('');
      setMercObs('');
    }
    setIsFormOpen(true);
  };

  const handleOpenInsForm = (item?: Insumo) => {
    if (item) {
      setEditingId(item.id!);
      setInsName(item.name);
      setInsCosto(item.costoUnitario.toString());
      setInsObs(item.observations);
    } else {
      setEditingId(null);
      setInsName('');
      setInsCosto('');
      setInsObs('');
    }
    setIsFormOpen(true);
  };

  const handleOpenPresForm = (item?: Presentacion) => {
    if (item) {
      setEditingId(item.id!);
      setPresName(item.name);
      setPresCustomerId(item.customerId);
      setPresBaseId(item.productoBaseId || '');
      setPresRecetaId(item.recipeId || item.recetaId || '');
      setPresPesoGramos(item.pesoObjetivoGramos.toString());
      setPresFetas(item.cantidadFetasEstimada.toString());
      setPresBolsaId(item.bolsaId || '');
      setPresEtiquetaId(item.etiquetaId || '');
      setPresPrecioKg(item.precioComercialKg.toString());
      setPresMargenObjetivo('40');
      setPresManoObra((item.manoObra || 0).toString());
      setPresObs(item.observations);
      setPresTypeToggle(item.productoBaseId ? 'simple' : 'recipe');
      setPresUnidadesCaja((item.unidadesPorCaja || 1).toString());
      setPresCommercialStatus(item.commercialStatus || 'activo');
    } else {
      setEditingId(null);
      setPresName('');
      setPresCustomerId('');
      setPresBaseId('');
      setPresRecetaId('');
      setPresPesoGramos('200');
      setPresFetas('0');
      setPresBolsaId('');
      setPresEtiquetaId('');
      setPresPrecioKg('');
      setPresMargenObjetivo('40');
      setPresManoObra('0');
      setPresObs('');
      setPresTypeToggle('simple');
      setPresUnidadesCaja('1');
      setPresCommercialStatus('activo');
    }
    setIsFormOpen(true);
  };

  const handleOpenRecForm = (item?: Recipe) => {
    if (item) {
      setEditingId(item.id!);
      setRecName(item.name || item.productName || '');
      setRecProductId(item.productId || '');
      setRecCustomerId(item.customerId || '');
      setRecLaborCost(item.costoManoObra.toString());
      setRecAdditionalCost(item.costoAdicional.toString());
      setRecMethod(item.method || 'weight');
      
      const parsedIngredients = item.ingredients.map(ing => {
        const parts = (ing.productName || '').split(' @');
        const name = parts[0];
        const suffixUnit = parts[1] as 'fetas' | 'kg' | 'g' | 'unidades' | undefined;
        const merc = mercaderias.find(m => m.id === ing.productId);
        const associatedPres = presentaciones.find(p => p.id === item.productId);

        let unit: 'fetas' | 'kg' | 'g' | 'unidades';
        let displayQty = ing.quantity;

        if (suffixUnit) {
          unit = suffixUnit;
          // New format: quantity stored in database is in grams. Convert to display unit.
          if (unit === 'kg') {
            displayQty = ing.quantity / 1000;
          } else if (unit === 'fetas' || unit === 'unidades') {
            const recipeFetaWeight = (associatedPres && associatedPres.pesoObjetivoGramos && associatedPres.cantidadFetasEstimada)
              ? (associatedPres.pesoObjetivoGramos / associatedPres.cantidadFetasEstimada)
              : (merc?.pesoFeta || 15);
            displayQty = recipeFetaWeight > 0 ? ing.quantity / recipeFetaWeight : 0;
          }
        } else {
          // Legacy format fallback: determine unit based on recipe method
          if (item.method === 'fetas') {
            unit = 'fetas';
            displayQty = ing.quantity; // stored in fetas
          } else if (item.method === 'weight') {
            unit = 'kg';
            displayQty = ing.quantity; // stored in Kg
          } else if (item.method === 'percentage') {
            unit = 'g';
            // Convert legacy percentage of presentation weight to grams
            const presWeight = associatedPres?.pesoObjetivoGramos || 0;
            displayQty = presWeight * (ing.quantity / 100);
          } else {
            unit = 'g';
            displayQty = ing.quantity;
          }
        }
        
        return {
          productId: ing.productId,
          productName: name,
          quantity: displayQty,
          unit
        };
      });
      setRecIngredients(parsedIngredients);
    } else {
      setEditingId(null);
      setRecName('');
      setRecProductId('');
      setRecCustomerId('');
      setRecLaborCost('0');
      setRecAdditionalCost('0');
      setRecMethod('weight');
      setRecIngredients([{ productId: '', productName: '', quantity: 1, unit: 'g' }]);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (activeTab === 'mercaderias') {
        await saveMercaderia({
          name: mercName,
          category: mercCategory,
          costoKg: parseNumber(mercCostoKg),
          stockKg: 0, // stock managed via manual/delivered movements only
          provider: mercProvider,
          observations: mercObs,
          pesoFeta: parseNumber(mercPesoFeta),
          mermaEstimada: parseNumber(mercMerma),
          isActive: true
        }, editingId || undefined);
      } else if (activeTab === 'insumos') {
        await saveInsumo({
          name: insName,
          costoUnitario: parseNumber(insCosto),
          stockUnidades: 0,
          observations: insObs,
          isActive: true
        }, editingId || undefined);
      } else if (activeTab === 'presentaciones') {
        const bolsaName = insumos.find(i => i.id === presBolsaId)?.name || '';
        const etiquetaName = insumos.find(i => i.id === presEtiquetaId)?.name || '';
        const baseName = mercaderias.find(m => m.id === presBaseId)?.name || '';
        const customerName = customers.find(c => c.id === presCustomerId)?.name || '';
        const targetRecipe = recipes.find(r => r.id === presRecetaId);
        const recipeNameStr = targetRecipe ? (targetRecipe.name || targetRecipe.productName || '') : '';

        await savePresentacion({
          name: presName,
          customerId: presCustomerId,
          customerName,
          productoBaseId: presTypeToggle === 'simple' ? presBaseId : '',
          productoBaseName: presTypeToggle === 'simple' ? baseName : '',
          recipeId: presTypeToggle === 'recipe' ? presRecetaId : '',
          recipeName: presTypeToggle === 'recipe' ? recipeNameStr : '',
          pesoObjetivoGramos: parseNumber(presPesoGramos),
          cantidadFetasEstimada: parseNumber(presFetas),
          bolsaId: presBolsaId || "",
          bolsaName: bolsaName || "",
          etiquetaId: presEtiquetaId || "",
          etiquetaName: etiquetaName || "",
          precioComercialKg: parseNumber(presPrecioKg),
          manoObra: parseNumber(presManoObra) || 0,
          observations: presObs || '',
          isActive: true,
          unidadesPorCaja: parseNumber(presUnidadesCaja) > 0 ? parseNumber(presUnidadesCaja) : 1,
          commercialStatus: presCommercialStatus
        }, editingId || undefined);
      } else if (activeTab === 'recetas') {
        const pres = presentaciones.find(p => p.id === recProductId);
        const customerName = customers.find(c => c.id === recCustomerId)?.name || '';
        const ingredientsPayload = recIngredients.filter(ing => ing.productId).map(ing => {
          const merc = mercaderias.find(m => m.id === ing.productId);
          const unit = ing.unit || 'g';
          
          let qtyGrams = ing.quantity;
          if (unit === 'kg') {
            qtyGrams = ing.quantity * 1000;
          } else if (unit === 'fetas' || unit === 'unidades') {
            const recipeFetaWeight = (pres && pres.pesoObjetivoGramos && pres.cantidadFetasEstimada)
              ? (pres.pesoObjetivoGramos / pres.cantidadFetasEstimada)
              : (merc?.pesoFeta || 15);
            qtyGrams = ing.quantity * recipeFetaWeight;
          }
          
          const cleanName = (merc?.name || ing.productName || 'Ingrediente').split(' @')[0];

          return {
            productId: ing.productId,
            productName: `${cleanName} @${unit}`,
            quantity: qtyGrams
          };
        });

        const rName = recName || pres?.name || '';
        const recipeData: Omit<Recipe, 'createdAt' | 'updatedAt'> = {
          name: rName,
          productId: recProductId || "",
          productName: pres?.name || "",
          customerId: recCustomerId || "",
          customerName: recCustomerId ? customerName : "",
          ingredients: ingredientsPayload,
          costoManoObra: parseNumber(recLaborCost),
          costoAdicional: parseNumber(recAdditionalCost),
          method: recMethod
        };

        if (editingId) {
          await saveRecipe(recipeData, editingId);
        } else {
          await saveRecipe(recipeData);
        }
      }

      setIsFormOpen(false);
      setEditingId(null);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Confirma que desea eliminar este ítem?')) return;
    try {
      if (activeTab === 'mercaderias') {
        await deleteMercaderia(id);
      } else if (activeTab === 'insumos') {
        await deleteInsumo(id);
      } else if (activeTab === 'presentaciones') {
        await deletePresentacion(id);
      } else if (activeTab === 'recetas') {
        await deleteRecipe(id);
      }
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // Real-time cost preview for Presentaciones form
  let presEstimatedCost = 0;
  let presEstimatedCostKg = 0;
  let presSuggestedPriceKg = 0;
  let presMargin = 0;
  let presMercaderiaCost = 0;
  let presRecetaCost = 0;
  let presBolsaCost = 0;
  let presEtiquetaCost = 0;
  let presManoObraCost = 0;
  let presMissingData: string[] = [];
  let pricePerUnit = 0;
  let utilUnit = 0;
  let utilKg = 0;

  if (activeTab === 'presentaciones') {
    const tempPres: Presentacion = {
      id: editingId || 'temp',
      name: presName,
      customerId: presCustomerId,
      customerName: '',
      productoBaseId: presTypeToggle === 'simple' ? presBaseId : '',
      recipeId: presTypeToggle === 'recipe' ? presRecetaId : '',
      recipeName: presTypeToggle === 'recipe' ? (recipes.find(r => r.id === presRecetaId)?.name || '') : '',
      pesoObjetivoGramos: parseNumber(presPesoGramos),
      cantidadFetasEstimada: parseNumber(presFetas),
      bolsaId: presBolsaId,
      bolsaName: '',
      etiquetaId: presEtiquetaId,
      etiquetaName: '',
      precioComercialKg: parseNumber(presPrecioKg),
      manoObra: parseNumber(presManoObra),
      isActive: true,
      observations: '',
      unidadesPorCaja: parseNumber(presUnidadesCaja) > 0 ? parseNumber(presUnidadesCaja) : 1,
      commercialStatus: presCommercialStatus
    };
    
    const weightKg = tempPres.pesoObjetivoGramos / 1000;

    if (presTypeToggle === 'simple') {
      if (!presBaseId) presMissingData.push('Falta asignar mercadería base');
    } else {
      if (!presRecetaId) presMissingData.push('Falta asignar receta');
    }

    const bag = insumos.find(i => i.id === presBolsaId);
    if (bag) {
      if (typeof bag.costoUnitario === "number" && !isNaN(bag.costoUnitario)) {
        presBolsaCost = bag.costoUnitario;
      }
    }

    const label = insumos.find(i => i.id === presEtiquetaId);
    if (label) {
      if (typeof label.costoUnitario === "number" && !isNaN(label.costoUnitario)) {
        presEtiquetaCost = label.costoUnitario;
      }
    }

    const parsedManoObra = parseNumber(presManoObra);
    if (typeof parsedManoObra === "number" && !isNaN(parsedManoObra)) {
      presManoObraCost = parsedManoObra;
    }

    if (!presPrecioKg && !presMargenObjetivo) presMissingData.push('Falta precio de venta o margen');

    presEstimatedCost = calculatePresentationCost(tempPres, mercaderias, insumos, recipes);
    
    if (presTypeToggle === 'recipe') {
      presRecetaCost = presEstimatedCost - presBolsaCost - presEtiquetaCost - presManoObraCost;
    } else {
      presMercaderiaCost = presEstimatedCost - presBolsaCost - presEtiquetaCost - presManoObraCost;
    }

    presEstimatedCostKg = weightKg > 0 ? presEstimatedCost / weightKg : 0;
    
    const targetMarginVal = parseNumber(presMargenObjetivo);
    if (targetMarginVal >= 0 && targetMarginVal < 100) {
      presSuggestedPriceKg = presEstimatedCostKg / (1 - (targetMarginVal / 100));
    }

    pricePerUnit = tempPres.precioComercialKg * weightKg;
    
    utilUnit = pricePerUnit > 0 ? pricePerUnit - presEstimatedCost : 0;
    utilKg = weightKg > 0 ? utilUnit / weightKg : 0;
    presMargin = pricePerUnit > 0 ? (utilUnit / pricePerUnit) * 100 : 0;
  }

  // Real-time cost preview for Recetas form
  let recEstimatedCost = 0;
  let recEstimatedCostKg = 0;
  let recMargin = 0;
  let associatedPres: Presentacion | undefined = undefined;

  if (activeTab === 'recetas') {
    associatedPres = presentaciones.find(p => p.id === recProductId);
    const mockPres: Presentacion = associatedPres || {
      id: 'mock_pres',
      name: recName || 'Receta Independiente',
      customerId: '',
      pesoObjetivoGramos: 1000,
      cantidadFetasEstimada: 0,
      bolsaId: '',
      etiquetaId: '',
      precioComercialKg: 0,
      isActive: true,
      observations: ''
    };
    
    const tempRecipe: Recipe = {
      id: editingId || 'temp_rec',
      name: recName,
      productId: recProductId || "",
      productName: mockPres.name,
      customerId: recCustomerId || "",
        customerName: '',
        ingredients: recIngredients.filter(ing => ing.productId).map(ing => {
          const merc = mercaderias.find(m => m.id === ing.productId);
          const unit = ing.unit || 'g';
          let qtyGrams = ing.quantity;
          if (unit === 'kg') {
            qtyGrams = ing.quantity * 1000;
          } else if (unit === 'fetas' || unit === 'unidades') {
            const recipeFetaWeight = (mockPres.pesoObjetivoGramos && mockPres.cantidadFetasEstimada)
              ? (mockPres.pesoObjetivoGramos / mockPres.cantidadFetasEstimada)
              : (merc?.pesoFeta || 15);
            qtyGrams = ing.quantity * recipeFetaWeight;
          }
          return {
            productId: ing.productId,
            productName: `${merc?.name || ''} @${unit}`,
            quantity: qtyGrams
          };
        }),
        costoManoObra: parseNumber(recLaborCost),
        costoAdicional: parseNumber(recAdditionalCost),
        method: recMethod,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const tempRecipes = recipes.filter(r => r.id !== editingId);
      tempRecipes.push(tempRecipe);

      recEstimatedCost = calculatePresentationCost(mockPres, mercaderias, insumos, tempRecipes);
      const weightKg = mockPres.pesoObjetivoGramos / 1000;
      recEstimatedCostKg = weightKg > 0 ? recEstimatedCost / weightKg : 0;
      const tPricePerUnit = mockPres.precioComercialKg * weightKg;
      recMargin = tPricePerUnit > 0 ? ((tPricePerUnit - recEstimatedCost) / tPricePerUnit) * 100 : 0;
  }

  if (loading) {
    return <SkeletonLoader rows={5} height="60px" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader 
          title="Fórmulas & Presentaciones" 
          description="Decopla el catálogo de fiambres y define el costo real de elaboración y empaque" 
        />
        <button 
          onClick={() => {
            if (activeTab === 'mercaderias') handleOpenMercForm();
            else if (activeTab === 'insumos') handleOpenInsForm();
            else if (activeTab === 'presentaciones') handleOpenPresForm();
            else if (activeTab === 'recetas') handleOpenRecForm();
          }} 
          className="btn btn-primary"
        >
          <Plus size={18} /> 
          {activeTab === 'mercaderias' && 'Nueva Mercadería'}
          {activeTab === 'insumos' && 'Nuevo Insumo'}
          {activeTab === 'presentaciones' && 'Nueva Presentación'}
          {activeTab === 'recetas' && 'Nueva Receta'}
        </button>
      </div>

      {/* Tabs Menu */}
      <div style={{ 
        display: 'flex', 
        gap: '24px', 
        marginBottom: '24px', 
        borderBottom: '1px solid var(--border-color)', 
        paddingLeft: '4px' 
      }}>
        {[
          { id: 'presentaciones' as const, label: 'Presentaciones', icon: ShoppingBag },
          { id: 'mercaderias' as const, label: 'Mercaderías', icon: Anchor },
          { id: 'insumos' as const, label: 'Insumos', icon: Package },
          { id: 'recetas' as const, label: 'Recetas', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 4px',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '-2px',
                outline: 'none'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PRESENTACIONES */}
      {activeTab === 'presentaciones' && (
        <Card padding="none">
          {presentaciones.length === 0 ? (
            <EmptyState 
              icon={ShoppingBag} 
              title="No hay presentaciones registradas" 
              description="Las presentaciones representan las configuraciones de venta enviadas a clientes (ej: Sobres de 200g, Hormas)."
            />
          ) : (
            <Table 
              data={presentaciones}
              keyExtractor={p => p.id!}
              columns={[
                { 
                  header: 'Nombre Presentación', 
                  accessor: p => {
                    const statusColors: any = {
                      activo: { bg: '#dcfce7', text: '#166534' },
                      destacado: { bg: '#dbeafe', text: '#1e40af' },
                      promocion: { bg: '#ffedd5', text: '#c2410c' },
                      lanzamiento: { bg: '#f3e8ff', text: '#7e22ce' },
                      pausado: { bg: '#f1f5f9', text: '#475569' },
                      descontinuado: { bg: '#fee2e2', text: '#991b1b' }
                    };
                    const status = p.commercialStatus || 'activo';
                    const sColor = statusColors[status] || statusColors.activo;

                    return (
                      <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {p.name}
                          {status !== 'activo' && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: sColor.bg, color: sColor.text, textTransform: 'uppercase', fontWeight: 700 }}>
                              {status}
                            </span>
                          )}
                        </div>
                        {(p.unidadesPorCaja || 1) > 1 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            📦 {p.unidadesPorCaja} un. por caja
                          </div>
                        )}
                      </div>
                    );
                  } 
                },
                { header: 'Cliente', accessor: p => p.customerName || 'Todos' },
                { header: 'Tipo', accessor: p => p.productoBaseId ? <span style={{ color: '#0ea5e9', fontWeight: 500 }}>Simple</span> : <span style={{ color: '#ec4899', fontWeight: 500 }}>Compuesto</span> },
                { header: 'Peso Objetivo', accessor: p => `${p.pesoObjetivoGramos} g` },
                { 
                  header: 'Bolsa / Etiqueta', 
                  accessor: p => (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>👜 {p.bolsaName || '--'}</div>
                      <div>🏷️ {p.etiquetaName || '--'}</div>
                    </div>
                  ) 
                },
                {
                  header: 'Costo Kg',
                  accessor: p => {
                    const cost = calculatePresentationCost(p, mercaderias, insumos, recipes);
                    const weightKg = p.pesoObjetivoGramos / 1000;
                    const costoKg = weightKg > 0 ? cost / weightKg : 0;
                    return <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(costoKg)}</span>;
                  }
                },
                {
                  header: 'P. Sugerido Kg',
                  accessor: p => {
                    const cost = calculatePresentationCost(p, mercaderias, insumos, recipes);
                    const weightKg = p.pesoObjetivoGramos / 1000;
                    const costoKg = weightKg > 0 ? cost / weightKg : 0;
                    // Sugerido is calculated from costoKg using commercial default/optimal margin. Wait, if there's no margin stored, we can use 40% as a dummy or get it from settings. Since I don't have access to settings here, I'll calculate it using margin 40 for display, or show p.precioSugeridoKg if we stored it. The prompt says "precioSugeridoKg Lo calcula el ERP usando el margen objetivo." 
                    // I'll assume we can calculate it dynamically or just display it if it was stored:
                    const sugerido = p.precioSugeridoKg || (costoKg / (1 - 0.4)); // Fallback
                    return <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(sugerido)}</span>;
                  }
                },
                {
                  header: 'P. Comercial Kg',
                  accessor: p => {
                    return (
                      <div>
                        <div style={{ fontWeight: 700 }}>{formatCurrency(p.precioComercialKg)}</div>
                      </div>
                    );
                  }
                },
                {
                  header: 'Diferencia %',
                  accessor: p => {
                    const cost = calculatePresentationCost(p, mercaderias, insumos, recipes);
                    const weightKg = p.pesoObjetivoGramos / 1000;
                    const costoKg = weightKg > 0 ? cost / weightKg : 0;
                    const sugerido = p.precioSugeridoKg || (costoKg / (1 - 0.4));
                    const comercial = p.precioComercialKg;
                    const diffPercent = sugerido > 0 ? ((comercial - sugerido) / sugerido) * 100 : 0;
                    const color = diffPercent >= 0 ? '#10b981' : '#ef4444';
                    return (
                      <span style={{ fontWeight: 700, color }}>
                        {diffPercent > 0 ? '+' : ''}{formatNumber(diffPercent, '%')}
                      </span>
                    );
                  }
                },
                {
                  header: 'Acciones',
                  accessor: p => (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleOpenPresForm(p)} className="btn btn-icon">
                        <Edit2 size={16} color="#3b82f6" />
                      </button>
                      <button onClick={() => handleDelete(p.id!)} className="btn btn-icon">
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ),
                  align: 'center'
                }
              ]}
            />
          )}
        </Card>
      )}

      {/* TAB 2: MERCADERIAS */}
      {activeTab === 'mercaderias' && (
        <Card padding="none">
          {mercaderias.length === 0 ? (
            <EmptyState 
              icon={Anchor} 
              title="No hay mercaderías registradas" 
              description="Las mercaderías representan la materia prima comprada a proveedores por kg (ej: Jamón Cocido, Queso Barra)."
            />
          ) : (
            <Table 
              data={mercaderias}
              keyExtractor={m => m.id!}
              columns={[
                { header: 'Nombre', accessor: m => <span style={{ fontWeight: 600 }}>{m.name}</span> },
                { header: 'Categoría', accessor: m => <span style={{ textTransform: 'capitalize' }}>{m.category}</span> },
                { header: 'Costo / Kg', accessor: m => <span style={{ fontWeight: 600 }}>{formatCurrency(m.costoKg)}</span> },
                { header: 'Merma Estimada', accessor: m => `${m.mermaEstimada}%` },
                { header: 'Peso Feta Prom.', accessor: m => `${m.pesoFeta} g` },
                { header: 'Proveedor Habitual', accessor: m => m.provider || '--' },
                { header: 'Observaciones', accessor: m => m.observations || '--' },
                {
                  header: 'Acciones',
                  accessor: m => (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleOpenMercForm(m)} className="btn btn-icon">
                        <Edit2 size={16} color="#3b82f6" />
                      </button>
                      <button onClick={() => handleDelete(m.id!)} className="btn btn-icon">
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ),
                  align: 'center'
                }
              ]}
            />
          )}
        </Card>
      )}

      {/* TAB 3: INSUMOS */}
      {activeTab === 'insumos' && (
        <Card padding="none">
          {insumos.length === 0 ? (
            <EmptyState 
              icon={Package} 
              title="No hay insumos registrados" 
              description="Los insumos corresponden a materiales consumibles de embalaje y etiquetado (ej: Bolsa 20x30, Etiqueta Al Vacío)."
            />
          ) : (
            <Table 
              data={insumos}
              keyExtractor={i => i.id!}
              columns={[
                { header: 'Nombre Insumo', accessor: i => <span style={{ fontWeight: 600 }}>{i.name}</span> },
                { header: 'Costo Unitario', accessor: i => <span style={{ fontWeight: 600 }}>{formatCurrency(i.costoUnitario)}</span> },
                { header: 'Observaciones', accessor: i => i.observations || '--' },
                {
                  header: 'Acciones',
                  accessor: i => (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleOpenInsForm(i)} className="btn btn-icon">
                        <Edit2 size={16} color="#3b82f6" />
                      </button>
                      <button onClick={() => handleDelete(i.id!)} className="btn btn-icon">
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ),
                  align: 'center'
                }
              ]}
            />
          )}
        </Card>
      )}

      {/* TAB 4: RECETAS */}
      {activeTab === 'recetas' && (
        <Card padding="none">
          {recipes.length === 0 ? (
            <EmptyState 
              icon={Layers} 
              title="No hay recetas registradas" 
              description="Las recetas se definen exclusivamente para presentaciones compuestas (ej: Combinado de Fiambres)."
            />
          ) : (
            <Table 
              data={recipes}
              keyExtractor={r => r.id!}
              columns={[
                { header: 'Nombre', accessor: r => <span style={{ fontWeight: 600 }}>{r.name || r.productName || 'Receta sin nombre'}</span> },
                { header: 'Presentación Asociada', accessor: r => r.productName ? <span style={{ color: 'var(--text-secondary)' }}>{r.productName}</span> : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Independiente</span> },
                { header: 'Cliente', accessor: r => r.customerName || 'Todos los clientes' },
                { 
                  header: 'Unidad de Medida', 
                  accessor: r => {
                    const method = r.method || 'weight';
                    const labels = {
                      weight: { label: 'Por Peso (Kg)', color: '#10b981', bg: '#d1fae5' },
                      percentage: { label: 'Por Porcentaje (%)', color: '#f59e0b', bg: '#fef3c7' },
                      fetas: { label: 'Por Fetas (U)', color: '#3b82f6', bg: '#dbeafe' }
                    }[method];
                    return (
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '9999px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        color: labels.color,
                        backgroundColor: labels.bg
                      }}>
                        {labels.label}
                      </span>
                    );
                  } 
                },
                {
                  header: 'Ingredientes',
                  accessor: r => (
                    <div style={{ fontSize: '0.85rem' }}>
                      {r.ingredients.map((ing, idx) => {
                        const parts = (ing.productName || '').split(' @');
                        const name = parts[0];
                        const unit = parts[1] as 'fetas' | 'kg' | 'g' | 'unidades' | undefined;
                        const merc = mercaderias.find(m => m.id === ing.productId);
                        const pres = presentaciones.find(p => p.id === r.productId);

                        if (unit) {
                          const recipeFetaWeight = (pres && pres.pesoObjetivoGramos && pres.cantidadFetasEstimada)
                            ? (pres.pesoObjetivoGramos / pres.cantidadFetasEstimada)
                            : (merc?.pesoFeta || 15);
                          
                          let displayQty = ing.quantity;
                          if (unit === 'kg') {
                            displayQty = ing.quantity / 1000;
                          } else if (unit === 'fetas' || unit === 'unidades') {
                            displayQty = recipeFetaWeight > 0 ? ing.quantity / recipeFetaWeight : 0;
                          }
                          
                          return (
                            <div key={idx}>
                              • {name}: <strong>{displayQty % 1 === 0 ? displayQty : displayQty.toFixed(2)}</strong> {unit}
                            </div>
                          );
                        } else {
                          return (
                            <div key={idx}>
                              • {name}: <strong>{ing.quantity}</strong> 
                              {r.method === 'percentage' && '%'}
                              {r.method === 'fetas' && ' fetas'}
                              {(r.method === 'weight' || !r.method) && ' Kg'}
                            </div>
                          );
                        }
                      })}
                    </div>
                  )
                },
                { header: 'Costo Mano Obra', accessor: r => formatCurrency(r.costoManoObra) },
                { header: 'Costos Fijos/Adic.', accessor: r => formatCurrency(r.costoAdicional) },
                {
                  header: 'Acciones',
                  accessor: r => (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleOpenRecForm(r)} className="btn btn-icon">
                        <Edit2 size={16} color="#3b82f6" />
                      </button>
                      <button onClick={() => handleDelete(r.id!)} className="btn btn-icon">
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ),
                  align: 'center'
                }
              ]}
            />
          )}
        </Card>
      )}

      {/* FORM MODAL */}
      {isFormOpen && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          zIndex: 60, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div style={{ 
            backgroundColor: 'var(--bg-primary)', 
            padding: '24px', 
            borderRadius: '12px', 
            width: '100%', 
            maxWidth: activeTab === 'recetas' || activeTab === 'presentaciones' ? '700px' : '500px', 
            maxHeight: '90vh', 
            overflowY: 'auto' 
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>
              {editingId ? 'Editar' : 'Registrar'} {
                activeTab === 'mercaderias' ? 'Mercadería' :
                activeTab === 'insumos' ? 'Insumo' :
                activeTab === 'presentaciones' ? 'Presentación' : 'Receta'
              }
            </h2>

            <form onSubmit={handleSave}>
              {/* MERCADERIAS FORM */}
              {activeTab === 'mercaderias' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Input label="Nombre de la Mercadería" value={mercName} onChange={e => setMercName(e.target.value)} required />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Select 
                      label="Categoría" 
                      value={mercCategory} 
                      onChange={e => setMercCategory(e.target.value)} 
                      options={[
                        { value: 'fiambres', label: 'Fiambres' },
                        { value: 'quesos', label: 'Quesos' },
                        { value: 'otros', label: 'Otros' }
                      ]} 
                    />
                    <Input label="Costo por Kilogramo ($)" type="number" value={mercCostoKg} onChange={e => setMercCostoKg(e.target.value)} required />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Input label="Peso Promedio Feta (g)" type="number" value={mercPesoFeta} onChange={e => setMercPesoFeta(e.target.value)} required />
                    <Input label="Merma Estimada (%)" type="number" value={mercMerma} onChange={e => setMercMerma(e.target.value)} required />
                  </div>

                  <Input label="Proveedor Habitual" value={mercProvider} onChange={e => setMercProvider(e.target.value)} />
                  <Input label="Observaciones" value={mercObs} onChange={e => setMercObs(e.target.value)} />
                </div>
              )}

              {/* INSUMOS FORM */}
              {activeTab === 'insumos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Input label="Nombre del Insumo" value={insName} onChange={e => setInsName(e.target.value)} required />
                  <Input label="Costo Unitario ($)" type="number" value={insCosto} onChange={e => setInsCosto(e.target.value)} required />
                  <Input label="Observaciones" value={insObs} onChange={e => setInsObs(e.target.value)} />
                </div>
              )}

              {/* PRESENTACIONES FORM */}
              {activeTab === 'presentaciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                    <Input label="Nombre de la Presentación (ej: Sobres Jamón Panther 200g)" value={presName} onChange={e => setPresName(e.target.value)} required />
                    <Select 
                      label="Cliente Destinatario (Opcional)" 
                      value={presCustomerId} 
                      onChange={e => setPresCustomerId(e.target.value)} 
                      options={[
                        { value: '', label: 'Todos los clientes' },
                        ...customers.map(c => ({ value: c.id!, label: c.name }))
                      ]} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="presType" checked={presTypeToggle === 'simple'} onChange={() => setPresTypeToggle('simple')} />
                      <span>Elaboración Simple (1 Mercadería Base)</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="presType" checked={presTypeToggle === 'recipe'} onChange={() => setPresTypeToggle('recipe')} />
                      <span>Elaboración Compuesta (Requiere Receta)</span>
                    </label>
                  </div>

                  {presTypeToggle === 'simple' ? (
                    <Select 
                      label="Mercadería Base" 
                      value={presBaseId} 
                      onChange={e => setPresBaseId(e.target.value)} 
                      required={presTypeToggle === 'simple'}
                      options={[
                        { value: '', label: 'Seleccionar Mercadería...' },
                        ...mercaderias.map(m => ({ value: m.id!, label: `${m.name} ($${m.costoKg}/Kg)` }))
                      ]} 
                    />
                  ) : (
                    <Select 
                      label="Receta Asociada" 
                      value={presRecetaId} 
                      onChange={e => setPresRecetaId(e.target.value)} 
                      required={presTypeToggle === 'recipe'}
                      options={[
                        { value: '', label: 'Seleccionar Receta...' },
                        ...recipes.map(r => ({ value: r.id!, label: `${r.name || r.productName || 'Receta sin nombre'} (${r.customerName || 'Todos'})` }))
                      ]} 
                    />
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Input label="Peso Objetivo por Sobre (Gramos)" type="number" value={presPesoGramos} onChange={e => setPresPesoGramos(e.target.value)} required />
                    <Input label="Cantidad Fetas Estimadas (Opcional)" type="number" value={presFetas} onChange={e => setPresFetas(e.target.value)} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Select 
                      label="Bolsa Utilizada (Opcional)" 
                      value={presBolsaId} 
                      onChange={e => setPresBolsaId(e.target.value)} 
                      options={[
                        { value: '', label: 'Ninguna' },
                        ...insumos.map(i => ({ value: i.id!, label: `${i.name} (${formatCurrency(i.costoUnitario)})` }))
                      ]} 
                    />
                    <Select 
                      label="Etiqueta Utilizada (Opcional)" 
                      value={presEtiquetaId} 
                      onChange={e => setPresEtiquetaId(e.target.value)} 
                      options={[
                        { value: '', label: 'Ninguna' },
                        ...insumos.map(i => ({ value: i.id!, label: `${i.name} (${formatCurrency(i.costoUnitario)})` }))
                      ]} 
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Input label="Unidades por Caja (Opcional)" type="number" value={presUnidadesCaja} onChange={e => setPresUnidadesCaja(e.target.value)} placeholder="Ej: 12" />
                    <Select 
                      label="Estado Comercial" 
                      value={presCommercialStatus} 
                      onChange={e => setPresCommercialStatus(e.target.value as any)} 
                      options={[
                        { value: 'activo', label: 'Activo' },
                        { value: 'destacado', label: 'Destacado' },
                        { value: 'promocion', label: 'Promoción' },
                        { value: 'lanzamiento', label: 'Lanzamiento' },
                        { value: 'pausado', label: 'Pausado' },
                        { value: 'descontinuado', label: 'Discontinuado' }
                      ]} 
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <Input label="Precio Venta por Kg ($)" type="number" value={presPrecioKg} onChange={e => setPresPrecioKg(e.target.value)} />
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '6px', fontWeight: 600 }}>👉 Precio manual activo (prioritario)</div>
                    </div>
                    <div>
                      <Input label="Margen Objetivo (%)" type="number" value={presMargenObjetivo} onChange={e => setPresMargenObjetivo(e.target.value)} />
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {[20, 30, 40, 45, 50, 60].map(m => (
                          <button 
                            key={m} 
                            type="button"
                            onClick={() => setPresMargenObjetivo(m.toString())}
                            style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-primary)' }}
                          >
                            +{m}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input label="Costo Mano Obra por Sobre ($)" type="number" value={presManoObra} onChange={e => setPresManoObra(e.target.value)} />
                  </div>

                  <Input label="Observaciones" value={presObs} onChange={e => setPresObs(e.target.value)} />

                  {/* Panel de Rentabilidad en Tiempo Real */}
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} color="var(--primary-color)" /> Análisis de Rentabilidad Comercial
                    </h4>

                    {presMissingData.length > 0 && (
                      <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldAlert size={16} /> Faltan datos para el cálculo exacto:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '24px' }}>
                          {presMissingData.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Desglose de Costos (Por Sobre)</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>{presTypeToggle === 'simple' ? 'Mercadería Base' : 'Costo Receta'}</span>
                          <span style={{ fontWeight: 500 }}>{formatCurrency(presTypeToggle === 'simple' ? presMercaderiaCost : presRecetaCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Bolsa</span>
                          <span style={{ fontWeight: 500 }}>{formatCurrency(presBolsaCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Etiqueta</span>
                          <span style={{ fontWeight: 500 }}>{formatCurrency(presEtiquetaCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Mano de Obra</span>
                          <span style={{ fontWeight: 500 }}>{formatCurrency(presManoObraCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px 0', borderTop: '1px dashed var(--border-color)', marginTop: '4px', fontWeight: 700 }}>
                          <span>Costo Total Unitario</span>
                          <span style={{ color: '#ef4444' }}>{formatCurrency(presEstimatedCost)}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Márgenes y Utilidad</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Precio Venta Unitario <span style={{ color: '#3b82f6', fontSize: '0.7rem', fontWeight: 600 }}>(Manual Activo)</span></span>
                          <span style={{ fontWeight: 600 }}>{formatCurrency(pricePerUnit)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Utilidad Bruta x Unidad</span>
                          <span style={{ fontWeight: 600, color: utilUnit > 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(utilUnit)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Utilidad Bruta x Kg</span>
                          <span style={{ fontWeight: 600, color: utilKg > 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(utilKg)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px 0', borderTop: '1px dashed var(--border-color)', marginTop: '4px', fontWeight: 700 }}>
                          <span>Rentabilidad / Margen %</span>
                          <span style={{ color: presMargin >= 30 ? '#10b981' : presMargin >= 15 ? '#f59e0b' : '#ef4444' }}>{formatNumber(presMargin, '%')}</span>
                        </div>
                        
                        {parseNumber(presUnidadesCaja) > 1 && (
                          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e0e7ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3730a3', marginBottom: '8px', borderBottom: '1px solid #c7d2fe', paddingBottom: '4px' }}>Métricas por Caja ({parseNumber(presUnidadesCaja)} Unidades)</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', color: '#3730a3' }}>
                              <span>Precio Caja:</span>
                              <span style={{ fontWeight: 700 }}>{formatCurrency(pricePerUnit * parseNumber(presUnidadesCaja))}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', color: '#3730a3' }}>
                              <span>Costo Caja:</span>
                              <span style={{ fontWeight: 600 }}>{formatCurrency(presEstimatedCost * parseNumber(presUnidadesCaja))}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', color: '#3730a3' }}>
                              <span>Utilidad Caja:</span>
                              <span style={{ fontWeight: 600 }}>{formatCurrency(utilUnit * parseNumber(presUnidadesCaja))}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', color: '#3730a3' }}>
                              <span>Margen Caja:</span>
                              <span style={{ fontWeight: 700 }}>{formatNumber(presMargin, '%')}</span>
                            </div>
                          </div>
                        )}
                        
                        <div style={{ marginTop: '16px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Pricing Inverso</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Costo Total por Kg</span>
                          <span style={{ fontWeight: 600 }}>{formatCurrency(presEstimatedCostKg)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0' }}>
                          <span>Margen Objetivo Ingresado</span>
                          <span style={{ fontWeight: 600 }}>{formatNumber(parseNumber(presMargenObjetivo), '%')}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'center' }}>
                            <span>👉 Precio de venta sugerido</span>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{presSuggestedPriceKg > 0 ? formatCurrency(presSuggestedPriceKg) + ' /Kg' : 'Margen inválido'}</span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setPresPrecioKg(presSuggestedPriceKg.toFixed(2))}
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%', marginTop: '4px' }}
                            disabled={presSuggestedPriceKg <= 0}
                          >
                            Aplicar Precio Sugerido
                          </button>

                          {(() => {
                            if (presSuggestedPriceKg <= 0 || !presPrecioKg) return null;
                            const currentPrice = parseNumber(presPrecioKg);
                            const diffAmount = currentPrice - presSuggestedPriceKg;
                            const diffPercent = (diffAmount / presSuggestedPriceKg) * 100;
                            
                            let statusColor = '#f59e0b';
                            let statusText = '🟡 Precio igual al sugerido';
                            
                            if (diffAmount > 0.01) {
                              statusColor = '#10b981';
                              statusText = '🟢 Precio por encima del sugerido';
                            } else if (diffAmount < -0.01) {
                              statusColor = '#ef4444';
                              statusText = '🔴 Precio por debajo del sugerido';
                            }
                            
                            return (
                              <div style={{ marginTop: '8px', borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                  <span>Precio sugerido:</span>
                                  <span style={{ fontWeight: 600 }}>{formatCurrency(presSuggestedPriceKg)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                  <span>Precio actual:</span>
                                  <span style={{ fontWeight: 600 }}>{formatCurrency(currentPrice)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                                  <span>Diferencia:</span>
                                  <span style={{ fontWeight: 700, color: statusColor }}>
                                    {diffAmount > 0 ? '+' : ''}{formatCurrency(diffAmount)} ({diffAmount > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: statusColor, textAlign: 'center', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: '4px' }}>
                                  {statusText}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* RECETAS FORM */}
              {activeTab === 'recetas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <Input label="Nombre de la Receta" value={recName} onChange={e => setRecName(e.target.value)} required />
                    <Select 
                      label="Presentación Asociada (Opcional)" 
                      value={recProductId} 
                      onChange={e => setRecProductId(e.target.value)} 
                      options={[
                        { value: '', label: 'Ninguna (Independiente)' },
                        ...presentaciones.filter(p => !p.productoBaseId).map(p => ({ value: p.id!, label: `${p.name} (${p.customerName || 'Todos'})` }))
                      ]} 
                    />
                    <Select 
                      label="Destinar a Cliente (Opcional)" 
                      value={recCustomerId} 
                      onChange={e => setRecCustomerId(e.target.value)} 
                      options={[
                        { value: '', label: 'Todos los clientes' },
                        ...customers.map(c => ({ value: c.id!, label: c.name }))
                      ]} 
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <Select 
                      label="Método de Receta" 
                      value={recMethod} 
                      onChange={e => setRecMethod(e.target.value as any)} 
                      options={[
                        { value: 'weight', label: 'Por Peso (Kg)' },
                        { value: 'percentage', label: 'Por Porcentaje (%)' },
                        { value: 'fetas', label: 'Por Fetas (Unidades)' }
                      ]} 
                    />
                    <Input label="Costo Mano Obra ($)" type="number" value={recLaborCost} onChange={e => setRecLaborCost(e.target.value)} />
                    <Input label="Costos Fijos/Adicionales ($)" type="number" value={recAdditionalCost} onChange={e => setRecAdditionalCost(e.target.value)} />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ingredientes de la Receta</h4>
                      <button 
                        type="button" 
                        onClick={() => setRecIngredients([...recIngredients, { productId: '', productName: '', quantity: 1 }])}
                        className="btn btn-secondary-light btn-sm"
                      >
                        + Agregar Ingrediente
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {recIngredients.map((ing, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr auto', gap: '12px', alignItems: 'end' }}>
                          <Select 
                            label="Mercadería (Ingrediente)"
                            value={ing.productId}
                            onChange={e => {
                              const updated = [...recIngredients];
                              updated[idx].productId = e.target.value;
                              setRecIngredients(updated);
                            }}
                            required
                            options={[
                              { value: '', label: 'Seleccionar Mercadería...' },
                              ...mercaderias.map(m => ({ value: m.id!, label: `${m.name} ($${m.costoKg}/Kg)` }))
                            ]}
                          />
                          <Input 
                            label="Cantidad"
                            type="number"
                            value={ing.quantity.toString()}
                            onChange={e => {
                              const updated = [...recIngredients];
                              updated[idx].quantity = parseNumber(e.target.value);
                              setRecIngredients(updated);
                            }}
                            required
                          />
                          <Select 
                            label="Unidad"
                            value={ing.unit || 'g'}
                            onChange={e => {
                              const updated = [...recIngredients];
                              updated[idx].unit = e.target.value as any;
                              setRecIngredients(updated);
                            }}
                            options={[
                              { value: 'g', label: 'Gramos (g)' },
                              { value: 'kg', label: 'Kilogramos (kg)' },
                              { value: 'fetas', label: 'Fetas' },
                              { value: 'unidades', label: 'Unidades' }
                            ]}
                          />
                          <button 
                            type="button" 
                            onClick={() => setRecIngredients(recIngredients.filter((_, i) => i !== idx))}
                            className="btn btn-icon"
                            style={{ color: '#ef4444', marginBottom: '8px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cost Preview Card */}
                  {associatedPres ? (
                    <div style={{
                      marginTop: '20px',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '12px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Costo Estimado / Unidad</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(recEstimatedCost)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Costo Estimado / Kg</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(recEstimatedCostKg)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Margen Estimado</div>
                        <div style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: 700, 
                          color: recMargin >= 30 ? '#10b981' : recMargin >= 15 ? '#f59e0b' : '#ef4444', 
                          marginTop: '4px' 
                        }}>{formatNumber(recMargin, '%')}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      marginTop: '20px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem'
                    }}>
                      Seleccione una presentación asociada para calcular los costos de elaboración estimados.
                    </div>
                  )}
                </div>
              )}

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => { setIsFormOpen(false); setEditingId(null); }} 
                  className="btn btn-secondary" 
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Productos;
