import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card, CardHeader } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Landmark, Wallet, Search, Filter, Plus, ArrowLeft, Save, 
  ArrowUpRight, ArrowDownRight, Activity, Receipt, Loader2,
  ChevronLeft, ChevronRight, Calendar, TrendingUp, Briefcase,
  Users, TrendingDown, Coins, Percent, History,
  Trash2, CreditCard, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useCashMovements } from '../hooks/useCashMovements';
import { usePartnerTransactions } from '../hooks/usePartnerTransactions';
import { useSocietaria } from '../hooks/useSocietaria';
import { useBanks } from '../hooks/useBanks';
import { useSettings } from '../hooks/useSettings';
import { useDateFilter } from '../contexts/DateFilterContext';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const CajaBancos = () => {
  const { settings } = useSettings();
  const { movements, loading: loadingMovements, error: errorMovements, createMovement, updateMovement, deleteMovement } = useCashMovements();
  const { banks, loading: loadingBanks } = useBanks();
  const { 
    partners,
    loading: loadingSocietaria, error: errorSocietaria
  } = useSocietaria();
  const { transactions, loading: loadingTx, error: errorTx, addTransaction } = usePartnerTransactions();
  const { mercaderias } = useMercaderias();
  const { insumos } = useInsumos();

  const [isSocioModalOpen, setIsSocioModalOpen] = useState(false);
  const [socioFormData, setSocioFormData] = useState({
    partnerId: '',
    type: 'APORTE',
    contributionType: 'DINERO',
    method: 'CAJA',
    amount: '',
    description: '',
    productId: '',
    quantity: ''
  });

  const socioSummary = React.useMemo(() => {
    const byPartner: Record<string, { aportado: number; retirado: number; neto: number; disponible: number }> = {};
    
    partners.forEach(p => {
      byPartner[p.id!] = { aportado: 0, retirado: 0, neto: 0, disponible: 0 };
    });

    transactions.forEach(tx => {
      if (!byPartner[tx.partnerId]) {
        byPartner[tx.partnerId] = { aportado: 0, retirado: 0, neto: 0, disponible: 0 };
      }
      if (tx.type === 'APORTE') {
        byPartner[tx.partnerId].aportado += tx.amount;
      } else if (tx.type === 'RETIRO' || tx.type === 'DEVOLUCION') {
        byPartner[tx.partnerId].retirado += tx.amount;
      }
    });

    Object.keys(byPartner).forEach(pid => {
      const p = byPartner[pid];
      p.neto = p.aportado - p.retirado;
      p.disponible = p.neto;
    });

    return byPartner;
  }, [transactions, partners]);

  const handleSocioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addTransaction({
        partnerId: socioFormData.partnerId,
        date: Date.now(),
        amount: parseFloat(socioFormData.amount),
        type: socioFormData.type as any,
        contributionType: socioFormData.contributionType as any,
        method: socioFormData.method as any,
        description: socioFormData.description,
        productId: socioFormData.productId || undefined,
        productName: socioFormData.productId ? 
          (socioFormData.contributionType === 'MERCADERIA' ? mercaderias.find(m => m.id === socioFormData.productId)?.name : insumos.find(i => i.id === socioFormData.productId)?.name) 
          : undefined,
        quantity: socioFormData.quantity ? parseFloat(socioFormData.quantity) : undefined
      });
      setIsSocioModalOpen(false);
      setSocioFormData({ partnerId: '', type: 'APORTE', contributionType: 'DINERO', method: 'CAJA', amount: '', description: '', productId: '', quantity: '' });
    } catch (err) {
      alert('Error al guardar movimiento societario');
    }
  };

  // Navigation Tabs: resumen, movimientos, resultado, socios, reinversiones, historico, bancos
  const [activeTab, setActiveTab] = useState<'resumen' | 'movimientos' | 'resultado' | 'socios' | 'reinversiones' | 'historico' | 'bancos'>('resumen');
  
  // Display Mode: 'ars' (equivalent in ARS) | 'original' (original currencies)
  const [displayMode, setDisplayMode] = useState<'ars' | 'original'>('ars');

  // Time Navigator State
  const currentYear = new Date().getFullYear();
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth } = useDateFilter();

  // Selected partner for detail view
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Forms Visibility
  const [isCreatingMovement, setIsCreatingMovement] = useState(false);
  const [isCreatingDist, setIsCreatingDist] = useState(false);
  const [isCreatingReinv, setIsCreatingReinv] = useState(false);
  const [isCreatingContribution, setIsCreatingContribution] = useState(false);

  // --- FORM STATES ---
  // Normal Movement Form
  const [movFecha, setMovFecha] = useState(new Date().toISOString().split('T')[0]);
  const [movTipo, setMovTipo] = useState<'in' | 'out' | 'APORTE_SOCIO'>('in');
  const [movCategoria, setMovCategoria] = useState('venta');
  const [movMedioPago, setMovMedioPago] = useState<'cash' | 'transfer' | 'cheque'>('cash');
  const [movOrigen, setMovOrigen] = useState<'cash' | 'bank'>('cash');
  const [movDestino, setMovDestino] = useState<'caja' | 'banco' | 'activo'>('caja');
  const [movMontoStr, setMovMontoStr] = useState('');
  const [movObservaciones, setMovObservaciones] = useState('');
  const [movComprobanteRef, setMovComprobanteRef] = useState('');
  const [movCurrency, setMovCurrency] = useState('ARS');
  const [movBankId, setMovBankId] = useState('');
  const [movPartnerId, setMovPartnerId] = useState('');
  const [movAporteType, setMovAporteType] = useState<'dinero' | 'bien_capital' | 'vehiculo' | 'mercaderia' | 'equipamiento' | 'tecnologia' | 'otro'>('dinero');
  const [isSavingMov, setIsSavingMov] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);
  
  // Edit & Override Movement
  const [editMovementId, setEditMovementId] = useState<string | null>(null);
  const [originalMovement, setOriginalMovement] = useState<any>(null);

  // Distribution Form
  const [distFecha, setDistFecha] = useState(new Date().toISOString().split('T')[0]);
  const [distSocioId, setDistSocioId] = useState('');
  const [distMontoStr, setDistMontoStr] = useState('');
  const [distCurrency, setDistCurrency] = useState('ARS');
  const [distTipo, setDistTipo] = useState<'retiro' | 'adelanto' | 'honorarios' | 'otro'>('retiro');
  const [distObs, setDistObs] = useState('');
  const [isSavingDist, setIsSavingDist] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  // Reinvestment Form
  const [reinvFecha, setReinvFecha] = useState(new Date().toISOString().split('T')[0]);
  const [reinvCategoria, setReinvCategoria] = useState('');
  const [reinvMontoStr, setReinvMontoStr] = useState('');
  const [reinvCurrency, setReinvCurrency] = useState('ARS');
  const [reinvObs, setReinvObs] = useState('');
  const [isSavingReinv, setIsSavingReinv] = useState(false);
  const [reinvError, setReinvError] = useState<string | null>(null);

  // Contribution/Return Form
  const [contFecha, setContFecha] = useState(new Date().toISOString().split('T')[0]);
  const [contSocioId, setContSocioId] = useState('');
  const [contMontoStr, setContMontoStr] = useState('');
  const [contCurrency, setContCurrency] = useState('ARS');
  const [contTipo, setContTipo] = useState<'contribution' | 'return'>('contribution');
  const [contConcepto, setContConcepto] = useState('Aporte de capital');
  const [isSavingCont, setIsSavingCont] = useState(false);
  const [contError, setContError] = useState<string | null>(null);

  // General Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  if (errorMovements || errorSocietaria) {
    return <ErrorState message={errorMovements || errorSocietaria || "Error al cargar los datos."} />;
  }

  // --- CURRENCY UTILS ---
  const getRate = (code: string) => {
    const list = settings?.currencies || [];
    const match = list.find((c: any) => c.code === code);
    return match ? match.rate : 1;
  };

  const getSymbol = (code: string) => {
    const list = settings?.currencies || [];
    const match = list.find((c: any) => c.code === code);
    return match ? match.symbol : '$';
  };

  const formatValue = (amount: number, code: string) => {
    if (displayMode === 'ars') {
      const rate = getRate(code);
      return formatCurrency(amount * rate);
    } else {
      const symbol = getSymbol(code);
      return `${symbol} ${formatNumber(amount)} ${code}`;
    }
  };

  const getMultiCurrencySum = (items: any[], amountKey: string = 'amount', currencyKey: string = 'currency') => {
    if (displayMode === 'ars') {
      const totalArs = items.reduce((sum, item) => {
        const amount = item[amountKey] || 0;
        const currency = item[currencyKey] || 'ARS';
        const rate = getRate(currency);
        return sum + (amount * rate);
      }, 0);
      return formatCurrency(totalArs);
    } else {
      const groups: { [key: string]: number } = {};
      items.forEach(item => {
        const currency = item[currencyKey] || 'ARS';
        const amount = item[amountKey] || 0;
        groups[currency] = (groups[currency] || 0) + amount;
      });
      const parts = Object.entries(groups).map(([code, sum]) => {
        const symbol = getSymbol(code);
        return `${symbol} ${formatNumber(sum)}`;
      });
      return parts.length > 0 ? parts.join(' + ') : '$ 0';
    }
  };

  // Convert an original amount to ARS
  const toArs = (amount: number, currency: string) => {
    return amount * getRate(currency);
  };

  // --- DATE RANGES ---
  const startOfMonth = new Date(selectedYear, selectedMonth, 1).getTime();
  const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).getTime();
  
  const startOfYear = new Date(selectedYear, 0, 1).getTime();
  const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59, 999).getTime();

  // Helper date filters
  const isSameMonth = (ts: number) => ts >= startOfMonth && ts <= endOfMonth;
  const isSameYear = (ts: number) => ts >= startOfYear && ts <= endOfYear;
  const isBeforeMonth = (ts: number) => ts < startOfMonth;
  const isBeforeOrSameMonth = (ts: number) => ts <= endOfMonth;

  // --- DATA FILTERING ---
  const activePartners = partners.filter(p => p.isActive);
  const monthlyMovements = movements.filter(m => isSameMonth(m.date));
  const monthlyDistributions = monthlyMovements.filter(m => m.type === 'out' && (m.category || '').toLowerCase() === 'retiro_capital');
  const monthlyReinvestments = monthlyMovements.filter(m => m.type === 'out' && (m.category || '').toLowerCase().includes('inversion'));
  const monthlyContributions = monthlyMovements.filter(m => m.category === 'aporte_socio');

  // --- METRICS CALCULATION (IN ARS EQUIVALENT FOR BASE LOGIC) ---
  
  // 1. normal cash movements
  const ingresosMesArs = monthlyMovements
    .filter(m => m.type === 'in')
    .reduce((sum, m) => sum + toArs(m.amount, m.currency || 'ARS'), 0);

  const egresosMesArs = monthlyMovements
    .filter(m => m.type === 'out')
    .reduce((sum, m) => sum + toArs(m.amount, m.currency || 'ARS'), 0);

  const resultadoNetoMesArs = ingresosMesArs - egresosMesArs;

  // 2. reinversiones & distribuciones
  const reinversionesMesArs = monthlyReinvestments
    .reduce((sum, r) => sum + toArs(r.amount, r.currency || 'ARS'), 0);

  const distribucionesMesArs = monthlyDistributions
    .reduce((sum, d) => sum + toArs(d.amount, d.currency || 'ARS'), 0);

  // 3. resultado disponible
  const resultadoDisponibleMesArs = resultadoNetoMesArs - reinversionesMesArs - distribucionesMesArs;

  // 4. aportes & devoluciones
  const aportesMesArs = monthlyContributions
    .filter(c => c.type === 'in')
    .reduce((sum, c) => sum + toArs(c.amount, c.currency || 'ARS'), 0);

  const devolucionesMesArs = monthlyContributions
    .filter(c => c.type === 'out')
    .reduce((sum, c) => sum + toArs(c.amount, c.currency || 'ARS'), 0);

  // 5. cash balances (all time up to end of selected month)
  const saldoCajaFisicaArs = movements
    .filter(m => isBeforeOrSameMonth(m.date) && (m.origin === 'cash' || (!m.origin && m.method === 'cash')))
    .reduce((sum, m) => sum + (m.type === 'in' ? 1 : -1) * toArs(m.amount, m.currency || 'ARS'), 0);

  const saldoBancosArs = movements
    .filter(m => isBeforeOrSameMonth(m.date) && (m.origin === 'bank' || !!m.bankId))
    .reduce((sum, m) => sum + (m.type === 'in' ? 1 : -1) * toArs(m.amount, m.currency || 'ARS'), 0);

  // --- BANK DETAILED BALANCES ---
  const getBankBalanceArs = (bankId: string, bankName: string) => {
    return movements
      .filter(m => isBeforeOrSameMonth(m.date) && (m.bankId === bankId || (!m.bankId && m.origin === 'bank' && m.description.toLowerCase().includes(bankName.toLowerCase()))))
      .reduce((sum, m) => sum + (m.type === 'in' ? 1 : -1) * toArs(m.amount, m.currency || 'ARS'), 0);
  };

  // --- PARTNER CALCULATIONS (ALL TIME / PERIOD BASED) ---
  const getPartnerStats = (partnerId: string) => {
    const pMovs = movements.filter(m => m.partnerId === partnerId);
    
    const pDists = pMovs.filter(m => m.type === 'out' && (m.category || '').toLowerCase() === 'retiro_capital');
    const pConts = pMovs.filter(m => m.category === 'aporte_socio');

    const retiradoMes = pDists.filter(d => isSameMonth(d.date)).reduce((sum, d) => sum + toArs(d.amount, d.currency || 'ARS'), 0);
    const retiradoAnio = pDists.filter(d => isSameYear(d.date)).reduce((sum, d) => sum + toArs(d.amount, d.currency || 'ARS'), 0);
    const retiradoHist = pDists.reduce((sum, d) => sum + toArs(d.amount, d.currency || 'ARS'), 0);

    const aportadoHist = pConts.filter(c => c.type === 'in').reduce((sum, c) => sum + toArs(c.amount, c.currency || 'ARS'), 0);
    const devolucionesHist = pConts.filter(c => c.type === 'out').reduce((sum, c) => sum + toArs(c.amount, c.currency || 'ARS'), 0);
    
    const saldoAportadoVigente = aportadoHist - devolucionesHist;

    const partner = partners.find(p => p.id === partnerId);
    const participation = partner ? partner.share : 0;

    return {
      retiradoMes,
      retiradoAnio,
      retiradoHist,
      aportadoHist,
      devolucionesHist,
      saldoAportadoVigente,
      participation
    };
  };

  // Chronological running balance for movements
  const sortedMovements = [...movements].sort((a, b) => a.date - b.date);
  const initialBalanceArs = sortedMovements
    .filter(m => isBeforeMonth(m.date))
    .reduce((sum, m) => {
      const isNonMoneyAporte = (m.category === 'aporte_socio' && m.aporteType && m.aporteType !== 'dinero') || (m.tipoMovimiento === 'APORTE_SOCIO' && m.destino === 'activo');
      if (isNonMoneyAporte || m.type === 'transfer') return sum;
      return sum + (m.type === 'in' ? 1 : -1) * toArs(m.amount, m.currency || 'ARS');
    }, 0);

  const movementsMonthAsc = sortedMovements.filter(m => isSameMonth(m.date));
  let runBal = initialBalanceArs;
  const movementsWithRunningBal = movementsMonthAsc.map(m => {
    const isNonMoneyAporte = (m.category === 'aporte_socio' && m.aporteType && m.aporteType !== 'dinero') || (m.tipoMovimiento === 'APORTE_SOCIO' && m.destino === 'activo');
    if (!isNonMoneyAporte && m.type !== 'transfer') {
      const val = toArs(m.amount, m.currency || 'ARS');
      if (m.type === 'in') {
        runBal += val;
      } else {
        runBal -= val;
      }
    }
    return {
      ...m,
      runningBalanceArs: runBal
    };
  });
  const movementsToShow = movementsWithRunningBal.reverse();

  // Search filter
  const filteredMovementsToShow = movementsToShow.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.description.toLowerCase().includes(query) ||
      (item.category || '').toLowerCase().includes(query) ||
      (item.referenceId && item.referenceId.toLowerCase().includes(query)) ||
      item.amount.toString().includes(query) ||
      (item.currency || 'ARS').toLowerCase().includes(query)
    );
  });

  // --- ACTIONS ---
  const handleEditClick = (mov: any) => {
    setOriginalMovement(mov);
    setEditMovementId(mov.id!);
    setMovFecha(new Date(mov.date).toISOString().split('T')[0]);
    const isAporte = mov.tipoMovimiento === 'APORTE_SOCIO' || mov.category === 'aporte_socio';
    setMovTipo(isAporte ? 'APORTE_SOCIO' : mov.type as any);
    setMovCategoria(mov.category || '');
    setMovOrigen(isAporte ? 'cash' : (mov.origin || 'cash'));
    setMovDestino(mov.destino || 'caja');
    setMovMedioPago(mov.method || 'cash');
    setMovMontoStr(mov.amount.toString());
    setMovObservaciones(mov.description || '');
    setMovComprobanteRef(mov.referenceId || '');
    setMovCurrency(mov.currency || 'ARS');
    setMovBankId(mov.bankId || '');
    setMovPartnerId(mov.partnerId || '');
    setMovAporteType(mov.aporteType || 'dinero');
    setMovError(null);
    setIsCreatingMovement(true); // Re-use the form modal
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este movimiento? Esta acción recalculará los saldos.')) {
      try {
        await deleteMovement(id);
      } catch (e: any) {
        alert(e.message || 'Error al eliminar');
      }
    }
  };

  const handleUpdateOverride = async () => {
    const monto = Math.abs(parseFloat(movMontoStr));
    if (isNaN(monto) || monto <= 0) {
      setMovError("Debe ingresar un monto válido.");
      return;
    }
    setMovError(null);
    setIsSavingMov(true);
    try {
      const data: any = {
        type: movTipo === 'APORTE_SOCIO' ? 'in' : movTipo,
        tipoMovimiento: movTipo === 'APORTE_SOCIO' ? 'APORTE_SOCIO' : 'OPERATIVO',
        amount: monto,
        currency: movCurrency,
        method: movTipo === 'APORTE_SOCIO' ? (movDestino === 'caja' ? 'cash' : 'transfer') : movMedioPago,
        origin: movTipo === 'APORTE_SOCIO' ? 'socio' : movOrigen,
        destino: movTipo === 'APORTE_SOCIO' ? movDestino : (movOrigen === 'bank' ? 'banco' : 'caja'),
        description: movObservaciones,
        category: movTipo === 'APORTE_SOCIO' ? 'aporte_socio' : movCategoria,
        referenceId: movComprobanteRef,
        bankId: (movTipo === 'APORTE_SOCIO' ? movDestino === 'banco' : movOrigen === 'bank') ? movBankId : '',
        partnerId: (movTipo === 'APORTE_SOCIO' || movCategoria === 'aporte_socio') ? movPartnerId : '',
        aporteType: movTipo === 'APORTE_SOCIO' ? (movDestino === 'activo' ? movAporteType : 'dinero') : (movCategoria === 'aporte_socio' ? movAporteType : 'dinero'),
        date: new Date(movFecha).getTime(),
        isManualOverride: true,
        auditLog: [
          ...(originalMovement.auditLog || []),
          {
            date: Date.now(),
            user: 'Usuario / Socio', // Usually would come from auth context
            action: 'edit_override',
            previousValues: { amount: originalMovement.amount, category: originalMovement.category, type: originalMovement.type, origin: originalMovement.origin },
            newValues: { amount: monto, category: movTipo === 'APORTE_SOCIO' ? 'aporte_socio' : movCategoria, type: movTipo === 'APORTE_SOCIO' ? 'in' : movTipo, origin: movTipo === 'APORTE_SOCIO' ? 'socio' : movOrigen }
          }
        ]
      };
      await updateMovement(editMovementId!, data);
      setIsCreatingMovement(false);
      setEditMovementId(null);
      setOriginalMovement(null);
    } catch (e: any) {
      setMovError(e.message || "Error al actualizar.");
    } finally {
      setIsSavingMov(false);
    }
  };

  const handleRegisterMovement = async () => {
    if (editMovementId) {
      return handleUpdateOverride();
    }

    const monto = Math.abs(parseFloat(movMontoStr));
    if (isNaN(monto) || monto <= 0) {
      setMovError("Debe ingresar un monto válido.");
      return;
    }
    if (movTipo === 'APORTE_SOCIO') {
      if (!movPartnerId) {
        setMovError("Debe seleccionar un socio asociado.");
        return;
      }
      if (movDestino === 'banco' && !movBankId) {
        setMovError("Debe seleccionar una cuenta bancaria de destino.");
        return;
      }
    } else {
      if (movOrigen === 'bank' && !movBankId) {
        setMovError("Debe seleccionar una cuenta bancaria.");
        return;
      }
    }
    setMovError(null);
    setIsSavingMov(true);
    try {
      let finalDesc = movObservaciones;
      const selectedBank = banks.find(b => b.id === movBankId);
      if (movTipo === 'APORTE_SOCIO') {
        if (movDestino === 'banco' && selectedBank) {
          finalDesc = `[Aporte Socio - ${selectedBank.name}] ${movObservaciones || 'Aporte de Capital'}`;
        } else {
          const destLabel = movDestino === 'caja' ? 'Caja Física' : `Activo: ${movAporteType}`;
          finalDesc = `[Aporte Socio - ${destLabel}] ${movObservaciones || 'Aporte de Capital'}`;
        }
      } else {
        if (movOrigen === 'bank' && selectedBank) {
          finalDesc = `[${selectedBank.name}] ${movObservaciones || 'Movimiento Banco'}`;
        } else if (!finalDesc) {
          finalDesc = 'Movimiento de Caja';
        }
      }

      await createMovement({
        type: movTipo === 'APORTE_SOCIO' ? 'in' : movTipo,
        tipoMovimiento: movTipo === 'APORTE_SOCIO' ? 'APORTE_SOCIO' : 'OPERATIVO',
        amount: monto,
        currency: movCurrency,
        method: movTipo === 'APORTE_SOCIO' ? (movDestino === 'caja' ? 'cash' : 'transfer') : movMedioPago,
        origin: movTipo === 'APORTE_SOCIO' ? 'socio' : movOrigen,
        destino: movTipo === 'APORTE_SOCIO' ? movDestino : (movOrigen === 'bank' ? 'banco' : 'caja'),
        description: finalDesc,
        category: movTipo === 'APORTE_SOCIO' ? 'aporte_socio' : movCategoria,
        referenceId: movComprobanteRef || '',
        date: new Date(movFecha).getTime(),
        bankId: (movTipo === 'APORTE_SOCIO' ? movDestino === 'banco' : movOrigen === 'bank') ? movBankId : '',
        partnerId: (movTipo === 'APORTE_SOCIO' || movCategoria === 'aporte_socio') ? movPartnerId : '',
        aporteType: movTipo === 'APORTE_SOCIO' ? (movDestino === 'activo' ? movAporteType : 'dinero') : (movCategoria === 'aporte_socio' ? movAporteType : 'dinero')
      });
      setIsCreatingMovement(false);
      setMovMontoStr('');
      setMovObservaciones('');
      setMovComprobanteRef('');
      setMovBankId('');
      setMovPartnerId('');
      setMovAporteType('dinero');
    } catch (e: any) {
      setMovError(e.message || "Error al guardar.");
    } finally {
      setIsSavingMov(false);
    }
  };

  const handleRegisterDistribution = async () => {
    const monto = Math.abs(parseFloat(distMontoStr));
    if (isNaN(monto) || monto <= 0 || !distSocioId) {
      setDistError("Complete todos los campos con valores válidos.");
      return;
    }
    setDistError(null);
    setIsSavingDist(true);
    try {
      const partner = partners.find(p => p.id === distSocioId);
      await createMovement({
        type: 'out',
        amount: monto,
        currency: distCurrency,
        method: 'transfer',
        category: 'retiro_capital',
        description: `Distribución (${distTipo}): ${distObs || ''}`,
        partnerId: distSocioId,
        date: new Date(distFecha).getTime(),
        aporteType: 'dinero'
      });
      setIsCreatingDist(false);
      setDistMontoStr('');
      setDistObs('');
    } catch (e: any) {
      setDistError(e.message || "Error al guardar.");
    } finally {
      setIsSavingDist(false);
    }
  };

  const handleRegisterReinvestment = async () => {
    const monto = Math.abs(parseFloat(reinvMontoStr));
    if (isNaN(monto) || monto <= 0 || !reinvCategoria) {
      setReinvError("Complete todos los campos con valores válidos.");
      return;
    }
    setReinvError(null);
    setIsSavingReinv(true);
    try {
      await createMovement({
        type: 'out',
        amount: monto,
        currency: reinvCurrency,
        method: 'transfer',
        category: 'inversion',
        description: `Reinversión en ${reinvCategoria}: ${reinvObs || ''}`,
        date: new Date(reinvFecha).getTime(),
        aporteType: 'bien_capital'
      });
      setIsCreatingReinv(false);
      setReinvMontoStr('');
      setReinvObs('');
    } catch (e: any) {
      setReinvError(e.message || "Error al guardar.");
    } finally {
      setIsSavingReinv(false);
    }
  };

  const handleRegisterContribution = async () => {
    const monto = Math.abs(parseFloat(contMontoStr));
    if (isNaN(monto) || monto <= 0 || !contSocioId) {
      setContError("Complete todos los campos con valores válidos.");
      return;
    }
    setContError(null);
    setIsSavingCont(true);
    try {
      const partner = partners.find(p => p.id === contSocioId);
      await createMovement({
        type: contTipo === 'contribution' ? 'in' : 'out',
        tipoMovimiento: contTipo === 'contribution' ? 'APORTE_SOCIO' : 'OPERATIVO',
        amount: monto,
        currency: contCurrency,
        method: 'transfer',
        origin: contTipo === 'contribution' ? 'socio' : 'cash',
        destino: contTipo === 'contribution' ? 'caja' : 'banco',
        category: 'aporte_socio',
        description: contConcepto || (contTipo === 'contribution' ? 'Aporte de capital' : 'Devolución de aporte'),
        partnerId: contSocioId,
        date: new Date(contFecha).getTime(),
        aporteType: 'dinero'
      });
      setIsCreatingContribution(false);
      setContMontoStr('');
      setContConcepto('Aporte de capital');
    } catch (e: any) {
      setContError(e.message || "Error al guardar.");
    } finally {
      setIsSavingCont(false);
    }
  };

  // --- PERIOD NAVIGATOR BUTTONS ---
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  if (loadingMovements || loadingSocietaria || loadingBanks) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  // --- OPTIONAL FORMS OVERLAYS ---
  const renderMovementFormModal = () => {
    if (!isCreatingMovement) return null;
    const catList = settings?.expense_categories || [
      'Mercadería', 'Alquiler', 'Servicios', 'Sueldos', 'Impuestos', 'Combustible', 'Logística', 'Marketing', 'Mantenimiento', 'Honorarios', 'Otros'
    ];
    const currList = settings?.currencies || [{ code: 'ARS', symbol: '$' }];

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '28px', borderRadius: '16px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            {editMovementId ? 'Editar Movimiento (Override)' : 'Registrar Movimiento Financiero'}
          </h3>
          
          {movError && <div style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{movError}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="Fecha" type="date" value={movFecha} onChange={e => setMovFecha(e.target.value)} />
              <Select label="Moneda" value={movCurrency} onChange={e => setMovCurrency(e.target.value)} options={currList.map((c: any) => ({ value: c.code, label: `${c.code} (${c.symbol})` }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select 
                label="Tipo" 
                value={movTipo} 
                onChange={e => {
                  const val = e.target.value as 'in' | 'out' | 'APORTE_SOCIO';
                  setMovTipo(val);
                  if (val === 'APORTE_SOCIO') {
                    setMovCategoria('aporte_socio');
                  } else if (movCategoria === 'aporte_socio') {
                    setMovCategoria('venta');
                  }
                }} 
                options={[
                  { value: 'in', label: 'Ingreso Operativo' }, 
                  { value: 'out', label: 'Egreso Operativo' },
                  { value: 'APORTE_SOCIO', label: 'Aporte de Socio' }
                ]} 
              />
              {movTipo !== 'APORTE_SOCIO' ? (
                <Select label="Categoría" value={movCategoria} onChange={e => setMovCategoria(e.target.value)} options={catList.map((c: string) => ({ value: c.toLowerCase(), label: c }))} />
              ) : (
                <Input label="Origen" value="SOCIO (Inyección de Capital)" disabled />
              )}
            </div>

            {movTipo === 'APORTE_SOCIO' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Select 
                    label="Socio Asociado *" 
                    value={movPartnerId} 
                    onChange={e => setMovPartnerId(e.target.value)} 
                    options={[
                      { value: '', label: 'Seleccionar Socio...' },
                      ...partners.map(p => ({ value: p.id!, label: `${p.name} (${p.share}%)` }))
                    ]} 
                  />
                  <Select 
                    label="Destino *" 
                    value={movDestino} 
                    onChange={e => setMovDestino(e.target.value as any)} 
                    options={[
                      { value: 'caja', label: 'Caja Física' },
                      { value: 'banco', label: 'Banco / Cuenta Bancaria' },
                      { value: 'activo', label: 'Activo (Mercadería, Máquinas, etc.)' }
                    ]} 
                  />
                </div>

                {movDestino === 'banco' && (
                  <Select 
                    label="Cuenta Bancaria Destino *" 
                    value={movBankId} 
                    onChange={e => setMovBankId(e.target.value)} 
                    options={[
                      { value: '', label: 'Seleccionar Cuenta...' }, 
                      ...(banks || []).filter(b => b.isActive).map(b => ({ value: b.id!, label: `${b.name} (${b.currency} - ${b.accountType})` }))
                    ]} 
                  />
                )}

                {movDestino === 'activo' && (
                  <Select 
                    label="Tipo de Activo *" 
                    value={movAporteType} 
                    onChange={e => setMovAporteType(e.target.value as any)} 
                    options={[
                      { value: 'bien_capital', label: 'Bien de Capital (Máquinas)' },
                      { value: 'vehiculo', label: 'Vehículo' },
                      { value: 'mercaderia', label: 'Mercadería' },
                      { value: 'equipamiento', label: 'Equipamiento / Herramientas' },
                      { value: 'tecnologia', label: 'Tecnología' },
                      { value: 'otro', label: 'Otro Activo' }
                    ]} 
                  />
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Select label="Origen/Medio" value={movOrigen} onChange={e => {
                    const val = e.target.value as 'cash' | 'bank';
                    setMovOrigen(val);
                    if (val === 'cash') setMovMedioPago('cash');
                    else setMovMedioPago('transfer');
                  }} options={[{ value: 'cash', label: 'Caja Física' }, { value: 'bank', label: 'Banco' }]} />
                  
                  {movOrigen === 'bank' ? (
                    <Select 
                      label="Cuenta Bancaria" 
                      value={movBankId} 
                      onChange={e => setMovBankId(e.target.value)} 
                      options={[
                        { value: '', label: 'Seleccionar Cuenta...' }, 
                        ...(banks || []).filter(b => b.isActive).map(b => ({ value: b.id!, label: `${b.name} (${b.currency} - ${b.accountType})` }))
                      ]} 
                    />
                  ) : (
                    <Select label="Medio de Pago" value={movMedioPago} onChange={e => setMovMedioPago(e.target.value as any)} options={[{ value: 'cash', label: 'Efectivo' }]} />
                  )}
                </div>

                {movOrigen === 'bank' && (
                  <Select label="Tipo de Operación" value={movMedioPago} onChange={e => setMovMedioPago(e.target.value as any)} options={[{ value: 'transfer', label: 'Transferencia Bancaria' }, { value: 'cheque', label: 'Cheque' }]} />
                )}

                {movCategoria === 'aporte_socio' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Select 
                      label="Socio Asociado" 
                      value={movPartnerId} 
                      onChange={e => setMovPartnerId(e.target.value)} 
                      options={[
                        { value: '', label: 'Seleccionar Socio...' },
                        ...partners.map(p => ({ value: p.id!, label: `${p.name} (${p.share}%)` }))
                      ]} 
                    />
                    <Select 
                      label="Tipo de Aporte" 
                      value={movAporteType} 
                      onChange={e => setMovAporteType(e.target.value as any)} 
                      options={[
                        { value: 'dinero', label: 'Dinero (Caja/Bancos)' },
                        { value: 'bien_capital', label: 'Bien de Capital (Máquinas)' },
                        { value: 'vehiculo', label: 'Vehículo' },
                        { value: 'mercaderia', label: 'Mercadería' },
                        { value: 'equipamiento', label: 'Equipamiento / Herramientas' },
                        { value: 'tecnologia', label: 'Tecnología' },
                        { value: 'otro', label: 'Otro Activo' }
                      ]} 
                    />
                  </div>
                )}
              </>
            )}

            <Input label="Monto" type="number" value={movMontoStr} onChange={e => setMovMontoStr(e.target.value)} placeholder="Ej: 5000" />
            <Input label="Observación / Descripción" value={movObservaciones} onChange={e => setMovObservaciones(e.target.value)} placeholder="Ej: Compra mercadería" />
            <Input label="Referencia (Nº Comprobante)" value={movComprobanteRef} onChange={e => setMovComprobanteRef(e.target.value)} placeholder="Opcional" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            {editMovementId && movTipo !== 'APORTE_SOCIO' && (
              <button 
                onClick={(e) => { 
                  e.preventDefault(); 
                  setMovTipo('APORTE_SOCIO'); 
                  setMovCategoria('aporte_socio'); 
                }} 
                className="btn btn-secondary" 
                style={{ borderColor: '#16a34a', color: '#16a34a', marginRight: 'auto' }}
              >
                Convertir a Aporte de Socio
              </button>
            )}
            <button onClick={() => { setIsCreatingMovement(false); setEditMovementId(null); setOriginalMovement(null); }} className="btn btn-secondary">Cancelar</button>
            <button onClick={handleRegisterMovement} disabled={isSavingMov} className="btn btn-primary">
              {isSavingMov ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editMovementId ? 'Actualizar' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDistributionFormModal = () => {
    if (!isCreatingDist) return null;
    const currList = settings?.currencies || [{ code: 'ARS', symbol: '$' }];

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '28px', borderRadius: '16px', maxWidth: '450px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Registrar Distribución Societaria</h3>
          
          {distError && <div style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{distError}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <Input label="Fecha" type="date" value={distFecha} onChange={e => setDistFecha(e.target.value)} />
            
            <Select label="Socio" value={distSocioId} onChange={e => setDistSocioId(e.target.value)} options={[
              { value: '', label: 'Seleccionar Socio' },
              ...activePartners.map(p => ({ value: p.id!, label: `${p.name} (${p.share}%)` }))
            ]} />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <Input label="Monto" type="number" value={distMontoStr} onChange={e => setDistMontoStr(e.target.value)} placeholder="Monto..." />
              <Select label="Moneda" value={distCurrency} onChange={e => setDistCurrency(e.target.value)} options={currList.map((c: any) => ({ value: c.code, label: c.code }))} />
            </div>

            <Select label="Tipo de Distribución" value={distTipo} onChange={e => setDistTipo(e.target.value as any)} options={[
              { value: 'retiro', label: 'Retiro de utilidades' },
              { value: 'adelanto', label: 'Adelanto de utilidades' },
              { value: 'honorarios', label: 'Honorarios' },
              { value: 'otro', label: 'Otro' }
            ]} />

            <Input label="Observaciones" value={distObs} onChange={e => setDistObs(e.target.value)} placeholder="Detalles de la distribución..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => setIsCreatingDist(false)} className="btn btn-secondary">Cancelar</button>
            <button onClick={handleRegisterDistribution} disabled={isSavingDist} className="btn btn-primary">
              {isSavingDist ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Registrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderReinvestmentFormModal = () => {
    if (!isCreatingReinv) return null;
    const catList = settings?.reinvestment_categories || [
      'Maquinaria', 'Vehículos', 'Marketing', 'Tecnología', 'Infraestructura', 'Mercadería estratégica', 'Capital de trabajo'
    ];
    const currList = settings?.currencies || [{ code: 'ARS', symbol: '$' }];

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '28px', borderRadius: '16px', maxWidth: '450px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Registrar Reinversión</h3>
          
          {reinvError && <div style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{reinvError}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <Input label="Fecha" type="date" value={reinvFecha} onChange={e => setReinvFecha(e.target.value)} />
            
            <Select label="Categoría" value={reinvCategoria} onChange={e => setReinvCategoria(e.target.value)} options={[
              { value: '', label: 'Seleccionar Categoría' },
              ...catList.map((c: string) => ({ value: c, label: c }))
            ]} />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <Input label="Monto" type="number" value={reinvMontoStr} onChange={e => setReinvMontoStr(e.target.value)} placeholder="Monto..." />
              <Select label="Moneda" value={reinvCurrency} onChange={e => setReinvCurrency(e.target.value)} options={currList.map((c: any) => ({ value: c.code, label: c.code }))} />
            </div>

            <Input label="Observación" value={reinvObs} onChange={e => setReinvObs(e.target.value)} placeholder="Ej: Adquisición de sierra corta fiambre..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => setIsCreatingReinv(false)} className="btn btn-secondary">Cancelar</button>
            <button onClick={handleRegisterReinvestment} disabled={isSavingReinv} className="btn btn-primary">
              {isSavingReinv ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Registrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderContributionFormModal = () => {
    if (!isCreatingContribution) return null;
    const currList = settings?.currencies || [{ code: 'ARS', symbol: '$' }];

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '28px', borderRadius: '16px', maxWidth: '450px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Aportes & Devoluciones de Socios</h3>
          
          {contError && <div style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{contError}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <Input label="Fecha" type="date" value={contFecha} onChange={e => setContFecha(e.target.value)} />
            
            <Select label="Socio" value={contSocioId} onChange={e => setContSocioId(e.target.value)} options={[
              { value: '', label: 'Seleccionar Socio' },
              ...activePartners.map(p => ({ value: p.id!, label: `${p.name} (${p.share}%)` }))
            ]} />

            <Select label="Tipo de Operación" value={contTipo} onChange={e => setContTipo(e.target.value as any)} options={[
              { value: 'contribution', label: 'Aporte de Socio' },
              { value: 'return', label: 'Devolución de Aporte (a Socio)' }
            ]} />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <Input label="Monto" type="number" value={contMontoStr} onChange={e => setContMontoStr(e.target.value)} placeholder="Monto..." />
              <Select label="Moneda" value={contCurrency} onChange={e => setContCurrency(e.target.value)} options={currList.map((c: any) => ({ value: c.code, label: c.code }))} />
            </div>

            <Input label="Concepto / Observaciones" value={contConcepto} onChange={e => setContConcepto(e.target.value)} placeholder="Ej: Adelanto para compra mercadería estratégica..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => setIsCreatingContribution(false)} className="btn btn-secondary">Cancelar</button>
            <button onClick={handleRegisterContribution} disabled={isSavingCont} className="btn btn-primary">
              {isSavingCont ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Registrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- SUBVIEW: PARTNER DETAIL VIEW ---
  const renderPartnerDetailView = () => {
    if (!selectedPartnerId) return null;
    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) return null;

    const stats = getPartnerStats(selectedPartnerId);
    
    const pDists = movements.filter(m => m.partnerId === selectedPartnerId && m.type === 'out' && (m.category || '').toLowerCase() === 'retiro_capital');
    const pConts = movements.filter(m => m.partnerId === selectedPartnerId && m.category === 'aporte_socio');

    const partnerMovements = movements.filter(m => m.partnerId === selectedPartnerId && (m.category === 'aporte_socio' || m.category === 'retiro_capital')).map(m => ({
        id: `mov-${m.id}`,
        date: m.date,
        concept: m.category === 'aporte_socio' ? (m.type === 'in' ? 'Aporte de Socio' : 'Devolución') : 'Retiro de Utilidades',
        amount: m.amount,
        currency: m.currency || 'ARS',
        observations: `${m.description || ''} ${m.isManualOverride ? '(Override Manual)' : ''}`,
        color: m.type === 'in' ? '#16a34a' : (m.category === 'retiro_capital' ? '#2563eb' : '#d97706'),
        rawType: m.type === 'in' ? 'contribution' : 'return'
      })).sort((a, b) => b.date - a.date);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setSelectedPartnerId(null)} className="btn btn-icon btn-secondary">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Ficha del Socio: {partner.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Evolución e historial de retiros, aportes y devoluciones</p>
          </div>
        </div>

        {/* Partner stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <Card padding="sm" style={{ borderTop: '4px solid #2563eb' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Retiros Totales</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af', marginTop: '4px' }}>
              {displayMode === 'ars' ? formatCurrency(stats.retiradoHist) : getMultiCurrencySum(pDists)}
            </h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Mes: {formatValue(stats.retiradoMes, 'ARS')} | Año: {formatValue(stats.retiradoAnio, 'ARS')}
            </p>
          </Card>

          <Card padding="sm" style={{ borderTop: '4px solid #16a34a' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Aportes de Capital</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534', marginTop: '4px' }}>
              {displayMode === 'ars' ? formatCurrency(stats.aportadoHist) : getMultiCurrencySum(pConts.filter(c => c.type === 'in'))}
            </h3>
          </Card>

          <Card padding="sm" style={{ borderTop: '4px solid #d97706' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Devoluciones Recibidas</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#9a3412', marginTop: '4px' }}>
              {displayMode === 'ars' ? formatCurrency(stats.devolucionesHist) : getMultiCurrencySum(pConts.filter(c => c.type === 'out'))}
            </h3>
          </Card>

          <Card padding="sm" style={{ borderTop: '4px solid #0d9488', backgroundColor: '#f0fdfa' }}>
            <p style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600, textTransform: 'uppercase' }}>Saldo Aportado Neto</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f766e', marginTop: '4px' }}>
              {formatCurrency(stats.saldoAportadoVigente)}
            </h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Participación: {partner.share}%</p>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card padding="none">
          <CardHeader title="Historial Comercial / Financiero del Socio" subtitle="Aportes, devoluciones y distribuciones cronológicas" />
          <div style={{ padding: '0 24px 24px 24px' }}>
            {partnerMovements.length === 0 ? (
              <EmptyState icon={History} title="Sin movimientos registrados" description="Este socio no registra retiros, aportes o devoluciones." />
            ) : (
              <Table 
                data={partnerMovements}
                keyExtractor={item => item.id}
                columns={[
                  {
                    header: 'Fecha',
                    accessor: item => new Date(item.date).toLocaleDateString(),
                    width: '120px'
                  },
                  {
                    header: 'Concepto',
                    accessor: item => (
                      <span style={{ fontWeight: 600, color: item.color }}>{item.concept}</span>
                    ),
                    width: '200px'
                  },
                  {
                    header: 'Monto Original',
                    accessor: item => `${getSymbol(item.currency)} ${formatNumber(item.amount)} ${item.currency}`,
                    align: 'right',
                    width: '150px'
                  },
                  {
                    header: 'Equivalente ARS',
                    accessor: item => formatCurrency(toArs(item.amount, item.currency)),
                    align: 'right',
                    width: '150px'
                  },
                  {
                    header: 'Observaciones',
                    accessor: item => item.observations
                  }
                ]}
              />
            )}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <>
      {/* HEADER SECTION */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '24px',
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={28} color="var(--primary-color)" /> Centro Financiero & Gestión Societaria
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Caja unificada, control multi-moneda de bancos, reinversiones y retiros societarios.
          </p>
        </div>

        {/* Currency Display Mode Selector */}
        <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          <button 
            onClick={() => setDisplayMode('ars')}
            style={{ 
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              backgroundColor: displayMode === 'ars' ? 'var(--primary-color)' : '#fff',
              color: displayMode === 'ars' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            ARS Equivalente
          </button>
          <button 
            onClick={() => setDisplayMode('original')}
            style={{ 
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              backgroundColor: displayMode === 'original' ? 'var(--primary-color)' : '#fff',
              color: displayMode === 'original' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Moneda Original
          </button>
        </div>
      </div>

      {/* PERIOD NAVIGATOR */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-secondary)', 
        padding: '16px 24px', 
        borderRadius: '12px', 
        border: '1px solid var(--border-color)', 
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} color="var(--primary-color)" />
          <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            Período:
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)', marginLeft: '4px' }}>
            {MONTHS[selectedMonth]} {selectedYear}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handlePrevMonth} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ChevronLeft size={16} /> Anterior
          </button>
          
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="form-select" style={{ width: '130px', padding: '6px 12px' }}>
            {MONTHS.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
          </select>

          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="form-select" style={{ width: '100px', padding: '6px 12px' }}>
            {Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>

          <button onClick={handleNextMonth} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* MODALS RENDERING */}
      {renderMovementFormModal()}
      {renderDistributionFormModal()}
      {renderReinvestmentFormModal()}
      {renderContributionFormModal()}

      {/* CORE REDESIGNED NAV PILLS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {[
          { id: 'resumen', label: 'Resumen', icon: Activity },
          { id: 'movimientos', label: 'Movimientos', icon: Receipt },
          { id: 'resultado', label: 'Resultado', icon: TrendingUp },
          { id: 'socios', label: 'Socios & Capital', icon: Users },
          { id: 'reinversiones', label: 'Reinversiones', icon: Briefcase },
          { id: 'historico', label: 'Histórico', icon: History },
          { id: 'bancos', label: 'Bancos', icon: Landmark }
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedPartnerId(null); // Reset subview
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <TabIcon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TABS CONTAINER */}
      <div style={{ minHeight: '50vh' }}>
        
        {/* --- TAB: RESUMEN (RESUMEN EJECUTIVO) --- */}
        {activeTab === 'resumen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <Card padding="sm" style={{ borderLeft: '4px solid #10b981' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Neto</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: resultadoNetoMesArs >= 0 ? '#10b981' : '#dc2626', marginTop: '8px' }}>
                  {formatCurrency(resultadoNetoMesArs)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ingresos vs Egresos del mes</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #2563eb' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Disponible</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: resultadoDisponibleMesArs >= 0 ? '#2563eb' : '#dc2626', marginTop: '8px' }}>
                  {formatCurrency(resultadoDisponibleMesArs)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Neto - Reinv. - Dist.</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #f59e0b' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Reinversiones</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '8px' }}>
                  {displayMode === 'ars' ? formatCurrency(reinversionesMesArs) : getMultiCurrencySum(monthlyReinvestments)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Maquinarias, tecnología, etc.</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #9333ea' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Distribuciones (Socios)</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed', marginTop: '8px' }}>
                  {displayMode === 'ars' ? formatCurrency(distribucionesMesArs) : getMultiCurrencySum(monthlyDistributions)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Retiros y dividendos del mes</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #06b6d4' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Aportes de Socios</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0891b2', marginTop: '8px' }}>
                  {displayMode === 'ars' ? formatCurrency(aportesMesArs) : getMultiCurrencySum(monthlyContributions.filter(c => c.type === 'in'))}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Aportes recibidos este mes</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #14b8a6' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Caja Física</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0d9488', marginTop: '8px' }}>
                  {formatCurrency(saldoCajaFisicaArs)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Saldo acumulado en efectivo</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #6366f1' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Saldos Bancos</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5', marginTop: '8px' }}>
                  {formatCurrency(saldoBancosArs)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Fondo unificado bancario</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #1e293b', backgroundColor: '#f8fafc' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Caja Unificada Total</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginTop: '8px' }}>
                  {formatCurrency(saldoCajaFisicaArs + saldoBancosArs)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Físico + Cuentas bancarias</span>
              </Card>
            </div>

            {/* Split layout for Partners list & Bank overview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Partner share overview & Net Aporte */}
              <Card padding="none">
                <CardHeader title="Saldos Aportados por Socio (Aporte Neto)" subtitle="Aporte histórico menos devoluciones recibidas" />
                <div style={{ padding: '0 24px 24px 24px' }}>
                  {partners.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay socios registrados.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {partners.map(p => {
                        const stats = getPartnerStats(p.id!);
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <div>
                              <b style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{p.name}</b>
                              <span style={{ marginLeft: '8px', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                                {p.share}%
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <b style={{ color: '#0f766e', fontSize: '1.05rem' }}>{formatCurrency(stats.saldoAportadoVigente)}</b>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                Aportado: {formatValue(stats.aportadoHist, 'ARS')} | Devoluciones: {formatValue(stats.devolucionesHist, 'ARS')}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </Card>

              {/* Caja vs Bancos Progress Bar & Quick status */}
              <Card>
                <CardHeader title="Composición de Tesorería" subtitle="Distribución del capital disponible" />
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Progress bar visual */}
                  {(() => {
                    const total = Math.max(1, Math.abs(saldoCajaFisicaArs) + Math.abs(saldoBancosArs));
                    const percentCaja = Math.min(100, Math.max(0, (saldoCajaFisicaArs / total) * 100));
                    return (
                      <div>
                        <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '12px' }}>
                          <div style={{ width: `${percentCaja}%`, backgroundColor: '#0d9488', color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {percentCaja > 15 ? `Caja (${percentCaja.toFixed(0)}%)` : ''}
                          </div>
                          <div style={{ flex: 1, backgroundColor: '#4f46e5', color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(100 - percentCaja) > 15 ? `Bancos (${(100 - percentCaja).toFixed(0)}%)` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                          <span style={{ color: '#0d9488', fontWeight: 600 }}>● Caja: {formatCurrency(saldoCajaFisicaArs)}</span>
                          <span style={{ color: '#4f46e5', fontWeight: 600 }}>● Bancos: {formatCurrency(saldoBancosArs)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <h5 style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Saldos Bancarios Desglosados:</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {(banks || []).map(b => (
                        <div key={b.id} style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{b.name}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5' }}>{formatCurrency(getBankBalanceArs(b.id!, b.name))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* --- TAB: MOVIMIENTOS --- */}
        {activeTab === 'movimientos' && (
          <Card padding="none">
            <CardHeader 
              title={`Historial de Movimientos de Caja - ${MONTHS[selectedMonth]} ${selectedYear}`} 
              subtitle="Ingresos y egresos operativos ordinarios"
              action={
                <button onClick={() => {
                  setMovFecha(new Date(selectedYear, selectedMonth, Math.min(new Date().getDate(), new Date(selectedYear, selectedMonth + 1, 0).getDate())).toISOString().split('T')[0]);
                  setIsCreatingMovement(true);
                }} className="btn btn-primary">
                  <Plus size={16} /> Nuevo Movimiento
                </button>
              }
            />
            <div style={{ padding: '0 24px 24px 24px' }}>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
                <input 
                  type="text" 
                  placeholder="Buscar movimientos..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                />
              </div>

              {filteredMovementsToShow.length === 0 ? (
                <EmptyState icon={Wallet} title="Sin movimientos registrados" description="No hay cobros/gastos en este período." />
              ) : (
                <Table 
                  data={filteredMovementsToShow}
                  keyExtractor={item => item.id!}
                  columns={[
                    {
                      header: 'Fecha',
                      accessor: item => new Date(item.date).toLocaleDateString(),
                      width: '100px'
                    },
                    {
                      header: 'Moneda',
                      accessor: item => item.currency || 'ARS',
                      width: '80px',
                      align: 'center'
                    },
                    {
                      header: 'Cuenta',
                      accessor: item => (
                        <span style={{ fontWeight: 600, color: item.origin === 'cash' ? '#0d9488' : '#4f46e5' }}>
                          {item.origin === 'cash' ? 'Caja' : 'Banco'}
                        </span>
                      ),
                      width: '80px'
                    },
                    {
                      header: 'Origen',
                      accessor: item => {
                        const moduleColors: Record<string, string> = {
                          'VENTAS': '#dcfce7',
                          'COMPRAS': '#fee2e2',
                          'SOCIOS': '#fef3c7',
                          'SISTEMA': '#f3f4f6',
                          'MANUAL': '#e0e7ff',
                        };
                        const textColors: Record<string, string> = {
                          'VENTAS': '#166534',
                          'COMPRAS': '#991b1b',
                          'SOCIOS': '#92400e',
                          'SISTEMA': '#1f2937',
                          'MANUAL': '#3730a3',
                        };
                        const mod = (item.sourceModule || 'MANUAL').toUpperCase();
                        return (
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                            backgroundColor: moduleColors[mod] || moduleColors['MANUAL'],
                            color: textColors[mod] || textColors['MANUAL']
                          }}>
                            {mod}
                          </span>
                        );
                      },
                      width: '80px'
                    },
                    {
                      header: 'Detalle',
                      accessor: item => (
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            Cat: {item.category} {item.referenceId ? `| Ref: ${item.referenceId}` : ''}
                          </div>
                        </div>
                      )
                    },
                    {
                      header: 'Monto Original',
                      accessor: item => `${getSymbol(item.currency || 'ARS')} ${formatNumber(item.amount)}`,
                      align: 'right',
                      width: '130px'
                    },
                    {
                      header: 'Equivalente ARS',
                      accessor: item => formatCurrency(toArs(item.amount, item.currency || 'ARS')),
                      align: 'right',
                      width: '130px'
                    },
                    {
                      header: 'Dirección',
                      accessor: item => (
                        <span style={{ 
                          padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: item.type === 'in' ? '#dcfce7' : '#fee2e2',
                          color: item.type === 'in' ? '#166534' : '#991b1b'
                        }}>
                          {item.type === 'in' ? 'Ingreso' : 'Egreso'}
                        </span>
                      ),
                      align: 'center',
                      width: '100px'
                    },
                    {
                      header: 'Acciones',
                      accessor: item => (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => item.isEditable !== false ? handleEditClick(item) : alert('Este movimiento automático no puede editarse directamente.')} 
                            style={{ background: 'none', border: 'none', cursor: item.isEditable !== false ? 'pointer' : 'not-allowed', color: item.isEditable !== false ? '#2563eb' : '#9ca3af' }} 
                            title={item.isEditable !== false ? "Editar / Reclasificar" : "No editable"}
                            disabled={item.isEditable === false}
                          >
                            <History size={16} />
                          </button>
                          <button 
                            onClick={() => item.isDeletable !== false ? handleDeleteClick(item.id!) : alert('Debe anular el documento original para eliminar este movimiento.')} 
                            style={{ background: 'none', border: 'none', cursor: item.isDeletable !== false ? 'pointer' : 'not-allowed', color: item.isDeletable !== false ? '#dc2626' : '#9ca3af' }} 
                            title={item.isDeletable !== false ? "Eliminar" : "No eliminable"}
                            disabled={item.isDeletable === false}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ),
                      align: 'right',
                      width: '80px'
                    }
                  ]}
                />
              )}
            </div>
          </Card>
        )}

        {/* --- TAB: RESULTADO (ANALISIS DE GANANCIAS & DESGLOSE GASTOS) --- */}
        {activeTab === 'resultado' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Resumen del Período */}
              <Card>
                <CardHeader title="Análisis de Ganancias del Mes" subtitle="Ingresos, egresos y utilidad distribuible" />
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ingresos Totales (ARS Eq):</span>
                    <b style={{ color: '#16a34a' }}>+{formatCurrency(ingresosMesArs)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Egresos / Gastos (ARS Eq):</span>
                    <b style={{ color: '#dc2626' }}>-{formatCurrency(egresosMesArs)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontSize: '1.05rem' }}>
                    <span><b>Utilidad / Resultado Neto:</b></span>
                    <b style={{ color: resultadoNetoMesArs >= 0 ? '#2563eb' : '#dc2626' }}>{formatCurrency(resultadoNetoMesArs)}</b>
                  </div>
                  
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span>(-) Reinversiones del mes:</span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>-{formatCurrency(reinversionesMesArs)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span>(-) Retiros Socios del mes:</span>
                      <span style={{ color: '#9333ea', fontWeight: 600 }}>-{formatCurrency(distribucionesMesArs)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <span><b>Resultado Disponible:</b></span>
                      <b style={{ color: 'var(--primary-color)' }}>{formatCurrency(resultadoDisponibleMesArs)}</b>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Categorización de Gastos */}
              <Card>
                <CardHeader title="Gastos por Categoría" subtitle="Desglose y porcentaje del total de egresos" />
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(() => {
                    // Group expenses by category
                    const expenseMovements = monthlyMovements.filter(m => m.type === 'out');
                    const totalExp = expenseMovements.reduce((sum, m) => sum + toArs(m.amount, m.currency || 'ARS'), 0);
                    
                    const catGroups: { [key: string]: number } = {};
                    expenseMovements.forEach(m => {
                      const cat = m.category || 'otros';
                      catGroups[cat] = (catGroups[cat] || 0) + toArs(m.amount, m.currency || 'ARS');
                    });

                    if (totalExp === 0) {
                      return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '32px 0' }}>No hay gastos registrados este mes.</p>;
                    }

                    return Object.entries(catGroups)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amount]) => {
                        const pct = (amount / totalExp) * 100;
                        return (
                          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{cat}</span>
                              <span>{formatCurrency(amount)} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '4px' }}></div>
                            </div>
                          </div>
                        )
                      });
                  })()}
                </div>
              </Card>
            </div>

            {/* Gerencial Report visual list */}
            <Card padding="none">
              <CardHeader title="Reporte Gerencial Consolidado" subtitle="Agrupado por categorías y tipo de operación" />
              <div style={{ padding: '0 24px 24px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h5 style={{ fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Ingresos por Categoría</h5>
                    {(() => {
                      const ingGroups: { [key: string]: number } = {};
                      monthlyMovements.filter(m => m.type === 'in').forEach(m => {
                        const cat = m.category || 'venta';
                        ingGroups[cat] = (ingGroups[cat] || 0) + toArs(m.amount, m.currency || 'ARS');
                      });
                      return Object.entries(ingGroups).map(([cat, sum]) => (
                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.875rem' }}>
                          <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(sum)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <div>
                    <h5 style={{ fontWeight: 700, marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Egresos por Categoría</h5>
                    {(() => {
                      const egGroups: { [key: string]: number } = {};
                      monthlyMovements.filter(m => m.type === 'out').forEach(m => {
                        const cat = m.category || 'gastos';
                        egGroups[cat] = (egGroups[cat] || 0) + toArs(m.amount, m.currency || 'ARS');
                      });
                      return Object.entries(egGroups).map(([cat, sum]) => (
                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.875rem' }}>
                          <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(sum)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB: SOCIOS (PANEL SOCIETARIO, APORTES, DEVOLUCIONES, FICHAS) --- */}
        {activeTab === 'socios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header / Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Panel Societario de Distribución y Aportes</h3>
              <button onClick={() => setIsSocioModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} /> Nuevo Movimiento Societario
              </button>
            </div>

            {/* Resumen por Socio */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
              {partners.length === 0 ? (
                <EmptyState icon={Users} title="Sin socios configurados" description="Configure socios desde Configuración -> Socios para ver métricas aquí." />
              ) : (
                partners.map(partner => {
                  const stats = socioSummary[partner.id!] || { aportado: 0, retirado: 0, neto: 0, disponible: 0 };
                  return (
                    <Card key={partner.id} padding="md" style={{ borderTop: `4px solid var(--primary-color)` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{partner.name}</h3>
                        <span style={{ padding: '4px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {partner.share}% Part.
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Aportado</span>
                          <b style={{ color: '#16a34a' }}>{formatCurrency(stats.aportado)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Retirado/Dev.</span>
                          <b style={{ color: '#dc2626' }}>{formatCurrency(stats.retirado)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', fontSize: '1.1rem' }}>
                          <b>Saldo Neto</b>
                          <b style={{ color: 'var(--primary-color)' }}>{formatCurrency(stats.neto)}</b>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Historial de Transacciones */}
            <Card>
              <CardHeader title="Historial de Movimientos Societarios" subtitle="Registro único de la verdad para aportes y retiros" />
              <div style={{ padding: '0 24px 24px 24px' }}>
                {transactions.length === 0 ? (
                  <EmptyState icon={History} title="Sin movimientos" description="Aún no hay aportes ni retiros registrados." />
                ) : (
                  <Table
                    data={transactions}
                    keyExtractor={t => t.id!}
                    columns={[
                      { header: 'Fecha', accessor: t => new Date(t.date).toLocaleDateString(), width: '100px' },
                      { header: 'Socio', accessor: t => partners.find(p => p.id === t.partnerId)?.name || 'Desconocido' },
                      { header: 'Tipo', accessor: t => t.contributionType || 'DINERO' },
                      { 
                        header: 'Operación', 
                        accessor: t => (
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                            backgroundColor: t.type === 'APORTE' ? '#dcfce7' : t.type === 'RETIRO' ? '#fee2e2' : '#fef9c3',
                            color: t.type === 'APORTE' ? '#166534' : t.type === 'RETIRO' ? '#991b1b' : '#854d0e'
                          }}>
                            {t.type}
                          </span>
                        ) 
                      },
                      { header: 'Descripción', accessor: t => t.description || '-' },
                      { 
                        header: 'Importe', 
                        accessor: t => (
                          <b style={{ color: t.type === 'APORTE' ? '#16a34a' : '#dc2626' }}>
                            {t.type === 'APORTE' ? '+' : '-'}{formatCurrency(t.amount)}
                          </b>
                        ),
                        align: 'right',
                        width: '120px'
                      }
                    ]}
                  />
                )}
              </div>
            </Card>

            {/* Modal de Nuevo Movimiento */}
            {isSocioModalOpen && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '28px', borderRadius: '16px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Nuevo Movimiento Societario</h3>
                  
                  <form onSubmit={handleSocioSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Socio</label>
                      <select 
                        className="input-field" 
                        value={socioFormData.partnerId} 
                        onChange={e => setSocioFormData({...socioFormData, partnerId: e.target.value})}
                        required
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      >
                        <option value="">Seleccione un socio...</option>
                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Tipo de Operación</label>
                        <select 
                          className="input-field" 
                          value={socioFormData.type} 
                          onChange={e => setSocioFormData({...socioFormData, type: e.target.value})}
                          required
                          style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                        >
                          <option value="APORTE">Aporte de Capital</option>
                          <option value="RETIRO">Retiro de Capital</option>
                          <option value="DEVOLUCION">Devolución de Aporte</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Naturaleza del Capital</label>
                        <select 
                          className="input-field" 
                          value={socioFormData.contributionType} 
                          onChange={e => {
                            const val = e.target.value;
                            setSocioFormData({
                              ...socioFormData, 
                              contributionType: val,
                              method: val === 'DINERO' ? 'CAJA' : 'COMPENSACION'
                            })
                          }}
                          required
                          style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                        >
                          <option value="DINERO">Dinero (Liquidez)</option>
                          <option value="MERCADERIA">Mercadería</option>
                          <option value="MAQUINARIA">Maquinaria</option>
                          <option value="INSUMOS">Insumos</option>
                          <option value="SERVICIOS">Servicios Capitalizados</option>
                        </select>
                      </div>
                    </div>

                    {socioFormData.contributionType === 'DINERO' && (
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Impacto en Tesorería (Caja/Bancos)</label>
                        <select 
                          className="input-field" 
                          value={socioFormData.method} 
                          onChange={e => setSocioFormData({...socioFormData, method: e.target.value})}
                          required
                          style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                        >
                          <option value="CAJA">Ingresó a Caja Física</option>
                          <option value="BANCO">Ingresó a Cuentas Bancarias</option>
                          <option value="COMPENSACION">No impactó liquidez (Compensación de Deuda)</option>
                        </select>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Defina si este aporte monetario aumentó el dinero real disponible en la empresa.
                        </span>
                      </div>
                    )}

                    {(socioFormData.contributionType === 'MERCADERIA' || socioFormData.contributionType === 'INSUMOS') && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Producto Aportado</label>
                          <select 
                            className="input-field" 
                            value={socioFormData.productId} 
                            onChange={e => setSocioFormData({...socioFormData, productId: e.target.value})}
                            required
                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                          >
                            <option value="">Seleccione producto...</option>
                            {socioFormData.contributionType === 'MERCADERIA' && mercaderias.filter(m => m.isActive).map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                            {socioFormData.contributionType === 'INSUMOS' && insumos.filter(i => i.isActive).map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        </div>
                        <Input 
                          label={socioFormData.contributionType === 'MERCADERIA' ? "Cantidad (Kg)" : "Cantidad (Unidades)"} 
                          type="number" 
                          min="0.01" 
                          step="0.01" 
                          value={socioFormData.quantity} 
                          onChange={(e: any) => setSocioFormData({...socioFormData, quantity: e.target.value})} 
                          required 
                        />
                      </div>
                    )}

                    <Input 
                      label="Importe ($)" 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={socioFormData.amount} 
                      onChange={(e: any) => setSocioFormData({...socioFormData, amount: e.target.value})} 
                      required 
                    />
                    
                    <Input 
                      label="Descripción / Referencia" 
                      value={socioFormData.description} 
                      onChange={(e: any) => setSocioFormData({...socioFormData, description: e.target.value})} 
                      required 
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsSocioModalOpen(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-primary">Guardar Movimiento</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: REINVERSIONES (INVERSIONES APARTE) --- */}
        {activeTab === 'reinversiones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Panel de Reinversiones y Bienes de Capital</h3>
              <button onClick={() => setIsCreatingReinv(true)} className="btn btn-primary">
                <Plus size={16} /> Registrar Reinversión
              </button>
            </div>

            {/* Reinversión KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <Card padding="sm" style={{ borderLeft: '4px solid #f59e0b' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Reinvertido este mes</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
                  {formatCurrency(reinversionesMesArs)}
                </h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #d97706' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Reinvertido este año</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '6px' }}>
                  {formatCurrency(
                    movements.filter(m => m.type === 'out' && (m.category || '').toLowerCase().includes('inversion'))
                      .filter(r => isSameYear(r.date))
                      .reduce((sum, r) => sum + toArs(r.amount, r.currency || 'ARS'), 0)
                  )}
                </h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #b45309' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Reinvertido Histórico</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#78350f', marginTop: '6px' }}>
                  {formatCurrency(
                    movements.filter(m => m.type === 'out' && (m.category || '').toLowerCase().includes('inversion'))
                             .reduce((sum, r) => sum + toArs(r.amount, r.currency || 'ARS'), 0)
                  )}
                </h3>
              </Card>
            </div>

            {/* Groups and listings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              
              {/* Category summary groups */}
              <Card>
                <CardHeader title="Composición por Categoría" subtitle="Suma de reinversiones históricas por rubro" />
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {(() => {
                    const allReinvs = movements.filter(m => m.type === 'out' && (m.category || '').toLowerCase().includes('inversion'));
                    const totalReinv = allReinvs.reduce((sum, r) => sum + toArs(r.amount, r.currency || 'ARS'), 0);
                    const groups: { [key: string]: number } = {};
                    allReinvs.forEach(r => {
                      const catName = r.description || 'Inversión';
                      groups[catName] = (groups[catName] || 0) + toArs(r.amount, r.currency || 'ARS');
                    });

                    if (totalReinv === 0) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay registros.</p>;

                    return Object.entries(groups)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, sum]) => {
                        const pct = (sum / totalReinv) * 100;
                        return (
                          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 600 }}>{cat}</span>
                              <span>{formatCurrency(sum)} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }}></div>
                            </div>
                          </div>
                        )
                      });
                  })()}
                </div>
              </Card>

              {/* Reinversiones del Periodo Table */}
              <Card padding="none">
                <CardHeader title="Registro de Reinversiones del Período" subtitle="Desglose mensual de inversión de bienes" />
                <div style={{ padding: '0 24px 24px 24px' }}>
                  {monthlyReinvestments.length === 0 ? (
                    <EmptyState icon={Briefcase} title="Sin reinversiones este mes" description="Las reinversiones registradas aparecerán aquí." />
                  ) : (
                    <Table 
                      data={monthlyReinvestments}
                      keyExtractor={item => item.id!}
                      columns={[
                        {
                          header: 'Fecha',
                          accessor: item => new Date(item.date).toLocaleDateString(),
                          width: '120px'
                        },
                        {
                          header: 'Categoría',
                          accessor: item => item.category,
                          width: '150px'
                        },
                        {
                          header: 'Monto Original',
                          accessor: item => `${getSymbol(item.currency || 'ARS')} ${formatNumber(item.amount)} ${item.currency || 'ARS'}`,
                          align: 'right',
                          width: '150px'
                        },
                        {
                          header: 'Observación',
                          accessor: item => item.description
                        }
                      ]}
                    />
                  )}
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* --- TAB: HISTORICO (GENERAL CASH MOVEMENTS WITH RUNNING BALANCE) --- */}
        {activeTab === 'historico' && (
          <Card padding="none">
            <CardHeader title="Registro Histórico General de Caja y Bancos" subtitle="Lista completa de transacciones monetarias registradas en el mes" />
            <div style={{ padding: '0 24px 24px 24px' }}>
              {movementsToShow.length === 0 ? (
                <EmptyState icon={History} title="Sin transacciones" description="No hay movimientos en este período." />
              ) : (
                <Table 
                  data={movementsToShow}
                  keyExtractor={item => item.id!}
                  columns={[
                    {
                      header: 'Fecha',
                      accessor: item => new Date(item.date).toLocaleDateString(),
                      width: '100px'
                    },
                    {
                      header: 'Medio',
                      accessor: item => (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize', fontSize: '0.8rem' }}>
                          {item.origin === 'cash' ? 'Caja' : `Banco (${item.method})`}
                        </span>
                      ),
                      width: '140px'
                    },
                    {
                      header: 'Detalle',
                      accessor: item => (
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cat: {item.category} {item.referenceId ? `| Ref: ${item.referenceId}` : ''}</div>
                        </div>
                      )
                    },
                    {
                      header: 'Ingreso (ARS Eq)',
                      accessor: item => item.type === 'in' ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>+{formatCurrency(toArs(item.amount, item.currency || 'ARS'))}</span>
                      ) : '-',
                      align: 'right',
                      width: '140px'
                    },
                    {
                      header: 'Egreso (ARS Eq)',
                      accessor: item => item.type === 'out' ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>-{formatCurrency(toArs(item.amount, item.currency || 'ARS'))}</span>
                      ) : '-',
                      align: 'right',
                      width: '140px'
                    },
                    {
                      header: 'Saldo Acumulado (ARS)',
                      accessor: item => (
                        <span style={{ fontWeight: 700, color: item.runningBalanceArs >= 0 ? 'var(--text-primary)' : '#dc2626' }}>
                          {formatCurrency(item.runningBalanceArs)}
                        </span>
                      ),
                      align: 'right',
                      width: '165px'
                    },
                    {
                      header: 'Acciones',
                      accessor: item => (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleEditClick(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }} title="Editar / Reclasificar">
                            <History size={16} />
                          </button>
                          <button onClick={() => handleDeleteClick(item.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ),
                      align: 'right',
                      width: '80px'
                    }
                  ]}
                />
              )}
            </div>
          </Card>
        )}

        {/* --- TAB: BANCOS --- */}
        {activeTab === 'bancos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Resumen de Cuentas Bancarias Operativas</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {(banks || []).map(bank => {
                const bal = getBankBalanceArs(bank.id!, bank.name);
                return (
                  <Card key={bank.id} padding="sm" style={{ borderLeft: bank.isActive ? '4px solid #4f46e5' : '4px solid #94a3b8', opacity: bank.isActive ? 1 : 0.7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', backgroundColor: bank.isActive ? '#e0e7ff' : '#f1f5f9', color: bank.isActive ? '#4f46e5' : '#64748b', borderRadius: '10px' }}>
                        <Landmark size={20} />
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{bank.name}</p>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                          {bank.accountType} ({bank.currency}) {!bank.isActive && '- Inactiva'}
                        </span>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b', marginTop: '4px' }}>{formatCurrency(bal)}</h3>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Bank Movements table */}
            <Card padding="none">
              <CardHeader title="Historial Bancario Completo" subtitle="Movimientos filtrados correspondientes únicamente a cuentas de Banco" />
              <div style={{ padding: '0 24px 24px 24px' }}>
                {movementsToShow.filter(m => m.origin === 'bank' || !!m.bankId).length === 0 ? (
                  <EmptyState icon={Landmark} title="Sin movimientos bancarios" description="No se han registrado transacciones asociadas a bancos." />
                ) : (
                  <Table 
                    data={movementsToShow.filter(m => m.origin === 'bank' || !!m.bankId)}
                    keyExtractor={item => item.id!}
                    columns={[
                      {
                        header: 'Fecha',
                        accessor: item => new Date(item.date).toLocaleDateString(),
                        width: '120px'
                      },
                      {
                        header: 'Banco / Detalle',
                        accessor: item => item.description
                      },
                      {
                        header: 'Medio',
                        accessor: item => item.method.toUpperCase(),
                        width: '120px',
                        align: 'center'
                      },
                      {
                        header: 'Importe Original',
                        accessor: item => `${getSymbol(item.currency || 'ARS')} ${formatNumber(item.amount)} ${item.currency || 'ARS'}`,
                        align: 'right',
                        width: '150px'
                      },
                      {
                        header: 'Equivalente ARS',
                        accessor: item => (
                          <span style={{ fontWeight: 600, color: item.type === 'in' ? '#16a34a' : '#dc2626' }}>
                            {item.type === 'in' ? '+' : '-'}{formatCurrency(toArs(item.amount, item.currency || 'ARS'))}
                          </span>
                        ),
                        align: 'right',
                        width: '150px'
                      }
                    ]}
                  />
                )}
              </div>
            </Card>
          </div>
        )}

      </div>
    </>
  );
};

export default CajaBancos;
