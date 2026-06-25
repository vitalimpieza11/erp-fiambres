import React, { useState, useMemo } from 'react';
import { useStockDiagnostic } from './useStockDiagnostic';
import type { DiagnosticResult } from './useStockDiagnostic';
import DetalleMovimientosModal from './DetalleMovimientosModal';
import { Search, Eye, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function RegularizacionStockDiagnostico() {
  const { diagnostics, loading } = useStockDiagnostic();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<DiagnosticResult | null>(null);

  const filteredDiagnostics = useMemo(() => {
    return diagnostics.filter(d => 
      d.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [diagnostics, searchTerm]);

  const summary = useMemo(() => {
    let desincronizados = 0;
    let diferenciaTotal = 0;
    let diferenciaPositiva = 0;
    let diferenciaNegativa = 0;

    diagnostics.forEach(d => {
      if (Math.abs(d.diferencia) > 0.001) {
        desincronizados++;
        diferenciaTotal += Math.abs(d.diferencia);
        if (d.diferencia > 0) diferenciaPositiva++;
        else diferenciaNegativa++;
      }
    });

    return { desincronizados, diferenciaTotal, diferenciaPositiva, diferenciaNegativa };
  }, [diagnostics]);

  if (loading) {
    return <LoadingSpinner message="Analizando historial de movimientos..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnóstico de Stock (Solo Lectura)</h1>
          <p className="text-gray-500 mt-1">
            Valida matemáticamente el stock histórico según los movimientos registrados contra el valor actual en base de datos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center text-rose-600 mb-2">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Desincronizados</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary.desincronizados}</p>
          <p className="text-sm text-gray-500 mt-1">productos con diferencia</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center text-blue-600 mb-2">
            <Info className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Diferencia Total</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary.diferenciaTotal.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">unidades/kg absolutas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center text-emerald-600 mb-2">
            <CheckCircle className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Dif. Positiva</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary.diferenciaPositiva}</p>
          <p className="text-sm text-gray-500 mt-1">calculado &gt; actual</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center text-orange-600 mb-2">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Dif. Negativa</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary.diferenciaNegativa}</p>
          <p className="text-sm text-gray-500 mt-1">calculado &lt; actual</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4 text-right">Stock Actual DB</th>
                <th className="px-6 py-4 text-right bg-blue-50/50">Stock Calculado</th>
                <th className="px-6 py-4 text-right">Diferencia</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDiagnostics.map((d) => {
                const hasDifference = Math.abs(d.diferencia) > 0.001;
                
                return (
                  <tr key={d.productId} className={`hover:bg-gray-50 ${hasDifference ? 'bg-red-50/20' : ''}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {d.productName}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {d.stockActual}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600 bg-blue-50/10">
                      {d.stockCalculado}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasDifference ? (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          d.diferencia > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {d.diferencia > 0 ? '+' : ''}{d.diferencia}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => setSelectedDiagnostic(d)}
                          className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          Ver detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDiagnostic && (
        <DetalleMovimientosModal
          diagnostic={selectedDiagnostic}
          onClose={() => setSelectedDiagnostic(null)}
        />
      )}
    </div>
  );
}
