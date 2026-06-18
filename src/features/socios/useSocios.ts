import React, { useEffect, useCallback, useState } from 'react';
import { useSociosStore } from '../../store/sociosStore';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import type { Shareholder } from '../../types/domain';

export type MovFormType = 'APORTE_INICIAL' | 'APORTE_OPERATIVO' | 'RETIRO' | 'AJUSTE';

export function useSocios() {
  const shareholders = useSociosStore((state) => state.shareholders);
  const movements = useSociosStore((state) => state.movements);
  const loading = useSociosStore((state) => state.loading);
  const subscribeAll = useSociosStore((state) => state.subscribeAll);
  const addMovement = useSociosStore((state) => state.addMovement);
  const annulMovement = useSociosStore((state) => state.annulMovement);
  const saveShareholder = useSociosStore((state) => state.saveShareholder);
  const toggleShareholderStatus = useSociosStore((state) => state.toggleShareholderStatus);

  useEffect(() => {
    const unsubscribe = subscribeAll();
    return () => unsubscribe();
  }, [subscribeAll]);

  const getBalance = useCallback((shareholderId: string) => {
    const movs = movements.filter(m => m.shareholderId === shareholderId);
    return movs.reduce((acc, mov) => {
      if (mov.sourceType === 'APORTE') return acc + mov.amount;
      if (mov.sourceType === 'RETIRO') return acc - mov.amount;
      if (mov.sourceType === 'AJUSTE') return acc + mov.amount; // Ajustes pueden ser pos o neg
      if (mov.sourceType === 'ANULACION') return acc + mov.amount; 
      return acc;
    }, 0);
  }, [movements]);

  // Search and status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // RightPanel state
  const [panelMode, setPanelMode] = useState<'NEW_SOCIO' | 'EDIT_SOCIO' | 'MOVEMENT' | null>(null);
  const [selectedShareholderId, setSelectedShareholderId] = useState<string>('');

  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      const activeCash = accounts.find(a => a.activa && a.tipo === 'EFECTIVO');
      const activeAny = accounts.find(a => a.activa);
      setSelectedAccountId(activeCash?.id || activeAny?.id || '');
    }
  }, [accounts, panelMode]);
  
  // Partner Form State
  const [socioName, setSocioName] = useState('');
  const [socioType, setSocioType] = useState<'ACTIVO' | 'INVERSOR' | 'OPERATIVO'>('ACTIVO');
  const [socioPercentage, setSocioPercentage] = useState<number | ''>('');
  const [socioActivo, setSocioActivo] = useState(true);

  // Movement Form State
  const [movType, setMovType] = useState<MovFormType>('APORTE_INICIAL');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [impactCaja, setImpactCaja] = useState<boolean>(true);

  const handleOpenNewSocio = useCallback(() => {
    setPanelMode('NEW_SOCIO');
    setSelectedShareholderId('');
    setSocioName('');
    setSocioType('ACTIVO');
    setSocioPercentage('');
    setSocioActivo(true);
  }, []);

  const handleOpenEditSocio = useCallback((e: React.MouseEvent, socio: Shareholder) => {
    e.stopPropagation();
    setPanelMode('EDIT_SOCIO');
    setSelectedShareholderId(socio.id);
    setSocioName(socio.nombre);
    setSocioType(socio.type);
    setSocioPercentage(socio.participacionPorcentaje);
    setSocioActivo(socio.activo);
  }, []);

  const handleOpenMovementPanel = useCallback((socioId: string, defaultType: MovFormType) => {
    setSelectedShareholderId(socioId);
    setMovType(defaultType);
    setAmount('');
    setDescription('');
    
    if (defaultType === 'APORTE_INICIAL') setImpactCaja(true);
    if (defaultType === 'APORTE_OPERATIVO') setImpactCaja(false);
    if (defaultType === 'RETIRO') setImpactCaja(true);
    if (defaultType === 'AJUSTE') setImpactCaja(false);
    
    setPanelMode('MOVEMENT');
  }, []);

  const handleMovTypeChange = useCallback((type: MovFormType) => {
    setMovType(type);
    if (type === 'APORTE_INICIAL') setImpactCaja(true);
    if (type === 'RETIRO') setImpactCaja(true);
    if (type === 'AJUSTE') setImpactCaja(false);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelMode(null);
    setSelectedShareholderId('');
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (panelMode === 'NEW_SOCIO' || panelMode === 'EDIT_SOCIO') {
      if (!socioName.trim()) {
        alert("El nombre del socio es obligatorio.");
        return;
      }
      try {
        const socioData: Partial<Shareholder> = {
          nombre: socioName,
          type: socioType,
          participacionPorcentaje: Number(socioPercentage || 0),
          activo: socioActivo
        };
        if (selectedShareholderId) {
          socioData.id = selectedShareholderId;
        }
        await saveShareholder(socioData);
        handleClosePanel();
      } catch (error) {
        console.error("Error al guardar socio:", error);
        alert("No se pudo guardar el socio.");
      }
      return;
    }

    if (!amount || amount <= 0 || !selectedShareholderId) return;

    let sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE' = 'APORTE';
    if (movType === 'RETIRO') sourceType = 'RETIRO';
    if (movType === 'AJUSTE') sourceType = 'AJUSTE';

    let cajaCategory = 'SOCIOS';
    if (movType === 'APORTE_INICIAL') cajaCategory = 'Aporte Inicial de Socio';
    if (movType === 'APORTE_OPERATIVO') cajaCategory = 'Aporte Operativo de Socio';
    if (movType === 'RETIRO') cajaCategory = 'Distribución / Retiro de Socio';

    try {
      if (impactCaja && !selectedAccountId) {
        alert("Debe seleccionar una cuenta financiera.");
        return;
      }
      await addMovement({
        shareholderId: selectedShareholderId,
        sourceType,
        amount: Number(amount),
        description: description || movType.replace('_', ' '),
        impactCaja,
        cajaCategory,
        accountId: impactCaja ? selectedAccountId : undefined
      });
      handleClosePanel();
    } catch (error) {
      console.error("Error al registrar movimiento:", error);
      alert("Error al registrar movimiento.");
    }
  }, [
    panelMode,
    socioName,
    socioType,
    socioPercentage,
    socioActivo,
    selectedShareholderId,
    amount,
    movType,
    description,
    impactCaja,
    selectedAccountId,
    accounts,
    saveShareholder,
    addMovement,
    handleClosePanel
  ]);

  const handleToggleStatus = useCallback(async (e: React.MouseEvent, socio: Shareholder) => {
    e.stopPropagation();
    try {
      await toggleShareholderStatus(socio.id, socio.activo);
    } catch (error) {
      console.error("Error al cambiar estado de socio:", error);
    }
  }, [toggleShareholderStatus]);

  const handleAnnul = useCallback(async (id: string) => {
    const reason = window.prompt("Motivo de anulación:");
    if (!reason || !reason.trim()) return;
    try {
      await annulMovement(id, reason);
    } catch (error) {
      console.error("Error al anular movimiento:", error);
      alert("No se pudo anular el movimiento.");
    }
  }, [annulMovement]);

  const filteredShareholders = shareholders.filter(s => {
    const matchesSearch = s.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'active') return matchesSearch && s.activo;
    if (statusFilter === 'inactive') return matchesSearch && !s.activo;
    return matchesSearch;
  });

  return {
    shareholders,
    movements,
    loading,
    addMovement,
    annulMovement,
    getBalance,
    saveShareholder,
    toggleShareholderStatus,
    
    // UI state & actions
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    panelMode,
    selectedShareholderId,
    socioName,
    setSocioName,
    socioType,
    setSocioType,
    socioPercentage,
    setSocioPercentage,
    socioActivo,
    setSocioActivo,
    movType,
    amount,
    setAmount,
    description,
    setDescription,
    impactCaja,
    setImpactCaja,
    
    handleOpenNewSocio,
    handleOpenEditSocio,
    handleOpenMovementPanel,
    handleMovTypeChange,
    handleClosePanel,
    handleSubmit,
    handleToggleStatus,
    handleAnnul,
    filteredShareholders,
    accounts,
    selectedAccountId,
    setSelectedAccountId
  };
}
