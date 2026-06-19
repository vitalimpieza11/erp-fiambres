import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { useSociosStore } from '../../store/sociosStore';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { useClientesStore } from '../../store/clientesStore';
import { useProveedoresStore } from '../../store/proveedoresStore';
import { initialLoadRepository, type InitialLoadData } from '../../repositories/initialLoad/initialLoadRepository';
import { 
  Sparkles, 
  Calendar, 
  Layers, 
  TrendingUp, 
  Users, 
  Wallet, 
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Info,
  DollarSign,
  Plus,
  Trash2,
  Lock,
  Search,
  AlertTriangle,
  Scale
} from 'lucide-react';
import './AsistenteInicio.css';

// Helper for name similarity to prevent duplicates
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/\b(distribuidora|dist|srl|sa|s\.r\.l\.|s\.a\.)\b/g, "");
}

function checkSimilarity(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return false;
  return n1.includes(n2) || n2.includes(n1);
}

export default function AsistenteInicio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryMode = searchParams.get('mode') || 'initial'; // 'initial' or 'adjust'

  const { products, fetchData: fetchStock } = useStockStore();
  const { shareholders, subscribeAll: subscribeSocios } = useSociosStore();
  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const { customers, fetchClientesData } = useClientesStore();
  const { suppliers, subscribeAll: subscribeProveedores } = useProveedoresStore();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status for Idempotency
  const [migrationStatus, setMigrationStatus] = useState<{ executed: boolean; executedAt?: string } | null>(null);

  // --- WIZARD STATES ---
  const [fechaCorte, setFechaCorte] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Modo A: Socios con subtabla de movimientos
  interface ShareholderMovementRow {
    id: string;
    date: string;
    tipo: 'APORTE' | 'PRESTAMO';
    tipoAporte?: 'DINERO' | 'BIEN';
    descripcionBien?: string;
    concepto: string;
    amount: number;
  }
  const [aportesSocios, setAportesSocios] = useState<{
    id: string;
    name: string;
    isNew: boolean;
    movements: ShareholderMovementRow[];
  }[]>([]);

  // Passo 3 (Modo A & B): Cuentas financieras
  const [cajaInicial, setCajaInicial] = useState<{
    id: string;
    name: string;
    type: 'EFECTIVO' | 'BANCO' | 'BILLETERA_VIRTUAL';
    isNew: boolean;
    amount: number;
  }[]>([]);

  // Passo 4 (Modo A & B): Clientes con saldo pendiente
  const [clientesDeudas, setClientesDeudas] = useState<{
    id: string;
    name: string;
    isNew: boolean;
    saldo: number;
    observaciones: string;
  }[]>([]);

  // Passo 5 (Modo A & B): Proveedores con saldo pendiente
  const [proveedoresDeudas, setProveedoresDeudas] = useState<{
    id: string;
    name: string;
    isNew: boolean;
    saldo: number;
    observaciones: string;
  }[]>([]);

  // Passo 6 (Modo A & B): Stock MP / Insumos
  const [stockMP, setStockMP] = useState<{
    productId: string;
    stockFisico: number;
    costoUnitario: number;
  }[]>([]);

  // Passo 7 (Modo A & B): Stock Presentaciones
  const [stockPresentaciones, setStockPresentaciones] = useState<{
    productId: string;
    cantidad: number;
    pesoPromedio: number;
    unidadMedida: 'KG' | 'UNIDADES';
    costoUnitario: number;
    precioVenta: number;
  }[]>([]);

  // Passo 8 (Modo A): Compras Históricas Detalladas
  interface CompraHistItem {
    productId: string;
    cantidad: number;
    unidad: string;
    costoUnitario: number;
    subtotal: number;
  }
  const [comprasHist, setComprasHist] = useState<{
    id: string;
    supplierId: string;
    supplierName: string;
    isNewSupplier: boolean;
    date: string;
    estado: 'PAGADA' | 'PENDIENTE' | 'PARCIALMENTE PAGADA';
    paymentType: 'CUENTA' | 'APORTE_SOCIO';
    socioId?: string;
    cuentaId?: string;
    total: number;
    pagado: number;
    observaciones: string;
    items: CompraHistItem[];
  }[]>([]);

  // Passo 9 (Modo A): Ventas Históricas Detalladas o Resumidas
  interface VentaHistItem {
    productId: string;
    cantidad: number;
    precioUnitario: number;
    costoUnitario: number;
    subtotal: number;
    observacion?: string;
  }
  const [ventasHist, setVentasHist] = useState<{
    id: string;
    customerId: string;
    customerName: string;
    isNewCustomer: boolean;
    date: string;
    estado: 'COBRADA' | 'PENDIENTE' | 'PARCIALMENTE COBRADA';
    deliveryStatus?: 'REGISTRADA' | 'PENDIENTE' | 'ENTREGADO';
    total: number;
    cobrado: number;
    observaciones: string;
    items: VentaHistItem[];
    // Modalidad Resumida
    tipoMode?: 'DETALLADA' | 'RESUMIDA';
    productId?: string;
    cantidad?: number;
    costoTotal?: number;
  }[]>([]);

  // Inline Creación Modal State
  const [showInlineModal, setShowInlineModal] = useState<string | null>(null);
  const [inlineData, setInlineData] = useState<any>({});
  const [similarityWarning, setSimilarityWarning] = useState<string | null>(null);

  // Load stores data
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await initialLoadRepository.getInitialLoadStatus();
        setMigrationStatus(status);
      } catch (err) {
        console.error("Error reading status:", err);
      }
    };
    checkStatus();
    fetchStock();
    fetchClientesData();
    const unsubSocios = subscribeSocios();
    const unsubProveedores = subscribeProveedores();
    fetchAccounts();
    return () => {
      unsubSocios();
      unsubProveedores();
    };
  }, [fetchStock, fetchClientesData, subscribeSocios, subscribeProveedores, fetchAccounts]);

  const isReadOnly = queryMode === 'initial' && !!migrationStatus?.executed;

  // Normalization similarity check
  const handleNameChange = (name: string, type: 'socio' | 'cuenta' | 'cliente' | 'proveedor') => {
    setInlineData({ ...inlineData, nombre: name });
    if (!name.trim()) {
      setSimilarityWarning(null);
      return;
    }
    let matchFound = false;
    if (type === 'socio') {
      matchFound = shareholders.some(s => checkSimilarity(s.nombre, name));
    } else if (type === 'cuenta') {
      matchFound = accounts.some(a => checkSimilarity(a.nombre, name));
    } else if (type === 'cliente') {
      matchFound = customers.some(c => checkSimilarity(c.nombre, name));
    } else if (type === 'proveedor') {
      matchFound = suppliers.some(s => checkSimilarity(s.nombre, name));
    }

    if (matchFound) {
      setSimilarityWarning(`¡Advertencia! Existe un registro similar en la base de datos. Por favor, asegúrese de no duplicar.`);
    } else {
      setSimilarityWarning(null);
    }
  };

  const submitInlineCreation = () => {
    const tempId = `temp-${Date.now()}`;
    const name = inlineData.nombre || '';
    if (!name.trim()) return;

    if (showInlineModal === 'socio') {
      setAportesSocios([...aportesSocios, {
        id: tempId,
        name,
        isNew: true,
        movements: []
      }]);
    } else if (showInlineModal === 'cuenta') {
      setCajaInicial([...cajaInicial, {
        id: tempId,
        name,
        type: inlineData.tipo || 'EFECTIVO',
        isNew: true,
        amount: 0
      }]);
    } else if (showInlineModal === 'cliente') {
      setClientesDeudas([...clientesDeudas, {
        id: tempId,
        name,
        isNew: true,
        saldo: 0,
        observaciones: ''
      }]);
    } else if (showInlineModal === 'proveedor') {
      setProveedoresDeudas([...proveedoresDeudas, {
        id: tempId,
        name,
        isNew: true,
        saldo: 0,
        observaciones: ''
      }]);
    }
    setShowInlineModal(null);
    setInlineData({});
    setSimilarityWarning(null);
  };

  // Steps Lists
  const stepsA = [
    { num: 1, label: 'Fecha de Corte', icon: <Calendar size={18} /> },
    { num: 2, label: 'Socios', icon: <Users size={18} /> },
    { num: 3, label: 'Cajas', icon: <Wallet size={18} /> },
    { num: 4, label: 'Clientes CC', icon: <Users size={18} /> },
    { num: 5, label: 'Proveedores CC', icon: <Users size={18} /> },
    { num: 6, label: 'Stock MP', icon: <Layers size={18} /> },
    { num: 7, label: 'Stock Pres', icon: <Scale size={18} /> },
    { num: 8, label: 'Compras Hist.', icon: <TrendingUp size={18} /> },
    { num: 9, label: 'Ventas Hist.', icon: <TrendingUp size={18} /> },
    { num: 10, label: 'Balance Contable', icon: <Info size={18} /> },
    { num: 11, label: 'Confirmación', icon: <CheckCircle size={18} /> }
  ];

  const stepsB = [
    { num: 1, label: 'Fecha de Corte', icon: <Calendar size={18} /> },
    { num: 2, label: 'Ajuste Caja', icon: <Wallet size={18} /> },
    { num: 3, label: 'Ajuste Clientes', icon: <Users size={18} /> },
    { num: 4, label: 'Ajuste Prov', icon: <Users size={18} /> },
    { num: 5, label: 'Ajuste Stock MP', icon: <Layers size={18} /> },
    { num: 6, label: 'Ajuste Stock Pres', icon: <Scale size={18} /> },
    { num: 7, label: 'Confirmación', icon: <CheckCircle size={18} /> }
  ];

  const activeSteps = queryMode === 'initial' ? stepsA : stepsB;
  const maxStep = activeSteps.length;

  const totals = useMemo(() => {
    // Calculo de aportes y prestamos multiconcepto
    const totalAportes = aportesSocios.reduce((acc, s) => {
      const shAportes = (s.movements || []).filter(m => m.tipo === 'APORTE').reduce((sum, m) => sum + m.amount, 0);
      return acc + shAportes;
    }, 0);
    const totalAportesBienes = aportesSocios.reduce((acc, s) => {
      const shAportes = (s.movements || []).filter(m => m.tipo === 'APORTE' && m.tipoAporte === 'BIEN').reduce((sum, m) => sum + m.amount, 0);
      return acc + shAportes;
    }, 0);
    const totalPrestamos = aportesSocios.reduce((acc, s) => {
      const shLoans = (s.movements || []).filter(m => m.tipo === 'PRESTAMO').reduce((sum, m) => sum + m.amount, 0);
      return acc + shLoans;
    }, 0);

    const totalCajas = cajaInicial.reduce((acc, c) => acc + c.amount, 0);
    const totalClientesCc = clientesDeudas.reduce((acc, cl) => acc + cl.saldo, 0);
    const totalProveedoresCc = proveedoresDeudas.reduce((acc, pr) => acc + pr.saldo, 0);
    const totalStockMP = stockMP.reduce((acc, st) => acc + (st.stockFisico * st.costoUnitario), 0);
    const totalStockPresCosto = stockPresentaciones.reduce((acc, pr) => acc + (pr.cantidad * pr.costoUnitario), 0);
    const totalStockPresVenta = stockPresentaciones.reduce((acc, pr) => acc + (pr.cantidad * pr.precioVenta), 0);
    const totalWeightPres = stockPresentaciones.reduce((acc, pr) => acc + (pr.unidadMedida === 'KG' ? pr.cantidad * pr.pesoPromedio : pr.cantidad), 0);

    // Compras y Ventas históricas
    const comprasHistTotal = comprasHist.reduce((acc, c) => acc + c.total, 0);
    const comprasHistPagadas = comprasHist.reduce((acc, c) => acc + c.pagado, 0);
    const comprasHistDeuda = comprasHistTotal - comprasHistPagadas;

    const comprasHistAportadasSocios = comprasHist.reduce((acc, c) => {
      if (c.paymentType === 'APORTE_SOCIO') return acc + c.pagado;
      return acc;
    }, 0);

    const ventasHistTotal = ventasHist.reduce((acc, v) => acc + v.total, 0);
    const ventasHistCobradas = ventasHist.reduce((acc, v) => acc + v.cobrado, 0);
    const ventasHistPendientes = ventasHistTotal - ventasHistCobradas;

    const ventasHistCMV = ventasHist.reduce((acc, v) => {
      if (v.tipoMode === 'RESUMIDA') {
        return acc + Number(v.costoTotal || 0);
      }
      return acc + v.items.reduce((sum, it) => sum + (it.cantidad * it.costoUnitario), 0);
    }, 0);
    const ventasHistGanancia = ventasHistTotal - ventasHistCMV;

    // Ecuación de balance general:
    // Activo = Caja + Clientes Pendientes (Paso 4 + Ventas pendientes) + Stock (MP + Presentaciones costo) + Bienes Aportados
    const activo = totalCajas + totalClientesCc + ventasHistPendientes + totalStockMP + totalStockPresCosto + totalAportesBienes;
    // Pasivo = Proveedores (Paso 5 + Compras pendientes) + Préstamos socios
    const pasivo = totalProveedoresCc + comprasHistDeuda + totalPrestamos;
    // Patrimonio = Capital socios + Ganancias acumuladas + Compras pagadas mediante aporte de socio
    const patrimonio = totalAportes + ventasHistGanancia + comprasHistAportadasSocios;

    const diferenciaBalance = activo - (pasivo + patrimonio);

    return {
      totalAportes,
      totalAportesBienes,
      totalPrestamos,
      totalCajas,
      totalClientesCc,
      totalProveedoresCc,
      totalStockMP,
      totalStockPresCosto,
      totalStockPresVenta,
      totalWeightPres,
      comprasHistTotal,
      comprasHistPagadas,
      comprasHistDeuda,
      comprasHistAportadasSocios,
      ventasHistTotal,
      ventasHistCobradas,
      ventasHistPendientes,
      ventasHistCMV,
      ventasHistGanancia,
      activo,
      pasivo,
      patrimonio,
      diferenciaBalance
    };
  }, [aportesSocios, cajaInicial, clientesDeudas, proveedoresDeudas, stockMP, stockPresentaciones, comprasHist, ventasHist]);

  const handleExecute = async () => {
    if (isReadOnly) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (queryMode === 'initial') {
        const payload: InitialLoadData = {
          fechaCorte,
          isAdjustOnly: false,
          stocks: stockMP.map(s => ({
            productId: s.productId,
            stockFisico: Number(s.stockFisico),
            costoUnitario: Number(s.costoUnitario)
          })),
          presentaciones: stockPresentaciones.map(p => ({
            productId: p.productId,
            cantidad: Number(p.cantidad),
            pesoPromedio: Number(p.pesoPromedio),
            unidadMedida: p.unidadMedida,
            costoUnitario: Number(p.costoUnitario),
            precioVenta: Number(p.precioVenta)
          })),
          comprasHistoricas: comprasHist.map(c => ({
            date: c.date,
            supplierId: c.supplierId,
            supplierName: c.supplierName,
            isNewSupplier: c.isNewSupplier,
            estado: c.estado,
            paymentType: c.paymentType,
            socioId: c.socioId,
            cuentaId: c.cuentaId,
            total: Number(c.total),
            pagado: Number(c.pagado),
            observaciones: c.observaciones,
            items: c.items.map(it => ({
              productId: it.productId,
              cantidad: Number(it.cantidad),
              unidad: it.unidad,
              costoUnitario: Number(it.costoUnitario),
              subtotal: Number(it.subtotal)
            }))
          })),
          ventasHistoricas: ventasHist.map(v => ({
            date: v.date,
            customerId: v.customerId,
            customerName: v.customerName,
            isNewCustomer: v.isNewCustomer,
            estado: v.estado,
            deliveryStatus: v.deliveryStatus || 'REGISTRADA',
            total: Number(v.total),
            cobrado: Number(v.cobrado),
            observaciones: v.observaciones,
            items: v.tipoMode === 'RESUMIDA' && v.productId && v.cantidad ? [
              {
                productId: v.productId,
                cantidad: Number(v.cantidad),
                precioUnitario: Number(v.total) / Number(v.cantidad),
                costoUnitario: Number(v.costoTotal || 0) / Number(v.cantidad),
                subtotal: Number(v.total)
              }
            ] : v.items.map(it => ({
              productId: it.productId,
              cantidad: Number(it.cantidad),
              precioUnitario: Number(it.precioUnitario),
              costoUnitario: Number(it.costoUnitario),
              subtotal: Number(it.subtotal),
              observacion: it.observacion
            }))
          })),
          aportes: aportesSocios.map(a => ({
            shareholderId: a.id,
            shareholderName: a.name,
            isNewShareholder: a.isNew,
            movements: a.movements.map(m => ({
              date: m.date,
              tipo: m.tipo,
              concepto: m.concepto,
              amount: Number(m.amount)
            }))
          })),
          cajaInicial: cajaInicial.map(c => ({
            accountId: c.id,
            accountName: c.name,
            accountType: c.type,
            isNewAccount: c.isNew,
            amount: Number(c.amount)
          })),
          clientesIniciales: clientesDeudas.map(cl => ({
            customerId: cl.id,
            customerName: cl.name,
            isNewCustomer: cl.isNew,
            saldo: Number(cl.saldo),
            observaciones: cl.observaciones
          })),
          proveedoresIniciales: proveedoresDeudas.map(pr => ({
            supplierId: pr.id,
            supplierName: pr.name,
            isNewSupplier: pr.isNew,
            saldo: Number(pr.saldo),
            observaciones: pr.observaciones
          })),
          ajusteDiferenciaBalance: totals.diferenciaBalance
        };

        await initialLoadRepository.executeInitialLoad(payload);
      } else {
        // Modo B
        const currentBalances = {
          accounts: accounts.reduce((acc, a) => ({ ...acc, [a.id]: 0 }), {} as Record<string, number>),
          customers: customers.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {} as Record<string, number>),
          suppliers: suppliers.reduce((acc, s) => ({ ...acc, [s.id]: 0 }), {} as Record<string, number>),
          products: products.reduce((acc, p) => ({ ...acc, [p.id]: p.stockActual || 0 }), {} as Record<string, number>)
        };

        const payload: InitialLoadData = {
          fechaCorte,
          isAdjustOnly: true,
          stocks: stockMP.map(s => ({
            productId: s.productId,
            stockFisico: Number(s.stockFisico),
            costoUnitario: Number(s.costoUnitario)
          })),
          presentaciones: stockPresentaciones.map(p => ({
            productId: p.productId,
            cantidad: Number(p.cantidad),
            pesoPromedio: Number(p.pesoPromedio),
            unidadMedida: p.unidadMedida,
            costoUnitario: Number(p.costoUnitario),
            precioVenta: Number(p.precioVenta)
          })),
          comprasHistoricas: [],
          ventasHistoricas: [],
          aportes: [],
          cajaInicial: cajaInicial.map(c => ({
            accountId: c.id,
            accountName: c.name,
            accountType: c.type,
            isNewAccount: c.isNew,
            amount: Number(c.amount)
          })),
          clientesIniciales: clientesDeudas.map(cl => ({
            customerId: cl.id,
            customerName: cl.name,
            isNewCustomer: cl.isNew,
            saldo: Number(cl.saldo),
            observaciones: cl.observaciones
          })),
          proveedoresIniciales: proveedoresDeudas.map(pr => ({
            supplierId: pr.id,
            supplierName: pr.name,
            isNewSupplier: pr.isNew,
            saldo: Number(pr.saldo),
            observaciones: pr.observaciones
          })),
          ajusteDiferenciaBalance: totals.diferenciaBalance
        };

        await initialLoadRepository.executeSaldosAdjustment(payload, currentBalances);
      }
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al procesar la carga/ajuste inicial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="asistente-container">
      <div className="asistente-header">
        <div className="asistente-icon-wrapper">
          <Sparkles size={24} color="#fff" />
        </div>
        <div>
          <h1 className="asistente-title">
            {queryMode === 'initial' ? 'Asistente de Configuración Inicial' : 'Herramienta de Ajuste de Saldos'}
          </h1>
          <p className="asistente-subtitle">
            {queryMode === 'initial' 
              ? 'Carga completa de saldos de negocio en marcha' 
              : 'Corregir saldos del sistema mediante movimientos de ajuste'}
          </p>
        </div>
      </div>

      {isReadOnly && (
        <div className="asistente-error-alert" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#b45309' }}>
          <Lock size={20} />
          <div>
            <strong>Bloqueado:</strong> La migración inicial ya fue ejecutada. Utilice la herramienta de "Ajuste de Saldos" desde Configuración.
          </div>
        </div>
      )}

      {/* Steppers */}
      <div className="stepper-bar">
        {activeSteps.map(s => (
          <div key={s.num} className={`step-item ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}>
            <div className="step-circle">{s.icon}</div>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="asistente-error-alert">
          <Info size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {success ? (
        <div className="asistente-success-card">
          <CheckCircle size={60} color="var(--success-color, #24b47e)" />
          <h2>¡Proceso Completado con Éxito!</h2>
          <p>
            {queryMode === 'initial' 
              ? 'La migración inicial se ha cargado de manera atómica.' 
              : 'Se han generado los movimientos de ajuste por diferencia SALDO_INICIAL_MIGRACION.'}
          </p>
          <button className="asistente-btn-primary" onClick={() => navigate('/dashboard')}>
            Ir al Dashboard Principal
          </button>
        </div>
      ) : (
        <div className="asistente-card">
          {/* STEP 1: Fecha de Corte (Modo A y B) */}
          {step === 1 && (
            <div className="step-content">
              <h3>Definición de Fecha de Corte</h3>
              <p className="step-desc">
                Establece la fecha límite de la migración. Las compras y ventas anteriores se considerarán históricas.
              </p>
              <div className="form-group-corte">
                <label>Fecha de Corte</label>
                <input 
                  type="date" 
                  value={fechaCorte} 
                  onChange={e => setFechaCorte(e.target.value)} 
                  className="input-corte"
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}

          {/* PASO 2 (Modo A): Socios - Subtabla de Movimientos Multiconcepto */}
          {queryMode === 'initial' && step === 2 && (
            <div className="step-content">
              <h3>Socios y Aportes Multiconcepto</h3>
              <p className="step-desc">Registre aportes de capital y préstamos individuales para cada uno de los socios fundadores.</p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <select 
                  className="table-select" 
                  style={{ maxWidth: '250px' }}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const sh = shareholders.find(s => s.id === val);
                      if (sh && !aportesSocios.some(s => s.id === sh.id)) {
                        setAportesSocios([...aportesSocios, {
                          id: sh.id,
                          name: sh.nombre,
                          isNew: false,
                          movements: []
                        }]);
                      }
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Vincular Socio Existente --</option>
                  {shareholders.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                <button className="asistente-btn-secondary" onClick={() => setShowInlineModal('socio')}>
                  <Plus size={16} /> + Crear Socio Nuevo
                </button>
              </div>

              {aportesSocios.map((socio, idx) => {
                const shAportesTotal = (socio.movements || []).filter(m => m.tipo === 'APORTE').reduce((sum, m) => sum + m.amount, 0);
                const shLoansTotal = (socio.movements || []).filter(m => m.tipo === 'PRESTAMO').reduce((sum, m) => sum + m.amount, 0);

                return (
                  <div key={socio.id} className="apple-card" style={{ padding: '20px', marginBottom: '24px', backgroundColor: '#fafafa', border: '1px solid #e5e5ea' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700 }}>👤 Socio: {socio.name}</span>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                        <div>Total Aportado: <strong style={{ color: '#16a34a' }}>${shAportesTotal.toLocaleString()}</strong></div>
                        <div>Total Prestado: <strong style={{ color: '#2563eb' }}>${shLoansTotal.toLocaleString()}</strong></div>
                        <button className="btn-icon-danger" onClick={() => setAportesSocios(aportesSocios.filter(s => s.id !== socio.id))}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <table className="asistente-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Clase de Aporte</th>
                          <th>Concepto / Observaciones</th>
                          <th>Monto / Valor Asignado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(socio.movements || []).map((mov, movIdx) => (
                          <tr key={mov.id}>
                            <td>
                              <input 
                                type="date" 
                                value={mov.date} 
                                onChange={e => {
                                  const newS = [...aportesSocios];
                                  newS[idx].movements[movIdx].date = e.target.value;
                                  setAportesSocios(newS);
                                }}
                                className="table-input"
                              />
                            </td>
                            <td>
                              <select
                                value={mov.tipo}
                                onChange={e => {
                                  const newS = [...aportesSocios];
                                  newS[idx].movements[movIdx].tipo = e.target.value as any;
                                  if (e.target.value === 'APORTE') {
                                    newS[idx].movements[movIdx].tipoAporte = 'DINERO';
                                    newS[idx].movements[movIdx].descripcionBien = '';
                                  } else {
                                    delete newS[idx].movements[movIdx].tipoAporte;
                                    delete newS[idx].movements[movIdx].descripcionBien;
                                  }
                                  setAportesSocios(newS);
                                }}
                                className="table-select"
                              >
                                <option value="APORTE">APORTE (Capital)</option>
                                <option value="PRESTAMO">PRESTAMO (Pasivo)</option>
                              </select>
                            </td>
                            <td>
                              {mov.tipo === 'APORTE' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <select
                                    value={mov.tipoAporte || 'DINERO'}
                                    onChange={e => {
                                      const newS = [...aportesSocios];
                                      newS[idx].movements[movIdx].tipoAporte = e.target.value as any;
                                      setAportesSocios(newS);
                                    }}
                                    className="table-select"
                                  >
                                    <option value="DINERO">Dinero</option>
                                    <option value="BIEN">Bien Físico</option>
                                  </select>
                                  {mov.tipoAporte === 'BIEN' && (
                                    <input 
                                      type="text" 
                                      value={mov.descripcionBien || ''} 
                                      onChange={e => {
                                        const newS = [...aportesSocios];
                                        newS[idx].movements[movIdx].descripcionBien = e.target.value;
                                        setAportesSocios(newS);
                                      }}
                                      className="table-input"
                                      placeholder="Descripción (Cámara, Auto...)"
                                    />
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)' }}>--</span>
                              )}
                            </td>
                            <td>
                              <input 
                                type="text" 
                                value={mov.concepto} 
                                onChange={e => {
                                  const newS = [...aportesSocios];
                                  newS[idx].movements[movIdx].concepto = e.target.value;
                                  setAportesSocios(newS);
                                }}
                                className="table-input"
                                placeholder={mov.tipoAporte === 'BIEN' ? "Obs del bien..." : "Ej: Efectivo..."}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                value={mov.amount || ''} 
                                onChange={e => {
                                  const newS = [...aportesSocios];
                                  newS[idx].movements[movIdx].amount = Number(e.target.value);
                                  setAportesSocios(newS);
                                }}
                                className="table-input"
                                placeholder={mov.tipoAporte === 'BIEN' ? "Valor Asignado" : "$ Monto"}
                              />
                            </td>
                            <td>
                              <button 
                                className="btn-icon-danger" 
                                onClick={() => {
                                  const newS = [...aportesSocios];
                                  newS[idx].movements = newS[idx].movements.filter(m => m.id !== mov.id);
                                  setAportesSocios(newS);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <button 
                      className="asistente-btn-secondary add-row-btn"
                      onClick={() => {
                        const newS = [...aportesSocios];
                        newS[idx].movements.push({
                          id: `mov-${Date.now()}-${Math.random()}`,
                          date: fechaCorte,
                          tipo: 'APORTE',
                          concepto: '',
                          amount: 0
                        });
                        setAportesSocios(newS);
                      }}
                    >
                      + Agregar Movimiento
                    </button>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '15px', fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div>Total General Capital Aportado: <span style={{ color: '#16a34a' }}>${totals.totalAportes.toLocaleString()}</span></div>
                <div>Total General Préstamos: <span style={{ color: '#2563eb' }}>${totals.totalPrestamos.toLocaleString()}</span></div>
              </div>
            </div>
          )}

          {/* PASO 3 (Modo A) / PASO 2 (Modo B): Caja y Cuentas */}
          {((queryMode === 'initial' && step === 3) || (queryMode === 'adjust' && step === 2)) && (
            <div className="step-content">
              <h3>Caja e Inicialización de Saldos Financieros</h3>
              <p className="step-desc">Declare el balance de sus cuentas financieras al momento de corte.</p>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Tipo</th>
                    <th>Saldo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cajaInicial.map((row, index) => (
                    <tr key={row.id}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.type}</td>
                      <td>
                        <input 
                          type="number" 
                          value={row.amount || ''} 
                          onChange={e => {
                            const newC = [...cajaInicial];
                            newC[index].amount = Number(e.target.value);
                            setCajaInicial(newC);
                          }}
                          className="table-input"
                          placeholder="$ 0"
                        />
                      </td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => setCajaInicial(cajaInicial.filter(c => c.id !== row.id))}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="table-select" 
                  style={{ maxWidth: '250px' }}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const acc = accounts.find(a => a.id === val);
                      if (acc && !cajaInicial.some(c => c.id === acc.id)) {
                        setCajaInicial([...cajaInicial, {
                          id: acc.id,
                          name: acc.nombre,
                          type: acc.tipo,
                          isNew: false,
                          amount: 0
                        }]);
                      }
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Vincular Cuenta Existente --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>
                  ))}
                </select>
                <button className="asistente-btn-secondary" onClick={() => setShowInlineModal('cuenta')}>
                  <Plus size={16} /> + Crear Cuenta Nueva
                </button>
              </div>
            </div>
          )}

          {/* PASO 4 (Modo A) / PASO 3 (Modo B): Clientes con deuda */}
          {((queryMode === 'initial' && step === 4) || (queryMode === 'adjust' && step === 3)) && (
            <div className="step-content">
              <h3>Clientes con Saldo Pendiente</h3>
              <p className="step-desc">Registre los saldos deudores de clientes en cuenta corriente.</p>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Saldo Pendiente</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesDeudas.map((row, index) => (
                    <tr key={row.id}>
                      <td><strong>{row.name}</strong></td>
                      <td>
                        <input 
                          type="number" 
                          value={row.saldo || ''} 
                          onChange={e => {
                            const newC = [...clientesDeudas];
                            newC[index].saldo = Number(e.target.value);
                            setClientesDeudas(newC);
                          }}
                          className="table-input"
                          placeholder="$ 0"
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          value={row.observaciones} 
                          onChange={e => {
                            const newC = [...clientesDeudas];
                            newC[index].observaciones = e.target.value;
                            setClientesDeudas(newC);
                          }}
                          className="table-input"
                          placeholder="Obs..."
                        />
                      </td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => setClientesDeudas(clientesDeudas.filter(c => c.id !== row.id))}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="table-select" 
                  style={{ maxWidth: '250px' }}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const cust = customers.find(c => c.id === val);
                      if (cust && !clientesDeudas.some(c => c.id === cust.id)) {
                        setClientesDeudas([...clientesDeudas, {
                          id: cust.id,
                          name: cust.nombre,
                          isNew: false,
                          saldo: 0,
                          observaciones: ''
                        }]);
                      }
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Vincular Cliente Existente --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <button className="asistente-btn-secondary" onClick={() => setShowInlineModal('cliente')}>
                  <Plus size={16} /> + Crear Cliente Nuevo
                </button>
              </div>
            </div>
          )}

          {/* PASO 5 (Modo A) / PASO 4 (Modo B): Proveedores con deuda */}
          {((queryMode === 'initial' && step === 5) || (queryMode === 'adjust' && step === 4)) && (
            <div className="step-content">
              <h3>Proveedores con Saldo Pendiente</h3>
              <p className="step-desc">Registre los saldos deudores con proveedores (Cuentas a Pagar).</p>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Saldo Pendiente</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedoresDeudas.map((row, index) => (
                    <tr key={row.id}>
                      <td><strong>{row.name}</strong></td>
                      <td>
                        <input 
                          type="number" 
                          value={row.saldo || ''} 
                          onChange={e => {
                            const newP = [...proveedoresDeudas];
                            newP[index].saldo = Number(e.target.value);
                            setProveedoresDeudas(newP);
                          }}
                          className="table-input"
                          placeholder="$ 0"
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          value={row.observaciones} 
                          onChange={e => {
                            const newP = [...proveedoresDeudas];
                            newP[index].observaciones = e.target.value;
                            setProveedoresDeudas(newP);
                          }}
                          className="table-input"
                          placeholder="Obs..."
                        />
                      </td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => setProveedoresDeudas(proveedoresDeudas.filter(p => p.id !== row.id))}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="table-select" 
                  style={{ maxWidth: '250px' }}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const supp = suppliers.find(s => s.id === val);
                      if (supp && !proveedoresDeudas.some(p => p.id === supp.id)) {
                        setProveedoresDeudas([...proveedoresDeudas, {
                          id: supp.id,
                          name: supp.nombre,
                          isNew: false,
                          saldo: 0,
                          observaciones: ''
                        }]);
                      }
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Vincular Proveedor Existente --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                <button className="asistente-btn-secondary" onClick={() => setShowInlineModal('proveedor')}>
                  <Plus size={16} /> + Crear Proveedor Nuevo
                </button>
              </div>
            </div>
          )}

          {/* PASO 6 (Modo A) / PASO 5 (Modo B): Stock Materias Primas */}
          {((queryMode === 'initial' && step === 6) || (queryMode === 'adjust' && step === 5)) && (
            <div className="step-content">
              <h3>Stock Físico Inicial de Materias Primas & Insumos</h3>
              <p className="step-desc">Establezca el inventario de materias primas e insumos (cálculo auto de subtotal y total).</p>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                    <th>Costo Unitario</th>
                    <th>Subtotal</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMP.map((row, index) => {
                    const prod = products.find(p => p.id === row.productId);
                    return (
                      <tr key={row.productId}>
                        <td><strong>{prod?.nombre || 'Desconocido'}</strong></td>
                        <td>{prod?.unitType || 'KG'}</td>
                        <td>
                          <input 
                            type="number" 
                            value={row.stockFisico || ''} 
                            onChange={e => {
                              const newS = [...stockMP];
                              newS[index].stockFisico = Number(e.target.value);
                              setStockMP(newS);
                            }}
                            className="table-input"
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            value={row.costoUnitario || ''} 
                            onChange={e => {
                              const newS = [...stockMP];
                              newS[index].costoUnitario = Number(e.target.value);
                              setStockMP(newS);
                            }}
                            className="table-input"
                            placeholder="$ 0.00"
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          ${(row.stockFisico * row.costoUnitario).toFixed(2)}
                        </td>
                        <td>
                          <button className="btn-icon-danger" onClick={() => setStockMP(stockMP.filter(s => s.productId !== row.productId))}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <select 
                  className="table-select" 
                  style={{ maxWidth: '300px' }}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const p = products.find(prod => prod.id === val);
                      if (p && !stockMP.some(s => s.productId === p.id)) {
                        setStockMP([...stockMP, {
                          productId: p.id,
                          stockFisico: 0,
                          costoUnitario: p.costoActual || 0
                        }]);
                      }
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Seleccionar Materia Prima / Insumo --</option>
                  {products.filter(p => p.type === 'MERCADERIA' || p.type === 'INSUMO').map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.unitType})</option>
                  ))}
                </select>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                  Total MP Valorizado: <span style={{ color: 'var(--alvacio-red)' }}>${totals.totalStockMP.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* PASO 7 (Modo A) / PASO 6 (Modo B): Stock Presentaciones */}
          {((queryMode === 'initial' && step === 7) || (queryMode === 'adjust' && step === 6)) && (
            <div className="step-content">
              <h3>Stock Físico Inicial de Presentaciones Terminadas</h3>
              <p className="step-desc">Cargue el inventario de elaboraciones listas para despacho con control físico de peso real.</p>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Presentación</th>
                    <th>Cantidad (u)</th>
                    <th>Peso Promedio</th>
                    <th>Unidad</th>
                    <th>Peso Total</th>
                    <th>Costo Real</th>
                    <th>Precio Venta</th>
                    <th>M. Potencial</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stockPresentaciones.map((row, index) => {
                    const prod = products.find(p => p.id === row.productId);
                    const weightTotal = row.cantidad * row.pesoPromedio;
                    const costTotal = row.cantidad * row.costoUnitario;
                    const saleTotal = row.cantidad * row.precioVenta;
                    const margin = saleTotal - costTotal;

                    return (
                      <tr key={row.productId}>
                        <td><strong>{prod?.nombre || 'Desconocido'}</strong></td>
                        <td>
                          <input 
                            type="number" 
                            value={row.cantidad || ''} 
                            onChange={e => {
                              const newS = [...stockPresentaciones];
                              newS[index].cantidad = Number(e.target.value);
                              setStockPresentaciones(newS);
                            }}
                            className="table-input"
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            step="0.001"
                            value={row.pesoPromedio || ''} 
                            onChange={e => {
                              const newS = [...stockPresentaciones];
                              newS[index].pesoPromedio = Number(e.target.value);
                              setStockPresentaciones(newS);
                            }}
                            className="table-input"
                            placeholder="0.15"
                          />
                        </td>
                        <td>
                          <select
                            value={row.unidadMedida}
                            onChange={e => {
                              const newS = [...stockPresentaciones];
                              newS[index].unidadMedida = e.target.value as any;
                              setStockPresentaciones(newS);
                            }}
                            className="table-select"
                          >
                            <option value="KG">KG</option>
                            <option value="UNIDADES">UNIDADES</option>
                          </select>
                        </td>
                        <td style={{ fontWeight: 600 }}>{weightTotal.toFixed(3)} Kg</td>
                        <td>
                          <input 
                            type="number" 
                            value={row.costoUnitario || ''} 
                            onChange={e => {
                              const newS = [...stockPresentaciones];
                              newS[index].costoUnitario = Number(e.target.value);
                              setStockPresentaciones(newS);
                            }}
                            className="table-input"
                            placeholder="$ 0"
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            value={row.precioVenta || ''} 
                            onChange={e => {
                              const newS = [...stockPresentaciones];
                              newS[index].precioVenta = Number(e.target.value);
                              setStockPresentaciones(newS);
                            }}
                            className="table-input"
                            placeholder="$ 0"
                          />
                        </td>
                        <td style={{ color: margin >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                          ${margin.toFixed(2)}
                        </td>
                        <td>
                          <button className="btn-icon-danger" onClick={() => setStockPresentaciones(stockPresentaciones.filter(s => s.productId !== row.productId))}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <select 
                  className="table-select" 
                  style={{ maxWidth: '300px' }}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const p = products.find(prod => prod.id === val);
                      if (p && !stockPresentaciones.some(s => s.productId === p.id)) {
                        setStockPresentaciones([...stockPresentaciones, {
                          productId: p.id,
                          cantidad: 0,
                          pesoPromedio: p.pesoObjetivoKg || p.pesoObjetivoGramos ? (p.pesoObjetivoKg || (p.pesoObjetivoGramos ? p.pesoObjetivoGramos / 1000 : 0.15)) : 0.15,
                          unidadMedida: p.unitType === 'KG' ? 'KG' : 'UNIDADES',
                          costoUnitario: 0,
                          precioVenta: p.precioComercial || 0
                        }]);
                      }
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Seleccionar Presentación Terminada --</option>
                  {products.filter(p => p.type === 'PRESENTACION').map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Peso Total: <strong>{totals.totalWeightPres.toFixed(3)} Kg</strong></div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    Total Costo Presentaciones: <span style={{ color: 'var(--alvacio-red)' }}>${totals.totalStockPresCosto.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 8 (Modo A): Compras Históricas Detalladas */}
          {queryMode === 'initial' && step === 8 && (
            <div className="step-content">
              <h3>Compras Históricas a Migrar (Pre-Sistema)</h3>
              <p className="step-desc">Registre compras realizadas antes de la fecha de corte. Especifique el detalle de productos para reconstruir costos.</p>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button 
                  className="asistente-btn-secondary"
                  onClick={() => {
                    const tempId = `compra-${Date.now()}`;
                    setComprasHist([...comprasHist, {
                      id: tempId,
                      supplierId: '',
                      supplierName: '',
                      isNewSupplier: false,
                      date: fechaCorte,
                      estado: 'PAGADA',
                      paymentType: 'CUENTA',
                      total: 0,
                      pagado: 0,
                      observaciones: '',
                      items: []
                    }]);
                  }}
                >
                  <Plus size={16} /> + Agregar Compra
                </button>
              </div>

              {comprasHist.map((comp, idx) => (
                <div key={comp.id} className="apple-card" style={{ padding: '20px', marginBottom: '24px', backgroundColor: '#fafafa', border: '1px solid #e5e5ea' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Proveedor</label>
                      <select
                        value={comp.supplierId}
                        onChange={e => {
                          const val = e.target.value;
                          const newC = [...comprasHist];
                          const suppObj = suppliers.find(s => s.id === val);
                          newC[idx].supplierId = val;
                          newC[idx].supplierName = suppObj?.nombre || '';
                          setComprasHist(newC);
                        }}
                        className="table-select"
                      >
                        <option value="">-- Seleccionar --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha</label>
                      <input 
                        type="date" 
                        value={comp.date} 
                        onChange={e => {
                          const newC = [...comprasHist];
                          newC[idx].date = e.target.value;
                          setComprasHist(newC);
                        }}
                        className="table-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Estado Pago</label>
                      <select
                        value={comp.estado}
                        onChange={e => {
                          const newC = [...comprasHist];
                          const est = e.target.value as any;
                          newC[idx].estado = est;
                          if (est === 'PAGADA') newC[idx].pagado = newC[idx].total;
                          if (est === 'PENDIENTE') newC[idx].pagado = 0;
                          setComprasHist(newC);
                        }}
                        className="table-select"
                      >
                        <option value="PAGADA">PAGADA</option>
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="PARCIALMENTE PAGADA">PARCIALMENTE PAGADA</option>
                      </select>
                    </div>
                    {comp.estado !== 'PENDIENTE' && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Forma de Pago</label>
                        <select
                          value={comp.paymentType || 'CUENTA'}
                          onChange={e => {
                            const newC = [...comprasHist];
                            newC[idx].paymentType = e.target.value as any;
                            setComprasHist(newC);
                          }}
                          className="table-select"
                        >
                          <option value="CUENTA">Cuenta Financiera</option>
                          <option value="APORTE_SOCIO">Aporte de Socio</option>
                        </select>
                      </div>
                    )}
                    {comp.estado !== 'PENDIENTE' && comp.paymentType === 'CUENTA' && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cuenta de Pago</label>
                        <select
                          value={comp.cuentaId || ''}
                          onChange={e => {
                            const newC = [...comprasHist];
                            newC[idx].cuentaId = e.target.value;
                            setComprasHist(newC);
                          }}
                          className="table-select"
                        >
                          <option value="">-- Seleccionar Cuenta --</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    {comp.estado !== 'PENDIENTE' && comp.paymentType === 'APORTE_SOCIO' && (
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Socio Aportante</label>
                        <select
                          value={comp.socioId || ''}
                          onChange={e => {
                            const newC = [...comprasHist];
                            newC[idx].socioId = e.target.value;
                            setComprasHist(newC);
                          }}
                          className="table-select"
                        >
                          <option value="">-- Seleccionar Socio --</option>
                          {aportesSocios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Concepto / Observaciones de la Compra</label>
                    <input 
                      type="text" 
                      value={comp.observaciones} 
                      onChange={e => {
                        const newC = [...comprasHist];
                        newC[idx].observaciones = e.target.value;
                        setComprasHist(newC);
                      }}
                      className="table-input"
                      placeholder="Ej: Balanza aportada por Lucas / Insumos iniciales..."
                    />
                  </div>

                  <h5 style={{ margin: '12px 0 6px 0', fontSize: '13px', fontWeight: 700 }}>Detalle de Productos Comprados</h5>
                  <table className="asistente-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Unidad</th>
                        <th>Costo Unitario Real</th>
                        <th>Subtotal</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comp.items.map((it, itIdx) => (
                        <tr key={itIdx}>
                          <td>
                            <select
                              value={it.productId}
                              onChange={e => {
                                const newC = [...comprasHist];
                                const p = products.find(prod => prod.id === e.target.value);
                                newC[idx].items[itIdx].productId = e.target.value;
                                newC[idx].items[itIdx].unidad = p?.unitType || 'KG';
                                setComprasHist(newC);
                              }}
                              className="table-select"
                            >
                              <option value="">-- Seleccionar --</option>
                              {products.filter(p => p.type === 'MERCADERIA' || p.type === 'INSUMO').map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input 
                              type="number" 
                              value={it.cantidad || ''} 
                              onChange={e => {
                                const newC = [...comprasHist];
                                const cant = Number(e.target.value);
                                newC[idx].items[itIdx].cantidad = cant;
                                newC[idx].items[itIdx].subtotal = cant * newC[idx].items[itIdx].costoUnitario;
                                // Recalcular total de compra
                                newC[idx].total = newC[idx].items.reduce((sum, item) => sum + item.subtotal, 0);
                                if (newC[idx].estado === 'PAGADA') newC[idx].pagado = newC[idx].total;
                                setComprasHist(newC);
                              }}
                              className="table-input"
                              placeholder="0"
                            />
                          </td>
                          <td>{it.unidad}</td>
                          <td>
                            <input 
                              type="number" 
                              value={it.costoUnitario || ''} 
                              onChange={e => {
                                const newC = [...comprasHist];
                                const cost = Number(e.target.value);
                                newC[idx].items[itIdx].costoUnitario = cost;
                                newC[idx].items[itIdx].subtotal = newC[idx].items[itIdx].cantidad * cost;
                                newC[idx].total = newC[idx].items.reduce((sum, item) => sum + item.subtotal, 0);
                                if (newC[idx].estado === 'PAGADA') newC[idx].pagado = newC[idx].total;
                                setComprasHist(newC);
                              }}
                              className="table-input"
                              placeholder="$ 0.00"
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>${it.subtotal.toFixed(2)}</td>
                          <td>
                            <button 
                              className="btn-icon-danger" 
                              onClick={() => {
                                const newC = [...comprasHist];
                                newC[idx].items = newC[idx].items.filter((_, i) => i !== itIdx);
                                newC[idx].total = newC[idx].items.reduce((sum, item) => sum + item.subtotal, 0);
                                if (newC[idx].estado === 'PAGADA') newC[idx].pagado = newC[idx].total;
                                setComprasHist(newC);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button 
                      className="asistente-btn-secondary add-row-btn"
                      onClick={() => {
                        const newC = [...comprasHist];
                        newC[idx].items.push({
                          productId: '',
                          cantidad: 0,
                          unidad: 'KG',
                          costoUnitario: 0,
                          subtotal: 0
                        });
                        setComprasHist(newC);
                      }}
                    >
                      + Agregar Producto
                    </button>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                      {comp.estado === 'PARCIALMENTE PAGADA' && (
                        <div>
                          Importe Pagado: 
                          <input 
                            type="number"
                            value={comp.pagado || ''}
                            onChange={e => {
                              const newC = [...comprasHist];
                              newC[idx].pagado = Number(e.target.value);
                              setComprasHist(newC);
                            }}
                            className="table-input"
                            style={{ width: '100px', display: 'inline-block', marginLeft: '6px' }}
                          />
                        </div>
                      )}
                      <div style={{ alignSelf: 'center' }}>Saldo Pendiente: <strong>${(comp.total - comp.pagado).toFixed(2)}</strong></div>
                      <div style={{ alignSelf: 'center', fontSize: '15px' }}>Total Compra: <strong style={{ color: 'var(--alvacio-red)' }}>${comp.total.toFixed(2)}</strong></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button className="btn-icon-danger" onClick={() => setComprasHist(comprasHist.filter(c => c.id !== comp.id))}>
                      <Trash2 size={16} /> Eliminar Compra
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PASO 9 (Modo A): Ventas Históricas Detalladas (SIN Selección de Cuenta de Cobro) */}
          {queryMode === 'initial' && step === 9 && (
            <div className="step-content">
              <h3>Ventas Históricas a Migrar (Pre-Sistema)</h3>
              <p className="step-desc">Registre ventas para análisis de rentabilidad real con precios y costos de mercadería fijos congelados.</p>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button 
                  className="asistente-btn-secondary"
                  onClick={() => {
                    const tempId = `venta-${Date.now()}`;
                    setVentasHist([...ventasHist, {
                      id: tempId,
                      customerId: '',
                      customerName: '',
                      isNewCustomer: false,
                      date: fechaCorte,
                      estado: 'COBRADA',
                      total: 0,
                      cobrado: 0,
                      observaciones: '',
                      items: []
                    }]);
                  }}
                >
                  <Plus size={16} /> + Agregar Venta
                </button>
              </div>

              {ventasHist.map((vent, idx) => (
                <div key={vent.id} className="apple-card" style={{ padding: '20px', marginBottom: '24px', backgroundColor: '#fafafa', border: '1px solid #e5e5ea' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cliente</label>
                      <select
                        value={vent.customerId}
                        onChange={e => {
                          const val = e.target.value;
                          const newV = [...ventasHist];
                          const custObj = customers.find(c => c.id === val);
                          newV[idx].customerId = val;
                          newV[idx].customerName = custObj?.nombre || '';
                          setVentasHist(newV);
                        }}
                        className="table-select"
                      >
                        <option value="">-- Seleccionar --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha</label>
                      <input 
                        type="date" 
                        value={vent.date} 
                        onChange={e => {
                          const newV = [...ventasHist];
                          newV[idx].date = e.target.value;
                          setVentasHist(newV);
                        }}
                        className="table-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Estado Cobro</label>
                      <select
                        value={vent.estado}
                        onChange={e => {
                          const newV = [...ventasHist];
                          const est = e.target.value as any;
                          newV[idx].estado = est;
                          if (est === 'COBRADA') newV[idx].cobrado = newV[idx].total;
                          if (est === 'PENDIENTE') newV[idx].cobrado = 0;
                          setVentasHist(newV);
                        }}
                        className="table-select"
                      >
                        <option value="COBRADA">COBRADA</option>
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="PARCIALMENTE COBRADA">PARCIALMENTE COBRADA</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Estado Entrega</label>
                      <select
                        value={vent.deliveryStatus || 'REGISTRADA'}
                        onChange={e => {
                          const newV = [...ventasHist];
                          newV[idx].deliveryStatus = e.target.value as any;
                          setVentasHist(newV);
                        }}
                        className="table-select"
                      >
                        <option value="REGISTRADA">Registrada</option>
                        <option value="PENDIENTE">Lista para preparar</option>
                        <option value="ENTREGADO">Entregada</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="radio" 
                        name={`tipoMode-${vent.id}`} 
                        checked={vent.tipoMode !== 'RESUMIDA'} 
                        onChange={() => {
                          const newV = [...ventasHist];
                          newV[idx].tipoMode = 'DETALLADA';
                          setVentasHist(newV);
                        }} 
                      />
                      Modalidad Detallada (Producto por Producto)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="radio" 
                        name={`tipoMode-${vent.id}`} 
                        checked={vent.tipoMode === 'RESUMIDA'} 
                        onChange={() => {
                          const newV = [...ventasHist];
                          newV[idx].tipoMode = 'RESUMIDA';
                          setVentasHist(newV);
                        }} 
                      />
                      Modalidad Resumida (Carga Rápida)
                    </label>
                  </div>

                  {vent.tipoMode === 'RESUMIDA' ? (
                    <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Presentación</label>
                          <select
                            value={vent.productId || ''}
                            onChange={e => {
                              const newV = [...ventasHist];
                              newV[idx].productId = e.target.value;
                              setVentasHist(newV);
                            }}
                            className="table-select"
                            required
                          >
                            <option value="">-- Seleccionar --</option>
                            {products.filter(p => p.type === 'PRESENTACION').map(p => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Cantidad vendida (u)</label>
                          <input 
                            type="number" 
                            value={vent.cantidad || ''} 
                            onChange={e => {
                              const newV = [...ventasHist];
                              newV[idx].cantidad = Number(e.target.value);
                              if (newV[idx].estado === 'COBRADA') newV[idx].cobrado = newV[idx].total;
                              setVentasHist(newV);
                            }}
                            className="table-input"
                            placeholder="0"
                            min="1"
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Facturación total ($)</label>
                          <input 
                            type="number" 
                            value={vent.total || ''} 
                            onChange={e => {
                              const newV = [...ventasHist];
                              const tot = Number(e.target.value);
                              newV[idx].total = tot;
                              if (newV[idx].estado === 'COBRADA') newV[idx].cobrado = tot;
                              setVentasHist(newV);
                            }}
                            className="table-input"
                            placeholder="$ 0.00"
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Costo total ($)</label>
                          <input 
                            type="number" 
                            value={vent.costoTotal || ''} 
                            onChange={e => {
                              const newV = [...ventasHist];
                              newV[idx].costoTotal = Number(e.target.value);
                              setVentasHist(newV);
                            }}
                            className="table-input"
                            placeholder="$ 0.00"
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                        <div>Ganancia: <strong style={{ color: (vent.total - (vent.costoTotal || 0)) >= 0 ? '#16a34a' : '#ef4444' }}>${(vent.total - (vent.costoTotal || 0)).toFixed(2)}</strong></div>
                        <div>Margen Bruto: <strong>{vent.total > 0 ? (((vent.total - (vent.costoTotal || 0)) / vent.total) * 100).toFixed(1) : 0}%</strong></div>
                        <div>P. Unit. Promedio: <strong>{vent.cantidad && vent.cantidad > 0 ? `$${(vent.total / vent.cantidad).toFixed(2)}` : '$0.00'}</strong></div>
                        <div>C. Unit. Promedio: <strong>{vent.cantidad && vent.cantidad > 0 ? `$${((vent.costoTotal || 0) / vent.cantidad).toFixed(2)}` : '$0.00'}</strong></div>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Observaciones</label>
                        <input 
                          type="text" 
                          value={vent.observaciones} 
                          onChange={e => {
                            const newV = [...ventasHist];
                            newV[idx].observaciones = e.target.value;
                            setVentasHist(newV);
                          }}
                          className="table-input"
                          placeholder="Obs..."
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h5 style={{ margin: '12px 0 6px 0', fontSize: '13px', fontWeight: 700 }}>Detalle de Productos Vendidos</h5>
                      <table className="asistente-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Presentación</th>
                            <th>Cantidad (u)</th>
                            <th>Precio Venta Real</th>
                            <th>Costo Histórico Unitario</th>
                            <th>Subtotal</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vent.items.map((it, itIdx) => (
                            <tr key={itIdx}>
                              <td>
                                <select
                                  value={it.productId}
                                  onChange={e => {
                                    const newV = [...ventasHist];
                                    const p = products.find(prod => prod.id === e.target.value);
                                    newV[idx].items[itIdx].productId = e.target.value;
                                    newV[idx].items[itIdx].precioUnitario = p?.precioComercial || 0;
                                    setVentasHist(newV);
                                  }}
                                  className="table-select"
                                >
                                  <option value="">-- Seleccionar --</option>
                                  {products.filter(p => p.type === 'PRESENTACION').map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  value={it.cantidad || ''} 
                                  onChange={e => {
                                    const newV = [...ventasHist];
                                    const cant = Number(e.target.value);
                                    newV[idx].items[itIdx].cantidad = cant;
                                    newV[idx].items[itIdx].subtotal = cant * newV[idx].items[itIdx].precioUnitario;
                                    newV[idx].total = newV[idx].items.reduce((sum, item) => sum + item.subtotal, 0);
                                    if (newV[idx].estado === 'COBRADA') newV[idx].cobrado = newV[idx].total;
                                    setVentasHist(newV);
                                  }}
                                  className="table-input"
                                  placeholder="0"
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  value={it.precioUnitario || ''} 
                                  onChange={e => {
                                    const newV = [...ventasHist];
                                    const pr = Number(e.target.value);
                                    newV[idx].items[itIdx].precioUnitario = pr;
                                    newV[idx].items[itIdx].subtotal = newV[idx].items[itIdx].cantidad * pr;
                                    newV[idx].total = newV[idx].items.reduce((sum, item) => sum + item.subtotal, 0);
                                    if (newV[idx].estado === 'COBRADA') newV[idx].cobrado = newV[idx].total;
                                    setVentasHist(newV);
                                  }}
                                  className="table-input"
                                  placeholder="$ 0.00"
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  value={it.costoUnitario || ''} 
                                  onChange={e => {
                                    const newV = [...ventasHist];
                                    newV[idx].items[itIdx].costoUnitario = Number(e.target.value);
                                    setVentasHist(newV);
                                  }}
                                  className="table-input"
                                  placeholder="$ 0.00"
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>${it.subtotal.toFixed(2)}</td>
                              <td>
                                <button 
                                  className="btn-icon-danger" 
                                  onClick={() => {
                                    const newV = [...ventasHist];
                                    newV[idx].items = newV[idx].items.filter((_, i) => i !== itIdx);
                                    newV[idx].total = newV[idx].items.reduce((sum, item) => sum + item.subtotal, 0);
                                    if (newV[idx].estado === 'COBRADA') newV[idx].cobrado = newV[idx].total;
                                    setVentasHist(newV);
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <button 
                          className="asistente-btn-secondary add-row-btn"
                          onClick={() => {
                            const newV = [...ventasHist];
                            newV[idx].items.push({
                              productId: '',
                              cantidad: 0,
                              precioUnitario: 0,
                              costoUnitario: 0,
                              subtotal: 0
                            });
                            setVentasHist(newV);
                          }}
                        >
                          + Agregar Producto
                        </button>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px', width: '100%', justifyContent: 'flex-end' }}>
                      {vent.estado === 'PARCIALMENTE COBRADA' && (
                        <div>
                          Importe Cobrado: 
                          <input 
                            type="number"
                            value={vent.cobrado || ''}
                            onChange={e => {
                              const newV = [...ventasHist];
                              newV[idx].cobrado = Number(e.target.value);
                              setVentasHist(newV);
                            }}
                            className="table-input"
                            style={{ width: '100px', display: 'inline-block', marginLeft: '6px' }}
                          />
                        </div>
                      )}
                      <div style={{ alignSelf: 'center' }}>Saldo Pendiente: <strong>${(vent.total - vent.cobrado).toFixed(2)}</strong></div>
                      <div style={{ alignSelf: 'center', fontSize: '15px' }}>Total Venta: <strong style={{ color: 'var(--alvacio-red)' }}>${vent.total.toFixed(2)}</strong></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button className="btn-icon-danger" onClick={() => setVentasHist(ventasHist.filter(v => v.id !== vent.id))}>
                      <Trash2 size={16} /> Eliminar Venta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PASO 10 (Modo A) / PASO 7 (Modo B): Validación y Balance General */}
          {((queryMode === 'initial' && step === 10) || (queryMode === 'adjust' && step === 7)) && (
            <div className="step-content">
              <h3>Validación Contable del Balance de Apertura</h3>
              <p className="step-desc">El balance contable muestra el total de activos, pasivos y patrimonio neto del negocio.</p>
              
              <div className="resumen-grid" style={{ marginBottom: '24px' }}>
                <div className="resumen-card">
                  <h4>Activo (Bienes y Derechos)</h4>
                  <ul>
                    <li>Caja y Bancos: <strong>${totals.totalCajas.toLocaleString()}</strong></li>
                    <li>Cuentas por Cobrar Clientes: <strong>${(totals.totalClientesCc + totals.ventasHistPendientes).toLocaleString()}</strong></li>
                    <li>Inventario de Materias Primas: <strong>${totals.totalStockMP.toLocaleString()}</strong></li>
                    <li>Inventario Presentaciones: <strong>${totals.totalStockPresCosto.toLocaleString()}</strong></li>
                    <li>Bienes Aportados Socios: <strong>${totals.totalAportesBienes.toLocaleString()}</strong></li>
                    <li style={{ borderTop: '1px solid #d2d2d7', paddingTop: '6px', fontSize: '14px' }}>Total Activos: <strong>${totals.activo.toLocaleString()}</strong></li>
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Pasivo y Patrimonio (Obligaciones y Capital)</h4>
                  <ul>
                    <li>Deudas con Proveedores: <strong>${(totals.totalProveedoresCc + totals.comprasHistDeuda).toLocaleString()}</strong></li>
                    <li>Préstamos de Socios: <strong>${totals.totalPrestamos.toLocaleString()}</strong></li>
                    <li>Capital Aportado Socios: <strong>${totals.totalAportes.toLocaleString()}</strong></li>
                    <li>Resultados Históricos CMV: <strong>${totals.ventasHistGanancia.toLocaleString()}</strong></li>
                    {totals.comprasHistAportadasSocios > 0 && (
                      <li>Aportes por Compras: <strong>${totals.comprasHistAportadasSocios.toLocaleString()}</strong></li>
                    )}
                    <li style={{ borderTop: '1px solid #d2d2d7', paddingTop: '6px', fontSize: '14px' }}>Total Pasivo + PN: <strong>${(totals.pasivo + totals.patrimonio).toLocaleString()}</strong></li>
                  </ul>
                </div>
              </div>

              {Math.abs(totals.diferenciaBalance) < 0.01 ? (
                <div className="corte-info-box" style={{ background: '#d1fae5', borderColor: '#10b981', color: '#065f46' }}>
                  <CheckCircle size={20} />
                  <div>
                    <h4>Balance Conciliado</h4>
                    <p>La ecuación de balance cuadra perfectamente con una diferencia de $0.00.</p>
                  </div>
                </div>
              ) : (
                <div className="corte-info-box warning-box">
                  <AlertTriangle size={20} />
                  <div>
                    <h4>Diferencia Detectada: ${totals.diferenciaBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    <p>
                      Existe un descuadre en el balance. Puede continuar; el sistema creará automáticamente la cuenta 
                      financiera <strong>"AJUSTE DE MIGRACIÓN"</strong> para absorber y balancear esta diferencia inicial.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 11 (Modo A): Resumen Final */}
          {queryMode === 'initial' && step === 11 && (
            <div className="step-content">
              <h3>Resumen General de Migración</h3>
              <p className="step-desc">Revise los valores finales consolidados antes de presionar Confirmar e Iniciar el ERP.</p>
              
              <div className="resumen-grid">
                <div className="resumen-card">
                  <h4>Patrimonio y Socios</h4>
                  <ul>
                    <li>Capital Socios (Dinero): <strong>${(totals.totalAportes - totals.totalAportesBienes).toLocaleString()}</strong></li>
                    <li>Bienes Aportados: <strong>${totals.totalAportesBienes.toLocaleString()}</strong></li>
                    <li>Préstamos Socios: <strong>${totals.totalPrestamos.toLocaleString()}</strong></li>
                    {totals.comprasHistAportadasSocios > 0 && (
                      <li>Capital por Compras: <strong>${totals.comprasHistAportadasSocios.toLocaleString()}</strong></li>
                    )}
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Caja y Bancos</h4>
                  <ul>
                    <li>Caja Consolidada: <strong>${totals.totalCajas.toLocaleString()}</strong></li>
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Cuentas Corrientes</h4>
                  <ul>
                    <li>Clientes por Cobrar: <strong>${(totals.totalClientesCc + totals.ventasHistPendientes).toLocaleString()}</strong></li>
                    <li>Proveedores por Pagar: <strong>${(totals.totalProveedoresCc + totals.comprasHistDeuda).toLocaleString()}</strong></li>
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Inventario y Stock</h4>
                  <ul>
                    <li>Materias Primas: <strong>${totals.totalStockMP.toLocaleString()}</strong></li>
                    <li>Presentaciones (Costo): <strong>${totals.totalStockPresCosto.toLocaleString()}</strong></li>
                    <li>Presentaciones (Venta): <strong>${totals.totalStockPresVenta.toLocaleString()}</strong></li>
                    <li>Kilos Totales: <strong>{totals.totalWeightPres.toFixed(3)} Kg</strong></li>
                  </ul>
                </div>
                <div className="resumen-card" style={{ gridColumn: 'span 2' }}>
                  <h4>Históricos y Validación</h4>
                  <ul>
                    <li>Ventas Migradas: <strong>${totals.ventasHistTotal.toLocaleString()}</strong></li>
                    <li>Compras Migradas: <strong>${totals.comprasHistTotal.toLocaleString()}</strong></li>
                    <li>Ganancia Histórica: <strong>${totals.ventasHistGanancia.toLocaleString()}</strong></li>
                    <li>Diferencia de Balance (Ajuste): <strong>${totals.diferenciaBalance.toLocaleString()}</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Card Actions */}
          <div className="asistente-card-actions">
            {step > 1 && (
              <button 
                className="asistente-btn-secondary" 
                onClick={() => setStep(step - 1)}
                disabled={loading}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
            )}
            
            {step < maxStep ? (
              <button 
                className="asistente-btn-primary" 
                onClick={() => setStep(step + 1)}
                style={{ marginLeft: 'auto' }}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            ) : (
              <button 
                className="asistente-btn-primary execute-btn" 
                onClick={handleExecute}
                disabled={loading || isReadOnly}
                style={{ marginLeft: 'auto', backgroundColor: isReadOnly ? '#d2d2d7' : undefined, cursor: isReadOnly ? 'not-allowed' : undefined }}
              >
                {loading ? 'Procesando...' : isReadOnly ? 'Migración Bloqueada' : 'Confirmar e Iniciar ERP'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- INLINE CREACIÓN MODAL --- */}
      {showInlineModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="apple-card" style={{ background: '#fff', padding: '32px', maxWidth: '450px', width: '100%', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>
              + Registrar Nuevo {showInlineModal.toUpperCase()}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Nombre / Razón Social</label>
                <input 
                  type="text" 
                  value={inlineData.nombre || ''}
                  onChange={e => handleNameChange(e.target.value, showInlineModal as any)}
                  className="table-input"
                  placeholder="Ej: Distribuidora Córdoba"
                />
              </div>

              {showInlineModal === 'cuenta' && (
                <div className="form-group">
                  <label>Tipo de Cuenta</label>
                  <select 
                    value={inlineData.tipo || 'EFECTIVO'}
                    onChange={e => setInlineData({ ...inlineData, tipo: e.target.value })}
                    className="table-select"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="BANCO">Banco</option>
                    <option value="BILLETERA_VIRTUAL">Billetera Virtual</option>
                  </select>
                </div>
              )}

              {similarityWarning && (
                <div style={{ display: 'flex', gap: '8px', background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', color: '#b45309', fontSize: '12px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{similarityWarning}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="asistente-btn-secondary" style={{ flex: 1 }} onClick={() => { setShowInlineModal(null); setInlineData({}); setSimilarityWarning(null); }}>
                  Cancelar
                </button>
                <button className="asistente-btn-primary" style={{ flex: 1 }} onClick={submitInlineCreation}>
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
