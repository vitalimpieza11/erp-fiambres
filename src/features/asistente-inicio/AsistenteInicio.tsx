import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { useSociosStore } from '../../store/sociosStore';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
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
  Trash2
} from 'lucide-react';
import './AsistenteInicio.css';

export default function AsistenteInicio() {
  const navigate = useNavigate();
  const { products, fetchData: fetchStock } = useStockStore();
  const { shareholders, subscribeAll } = useSociosStore();
  const { accounts, fetchAccounts } = useFinancialAccountsStore();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [fechaCorte, setFechaCorte] = useState<string>('2026-06-17');

  // Stock Inicial State
  const [stocksList, setStocksList] = useState<{
    productId: string;
    nombre: string;
    stockFisico: number;
    currentStock: number;
  }[]>([]);

  // Insumos State
  const [insumosList, setInsumosList] = useState<{
    productId: string;
    nombre: string;
    compraCosto: number;
    cantidadComprada: number;
    cantidadActual: number;
  }[]>([]);

  // Compras Históricas State
  const [comprasHist, setComprasHist] = useState<{ date: string; amount: number }[]>([
    { date: '2026-06-08', amount: 413989.00 },
    { date: '2026-06-15', amount: 161458.05 },
    { date: '2026-06-16', amount: 367652.50 }
  ]);

  // Ventas Históricas State
  const [ventasHist, setVentasHist] = useState<{ date: string; amount: number; cost: number }[]>([
    { date: '2026-06-12', amount: 391219.30, cost: 215000.00 },
    { date: '2026-06-16', amount: 833113.00, cost: 458000.00 }
  ]);

  // Aportes State
  const [aportesList, setAportesList] = useState<{
    shareholderId: string;
    shareholderName: string;
    description: string;
    amount: number;
  }[]>([]);

  // Préstamos State
  const [prestamosList, setPrestamosList] = useState<{
    shareholderId: string;
    shareholderName: string;
    description: string;
    amount: number;
  }[]>([]);

  // Caja Inicial State
  const [cajaInicialList, setCajaInicialList] = useState<{
    accountId: string;
    accountName: string;
    amount: number;
  }[]>([]);

  // Load stores data
  useEffect(() => {
    fetchStock();
    const unsub = subscribeAll();
    fetchAccounts();
    return () => {
      unsub();
    };
  }, [fetchStock, subscribeAll, fetchAccounts]);

  // Match and initialize products / shareholders / accounts once loaded
  useEffect(() => {
    if (products.length > 0 && stocksList.length === 0) {
      // Find default products to populate
      const matchedStocks = [
        { key: 'trecer', name: 'Jamón cocido Trecer', val: 15.85 },
        { key: 'paulina', name: 'Queso La Paulina', val: 17.66 },
        { key: 'cheddar', name: 'Cheddar', val: 5.05 },
        { key: 'grasseto', name: 'Jamón cocido Grasseto', val: 4.26 },
        { key: 'crudo', name: 'Jamón crudo', val: 1.0 },
        { key: 'panceta', name: 'Panceta', val: 2.31 }
      ].map(p => {
        const found = products.find(prod => prod.nombre.toLowerCase().includes(p.key) && prod.type === 'MERCADERIA');
        return {
          productId: found?.id || '',
          nombre: found?.nombre || p.name,
          stockFisico: p.val,
          currentStock: found?.stockActual || 0
        };
      });

      setStocksList(matchedStocks.filter(s => s.productId !== ''));

      // Find insumos
      const matchedInsumos = [
        { key: 'bolsa', name: 'Bolsas', costo: 278062.0, cantComp: 500, cantAct: 450 },
        { key: 'folex', name: 'Folex', costo: 19200.0, cantComp: 4, cantAct: 4 }
      ].map(ins => {
        const found = products.find(prod => prod.nombre.toLowerCase().includes(ins.key) && prod.type === 'INSUMO');
        return {
          productId: found?.id || '',
          nombre: found?.nombre || ins.name,
          compraCosto: ins.costo,
          cantidadComprada: ins.cantComp,
          cantidadActual: ins.cantAct
        };
      });

      setInsumosList(matchedInsumos.filter(i => i.productId !== ''));
    }
  }, [products, stocksList.length]);

  // Match and initialize shareholders data once loaded
  useEffect(() => {
    if (shareholders.length > 0 && aportesList.length === 0) {
      const agus = shareholders.find(s => s.nombre.toLowerCase().includes('agus'));
      const lucas = shareholders.find(s => s.nombre.toLowerCase().includes('lucas'));

      const initialAportes: typeof aportesList = [];
      const initialPrestamos: typeof prestamosList = [];

      if (agus) {
        initialAportes.push(
          { shareholderId: agus.id, shareholderName: agus.nombre, description: 'Envasadora', amount: 691000 },
          { shareholderId: agus.id, shareholderName: agus.nombre, description: 'Mercadería lote 1', amount: 53320 },
          { shareholderId: agus.id, shareholderName: agus.nombre, description: 'Balanza', amount: 301000 },
          { shareholderId: agus.id, shareholderName: agus.nombre, description: 'Limpieza e higiene', amount: 15000 },
          { shareholderId: agus.id, shareholderName: agus.nombre, description: 'Mesa de trabajo', amount: 185000 },
          { shareholderId: agus.id, shareholderName: agus.nombre, description: 'Mercadería lote 2', amount: 413990 }
        );
      }

      if (lucas) {
        initialAportes.push(
          { shareholderId: lucas.id, shareholderName: lucas.nombre, description: 'Cortadora de fiambre', amount: 926000 },
          { shareholderId: lucas.id, shareholderName: lucas.nombre, description: 'Limpieza', amount: 5000 },
          { shareholderId: lucas.id, shareholderName: lucas.nombre, description: 'Impresora + etiquetas', amount: 366000 }
        );

        initialPrestamos.push({
          shareholderId: lucas.id,
          shareholderName: lucas.nombre,
          description: 'Préstamo en efectivo (Pasivo)',
          amount: 900000
        });
      }

      setAportesList(initialAportes);
      setPrestamosList(initialPrestamos);
    }
  }, [shareholders, aportesList.length]);

  // Match accounts
  useEffect(() => {
    if (accounts.length > 0 && cajaInicialList.length === 0) {
      setCajaInicialList(
        accounts.map(acc => ({
          accountId: acc.id,
          accountName: acc.nombre,
          amount: 0
        }))
      );
    }
  }, [accounts, cajaInicialList.length]);

  // Helpers to add or remove rows in tables
  const addStockRow = () => {
    const unselected = products.find(p => p.type === 'MERCADERIA' && !stocksList.some(s => s.productId === p.id));
    if (unselected) {
      setStocksList([...stocksList, {
        productId: unselected.id,
        nombre: unselected.nombre,
        stockFisico: 0,
        currentStock: unselected.stockActual || 0
      }]);
    }
  };

  const removeStockRow = (index: number) => {
    setStocksList(stocksList.filter((_, i) => i !== index));
  };

  const updateStockRow = (index: number, field: string, value: any) => {
    const newList = [...stocksList];
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        newList[index] = {
          ...newList[index],
          productId: prod.id,
          nombre: prod.nombre,
          currentStock: prod.stockActual || 0
        };
      }
    } else {
      newList[index] = { ...newList[index], [field]: value };
    }
    setStocksList(newList);
  };

  const updateInsumoRow = (index: number, field: string, value: number) => {
    const newList = [...insumosList];
    newList[index] = { ...newList[index], [field]: value };
    setInsumosList(newList);
  };

  const handleExecute = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload: InitialLoadData = {
        fechaCorte,
        stocks: stocksList.map(s => ({
          productId: s.productId,
          stockFisico: Number(s.stockFisico),
          currentStock: s.currentStock
        })),
        insumos: insumosList.map(i => ({
          productId: i.productId,
          nombre: i.nombre,
          compraCosto: Number(i.compraCosto),
          cantidadComprada: Number(i.cantidadComprada),
          cantidadActual: Number(i.cantidadActual)
        })),
        comprasHistoricas: comprasHist.map(c => ({
          date: c.date,
          amount: Number(c.amount)
        })),
        ventasHistoricas: ventasHist.map(v => ({
          date: v.date,
          amount: Number(v.amount),
          cost: Number(v.cost)
        })),
        aportes: aportesList.map(a => ({
          shareholderId: a.shareholderId,
          description: a.description,
          amount: Number(a.amount)
        })),
        prestamos: prestamosList.map(p => ({
          shareholderId: p.shareholderId,
          shareholderName: p.shareholderName,
          description: p.description,
          amount: Number(p.amount)
        })),
        cajaInicial: cajaInicialList.map(c => ({
          accountId: c.accountId,
          amount: Number(c.amount)
        }))
      };

      await initialLoadRepository.executeInitialLoad(payload);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocurrió un error inesperado al procesar la carga inicial.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Fecha de Corte', icon: <Calendar size={18} /> },
    { num: 2, label: 'Stock Inicial', icon: <Layers size={18} /> },
    { num: 3, label: 'Historial', icon: <TrendingUp size={18} /> },
    { num: 4, label: 'Socios', icon: <Users size={18} /> },
    { num: 5, label: 'Caja Inicial', icon: <Wallet size={18} /> },
    { num: 6, label: 'Confirmación', icon: <CheckCircle size={18} /> }
  ];

  return (
    <div className="asistente-container">
      <div className="asistente-header">
        <div className="asistente-icon-wrapper">
          <Sparkles size={24} color="#fff" />
        </div>
        <div>
          <h1 className="asistente-title">Asistente de Configuración Inicial</h1>
          <p className="asistente-subtitle">Migración y carga contable de negocio en marcha al ERP Al Vacío</p>
        </div>
      </div>

      {/* Steppers */}
      <div className="stepper-bar">
        {steps.map(s => (
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
          <h2>¡Carga Inicial Completada con Éxito!</h2>
          <p>
            El stock físico, los insumos, aportes de socios, préstamos, caja inicial y antecedentes 
            históricos se han cargado y consolidado de forma atómica en el sistema.
          </p>
          <div className="success-stats">
            <div>Stock Configurado: <strong>{stocksList.length + insumosList.length} ítems</strong></div>
            <div>Aportes de Socios: <strong>{aportesList.length} registros</strong></div>
            <div>Deudas Socios: <strong>${prestamosList.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}</strong></div>
          </div>
          <button className="asistente-btn-primary" onClick={() => navigate('/dashboard')}>
            Ir al Dashboard Principal
          </button>
        </div>
      ) : (
        <div className="asistente-card">
          {/* Step 1: Fecha de Corte */}
          {step === 1 && (
            <div className="step-content">
              <h3>Definición de Fecha de Corte</h3>
              <p className="step-desc">
                Establece el límite donde se consolida el saldo inicial contable y de stock. 
                Los movimientos operativos reales (compras, ventas, mermas) comenzarán a registrarse a partir de esta fecha.
              </p>

              <div className="form-group-corte">
                <label>Fecha de Inicio Operativo</label>
                <input 
                  type="date" 
                  value={fechaCorte} 
                  onChange={e => setFechaCorte(e.target.value)} 
                  className="input-corte"
                />
              </div>

              <div className="corte-info-box">
                <Info size={20} />
                <div>
                  <h4>Consolidación de Saldos</h4>
                  <p>
                    Toda transacción realizada con fecha anterior al <strong>17/06</strong> quedará agrupada 
                    únicamente como histórico contable y de trazabilidad, sin modificar el flujo de caja del ERP.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Stock Inicial */}
          {step === 2 && (
            <div className="step-content">
              <h3>Stock Físico Inicial & Insumos</h3>
              <p className="step-desc">
                Carga el inventario real al día de hoy. Estos valores generarán movimientos de stock 
                tipo <strong>AJUSTE INICIAL</strong> sin afectar deudas con proveedores ni saldos de caja.
              </p>

              <h4>1. Mercadería Existente</h4>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock Físico (Kg / Uni)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stocksList.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <select 
                          value={row.productId} 
                          onChange={e => updateStockRow(index, 'productId', e.target.value)}
                          className="table-select"
                        >
                          {products.filter(p => p.type === 'MERCADERIA').map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="number-input-wrapper">
                          <input 
                            type="number" 
                            step="any"
                            value={row.stockFisico} 
                            onChange={e => updateStockRow(index, 'stockFisico', parseFloat(e.target.value) || 0)}
                            className="table-input"
                          />
                          <span className="unit-label">Kg</span>
                        </div>
                      </td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => removeStockRow(index)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="asistente-btn-secondary add-row-btn" onClick={addStockRow}>
                <Plus size={16} /> Agregar Producto
              </button>

              <h4 style={{ marginTop: '24px' }}>2. Insumos en Inventario</h4>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Costo Compra</th>
                    <th>Cant. Comprada</th>
                    <th>Stock Actual</th>
                    <th>Costo Unitario (Auto)</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosList.map((row, index) => (
                    <tr key={index}>
                      <td><strong>{row.nombre}</strong></td>
                      <td>
                        <input 
                          type="number" 
                          value={row.compraCosto} 
                          onChange={e => updateInsumoRow(index, 'compraCosto', parseFloat(e.target.value) || 0)}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          value={row.cantidadComprada} 
                          onChange={e => updateInsumoRow(index, 'cantidadComprada', parseFloat(e.target.value) || 0)}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          value={row.cantidadActual} 
                          onChange={e => updateInsumoRow(index, 'cantidadActual', parseFloat(e.target.value) || 0)}
                          className="table-input"
                        />
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        ${((row.cantidadComprada > 0 ? row.compraCosto / row.cantidadComprada : 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 3: Historial */}
          {step === 3 && (
            <div className="step-content">
              <h3>Historial Operativo Pre-Sistema</h3>
              <p className="step-desc">
                Ingresa los registros consolidados de compras y ventas históricas previas a la fecha de corte. 
                Se utilizarán únicamente con propósitos analíticos y estados de resultados históricos.
              </p>

              <h4>Compras de Mercadería Consumida Históricamente</h4>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto Consolidado</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasHist.map((item, index) => (
                    <tr key={index}>
                      <td><strong>{item.date.split('-').reverse().join('/')}</strong></td>
                      <td>
                        <div className="price-input-wrapper">
                          <DollarSign size={14} />
                          <input 
                            type="number" 
                            value={item.amount}
                            onChange={e => {
                              const newC = [...comprasHist];
                              newC[index].amount = parseFloat(e.target.value) || 0;
                              setComprasHist(newC);
                            }}
                            className="table-input"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 style={{ marginTop: '24px' }}>Ventas Históricas e Historial de Ganancia</h4>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Total Vendido</th>
                    <th>Costo de Mercadería</th>
                    <th>Ganancia Estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasHist.map((item, index) => (
                    <tr key={index}>
                      <td><strong>{item.date.split('-').reverse().join('/')}</strong></td>
                      <td>
                        <div className="price-input-wrapper">
                          <DollarSign size={14} />
                          <input 
                            type="number" 
                            value={item.amount}
                            onChange={e => {
                              const newV = [...ventasHist];
                              newV[index].amount = parseFloat(e.target.value) || 0;
                              setVentasHist(newV);
                            }}
                            className="table-input"
                          />
                        </div>
                      </td>
                      <td>
                        <div className="price-input-wrapper">
                          <DollarSign size={14} />
                          <input 
                            type="number" 
                            value={item.cost}
                            onChange={e => {
                              const newV = [...ventasHist];
                              newV[index].cost = parseFloat(e.target.value) || 0;
                              setVentasHist(newV);
                            }}
                            className="table-input"
                          />
                        </div>
                      </td>
                      <td style={{ color: 'var(--success-color, #24b47e)', fontWeight: 600 }}>
                        ${(item.amount - item.cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 4: Socios */}
          {step === 4 && (
            <div className="step-content">
              <h3>Aportes y Préstamos de Socios</h3>
              <p className="step-desc">
                Registra los activos físicos y de capital aportados por los socios fundadores (Agus y Lucas) 
                así como los préstamos (pasivos financieros) otorgados por los mismos.
              </p>

              <h4>Aportes de Socios (Patrimonio Neto)</h4>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>Descripción de Activo / Concepto</th>
                    <th>Valor Monetario</th>
                  </tr>
                </thead>
                <tbody>
                  {aportesList.map((item, index) => (
                    <tr key={index}>
                      <td><strong>{item.shareholderName}</strong></td>
                      <td>{item.description}</td>
                      <td>
                        <div className="price-input-wrapper">
                          <DollarSign size={14} />
                          <input 
                            type="number" 
                            value={item.amount}
                            onChange={e => {
                              const newA = [...aportesList];
                              newA[index].amount = parseFloat(e.target.value) || 0;
                              setAportesList(newA);
                            }}
                            className="table-input"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 style={{ marginTop: '24px' }}>Préstamos de Socios (Deuda Pasiva)</h4>
              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Socio Prestador</th>
                    <th>Concepto</th>
                    <th>Monto Préstamo</th>
                  </tr>
                </thead>
                <tbody>
                  {prestamosList.map((item, index) => (
                    <tr key={index}>
                      <td><strong>{item.shareholderName}</strong></td>
                      <td>{item.description}</td>
                      <td>
                        <div className="price-input-wrapper">
                          <DollarSign size={14} />
                          <input 
                            type="number" 
                            value={item.amount}
                            onChange={e => {
                              const newP = [...prestamosList];
                              newP[index].amount = parseFloat(e.target.value) || 0;
                              setPrestamosList(newP);
                            }}
                            className="table-input"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 5: Caja Inicial */}
          {step === 5 && (
            <div className="step-content">
              <h3>Caja y Cuentas Financieras Iniciales</h3>
              <p className="step-desc">
                Carga el balance disponible en cada cuenta al 17/06. La caja comenzará únicamente 
                con estos saldos limpios cargados de manera formal.
              </p>

              <table className="asistente-table">
                <thead>
                  <tr>
                    <th>Cuenta Financiera</th>
                    <th>Saldo Inicial al 17/06</th>
                  </tr>
                </thead>
                <tbody>
                  {cajaInicialList.map((item, index) => (
                    <tr key={index}>
                      <td><strong>{item.accountName}</strong></td>
                      <td>
                        <div className="price-input-wrapper">
                          <DollarSign size={14} />
                          <input 
                            type="number" 
                            value={item.amount}
                            onChange={e => {
                              const newC = [...cajaInicialList];
                              newC[index].amount = parseFloat(e.target.value) || 0;
                              setCajaInicialList(newC);
                            }}
                            className="table-input"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 6: Confirmación */}
          {step === 6 && (
            <div className="step-content">
              <h3>Resumen y Confirmación Final</h3>
              <p className="step-desc">
                Por favor revise cuidadosamente los saldos de la migración contable antes de confirmar. 
                Los cambios se aplicarán y establecerán la foto operativa del negocio al {fechaCorte}.
              </p>

              <div className="resumen-grid">
                <div className="resumen-card">
                  <h4>Stock Inicial Mercadería</h4>
                  <ul>
                    {stocksList.map((s, i) => (
                      <li key={i}>{s.nombre}: <strong>{s.stockFisico} Kg</strong></li>
                    ))}
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Insumos Iniciales</h4>
                  <ul>
                    {insumosList.map((ins, i) => (
                      <li key={i}>{ins.nombre}: <strong>{ins.cantidadActual} Unidades</strong> (costo unitario: ${(ins.compraCosto/ins.cantidadComprada).toFixed(2)})</li>
                    ))}
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Caja e Inversiones</h4>
                  <ul>
                    {cajaInicialList.map((c, i) => (
                      <li key={i}>{c.accountName}: <strong>${c.amount.toLocaleString()}</strong></li>
                    ))}
                  </ul>
                </div>
                <div className="resumen-card">
                  <h4>Pasivos y Socios</h4>
                  <ul>
                    <li>Aportes Totales: <strong>${aportesList.reduce((acc, a) => acc + a.amount, 0).toLocaleString()}</strong></li>
                    <li>Préstamos (Deuda): <strong>${prestamosList.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}</strong></li>
                  </ul>
                </div>
              </div>

              <div className="corte-info-box warning-box" style={{ marginTop: '24px' }}>
                <Info size={20} />
                <div>
                  <h4>Acción Irreversible</h4>
                  <p>
                    Al presionar confirmar se generarán los saldos iniciales del sistema. Asegúrese 
                    de que los datos coincidan con su planilla de balances físicos y contables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card Actions */}
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
            
            {step < 6 ? (
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
                disabled={loading}
                style={{ marginLeft: 'auto' }}
              >
                {loading ? 'Procesando...' : 'Confirmar e Iniciar ERP'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
