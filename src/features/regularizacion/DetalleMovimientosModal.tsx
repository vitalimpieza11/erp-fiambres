import React from 'react';
import { X, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { DiagnosticResult } from './useStockDiagnostic';
import { formatDate } from '../../lib/formatters';

interface DetalleMovimientosModalProps {
  diagnostic: DiagnosticResult;
  onClose: () => void;
}

export default function DetalleMovimientosModal({ diagnostic, onClose }: DetalleMovimientosModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Detalle de Movimientos
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {diagnostic.productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 bg-gray-50 grid grid-cols-5 gap-4 border-b">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <span className="text-xs text-gray-500 font-medium uppercase">Compras</span>
            <div className="text-lg font-bold text-blue-600">+{diagnostic.totalCompras}</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <span className="text-xs text-gray-500 font-medium uppercase">Ventas</span>
            <div className="text-lg font-bold text-orange-600">-{diagnostic.totalVentas}</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <span className="text-xs text-gray-500 font-medium uppercase">Producción</span>
            <div className="text-lg font-bold text-purple-600">{diagnostic.totalProduccion > 0 ? '+' : ''}{diagnostic.totalProduccion}</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <span className="text-xs text-gray-500 font-medium uppercase">Ajustes Positivos</span>
            <div className="text-lg font-bold text-emerald-600">+{diagnostic.totalAjustesPositivos}</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <span className="text-xs text-gray-500 font-medium uppercase">Ajustes Negativos</span>
            <div className="text-lg font-bold text-red-600">-{diagnostic.totalAjustesNegativos}</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3 rounded-tr-lg">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {diagnostic.movements.map((mov) => {
                const qty = Number(mov.qty) || 0;
                const isPositive = qty > 0 || mov.type === 'COMPRA';
                
                return (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatDate(mov.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {mov.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center font-medium ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? (
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 mr-1" />
                        )}
                        {Math.abs(qty)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {mov.referenceId || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {mov.observaciones || '-'}
                    </td>
                  </tr>
                );
              })}
              {diagnostic.movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay movimientos registrados para este producto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
