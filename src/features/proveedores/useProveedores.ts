import React, { useEffect, useCallback, useState } from 'react';
import { useProveedoresStore } from '../../store/proveedoresStore';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import type { Supplier, SupplierMovement } from '../../types/domain';

export type ShowPanelType = false | 'COMPRA' | 'PAGO' | 'AJUSTE' | 'NEW_SUPPLIER' | 'EDIT_SUPPLIER';

export function useProveedores() {
  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);
  const suppliers = useProveedoresStore((state) => state.suppliers);
  const movements = useProveedoresStore((state) => state.movements);
  const loading = useProveedoresStore((state) => state.loading);
  const subscribeAll = useProveedoresStore((state) => state.subscribeAll);
  const registerCompra = useProveedoresStore((state) => state.registerCompra);
  const registerPago = useProveedoresStore((state) => state.registerPago);
  const registerAjuste = useProveedoresStore((state) => state.registerAjuste);
  const annulMovement = useProveedoresStore((state) => state.annulMovement);
  const saveSupplier = useProveedoresStore((state) => state.saveSupplier);
  const toggleSupplierStatus = useProveedoresStore((state) => state.toggleSupplierStatus);

  useEffect(() => {
    const unsubscribe = subscribeAll();
    return () => unsubscribe();
  }, [subscribeAll]);

  const getImpact = useCallback((mov: SupplierMovement): number => {
    if (mov.type === 'COMPRA') return mov.amount; // suma deuda
    if (mov.type === 'PAGO') return -mov.amount; // resta deuda
    if (mov.type === 'AJUSTE') return mov.amount; // +/- según ajuste
    if (mov.type === 'ANULACION') return mov.amount;
    return 0;
  }, []);

  // REGLA V2: Proveedores NO tienen saldo almacenado. Todo saldo se deriva en runtime.
  const getCalculatedBalance = useCallback((supplierId: string) => {
    const suppMovs = movements.filter(m => m.supplierId === supplierId);
    return suppMovs.reduce((acc, mov) => acc + getImpact(mov), 0);
  }, [movements, getImpact]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showPanel, setShowPanel] = useState<ShowPanelType>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  useEffect(() => {
    if (accounts.length > 0) {
      const activeCash = accounts.find(a => a.activa && a.tipo === 'EFECTIVO');
      const activeAny = accounts.find(a => a.activa);
      setSelectedAccountId(activeCash?.id || activeAny?.id || '');
    }
  }, [accounts, showPanel]);
  
  // Supplier Form states
  const [supplierName, setSupplierName] = useState('');
  const [supplierRazonSocial, setSupplierRazonSocial] = useState('');
  const [supplierCuit, setSupplierCuit] = useState('');
  const [supplierTelefono, setSupplierTelefono] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierDireccion, setSupplierDireccion] = useState('');
  const [supplierObservaciones, setSupplierObservaciones] = useState('');
  const [supplierActivo, setSupplierActivo] = useState(true);

  // CC Movement Form states
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sourceId, setSourceId] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [fromCaja, setFromCaja] = useState<boolean>(true);

  const handleOpenTransactionPanel = useCallback((supplierId: string, type: 'COMPRA' | 'PAGO' | 'AJUSTE') => {
    setSelectedSupplierId(supplierId);
    setShowPanel(type);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setSourceId('');
    setObservaciones('');
    setFromCaja(true);
  }, []);

  const handleOpenNewSupplier = useCallback(() => {
    setShowPanel('NEW_SUPPLIER');
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierRazonSocial('');
    setSupplierCuit('');
    setSupplierTelefono('');
    setSupplierEmail('');
    setSupplierDireccion('');
    setSupplierObservaciones('');
    setSupplierActivo(true);
  }, []);

  const handleOpenEditSupplier = useCallback((e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation();
    setShowPanel('EDIT_SUPPLIER');
    setSelectedSupplierId(supplier.id);
    setSupplierName(supplier.nombre);
    setSupplierRazonSocial(supplier.razonSocial || '');
    setSupplierCuit(supplier.cuit || '');
    setSupplierTelefono(supplier.telefono || '');
    setSupplierEmail(supplier.email || '');
    setSupplierDireccion(supplier.direccion || '');
    setSupplierObservaciones(supplier.observaciones || '');
    setSupplierActivo(supplier.activo);
  }, []);

  const handleClosePanel = useCallback(() => {
    setShowPanel(false);
    setSelectedSupplierId('');
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (showPanel === 'NEW_SUPPLIER' || showPanel === 'EDIT_SUPPLIER') {
      if (!supplierName.trim()) {
        alert("El nombre comercial es obligatorio.");
        return;
      }
      try {
        const supplierData: Partial<Supplier> = {
          nombre: supplierName,
          razonSocial: supplierRazonSocial,
          cuit: supplierCuit,
          telefono: supplierTelefono,
          email: supplierEmail,
          direccion: supplierDireccion,
          observaciones: supplierObservaciones,
          activo: supplierActivo
        };
        if (selectedSupplierId) {
          supplierData.id = selectedSupplierId;
        }
        await saveSupplier(supplierData);
        handleClosePanel();
      } catch (error) {
        console.error("Error al guardar proveedor:", error);
        alert("No se pudo guardar el proveedor.");
      }
      return;
    }

    if (!amount || typeof amount !== 'number') return;

    try {
      if (showPanel === 'COMPRA') {
        await registerCompra(selectedSupplierId, amount, date, sourceId, observaciones);
      } else if (showPanel === 'PAGO') {
        if (fromCaja && !selectedAccountId) {
          alert("Debe seleccionar una cuenta financiera.");
          return;
        }
        await registerPago(selectedSupplierId, amount, date, sourceId, observaciones, fromCaja, fromCaja ? selectedAccountId : undefined);
      } else if (showPanel === 'AJUSTE') {
        await registerAjuste(selectedSupplierId, amount, date, observaciones);
      }
      handleClosePanel();
    } catch (error) {
      console.error("Error registrando movimiento:", error);
      alert("Error al registrar movimiento.");
    }
  }, [
    showPanel,
    supplierName,
    supplierRazonSocial,
    supplierCuit,
    supplierTelefono,
    supplierEmail,
    supplierDireccion,
    supplierObservaciones,
    supplierActivo,
    selectedSupplierId,
    amount,
    date,
    sourceId,
    observaciones,
    fromCaja,
    selectedAccountId,
    accounts,
    saveSupplier,
    registerCompra,
    registerPago,
    registerAjuste,
    handleClosePanel
  ]);

  const handleToggleStatus = useCallback(async (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation();
    try {
      await toggleSupplierStatus(supplier.id, supplier.activo);
    } catch (error) {
      console.error("Error al cambiar estado de proveedor:", error);
    }
  }, [toggleSupplierStatus]);

  const handleAnnul = useCallback(async (movId: string) => {
    const reason = window.prompt("Ingrese el motivo de anulación:");
    if (!reason || !reason.trim()) return;
    
    try {
      await annulMovement(movId, reason);
    } catch (error) {
      console.error("Error al anular:", error);
      alert("No se pudo anular el movimiento.");
    }
  }, [annulMovement]);

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.cuit && s.cuit.includes(searchTerm)) ||
      (s.razonSocial && s.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'active') return matchesSearch && s.activo;
    if (statusFilter === 'inactive') return matchesSearch && !s.activo;
    return matchesSearch;
  });

  return {
    suppliers,
    movements,
    loading,
    registerCompra,
    registerPago,
    registerAjuste,
    annulMovement,
    getCalculatedBalance,
    saveSupplier,
    toggleSupplierStatus,
    
    // UI states & actions
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    showPanel,
    selectedSupplierId,
    supplierName,
    setSupplierName,
    supplierRazonSocial,
    setSupplierRazonSocial,
    supplierCuit,
    setSupplierCuit,
    supplierTelefono,
    setSupplierTelefono,
    supplierEmail,
    setSupplierEmail,
    supplierDireccion,
    setSupplierDireccion,
    supplierObservaciones,
    setSupplierObservaciones,
    supplierActivo,
    setSupplierActivo,
    amount,
    setAmount,
    date,
    setDate,
    sourceId,
    setSourceId,
    observaciones,
    setObservaciones,
    fromCaja,
    setFromCaja,
    
    handleOpenTransactionPanel,
    handleOpenNewSupplier,
    handleOpenEditSupplier,
    handleClosePanel,
    handleSubmit,
    handleToggleStatus,
    handleAnnul,
    filteredSuppliers,
    accounts,
    selectedAccountId,
    setSelectedAccountId
  };
}
