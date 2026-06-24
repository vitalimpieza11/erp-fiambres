import { useState, useMemo } from 'react';
import { useProducts } from '../configuracion/useProducts';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Scale, Printer, Search, BarChart2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CodigosBalanza() {
  const { productos, loading } = useProducts();
  const [search, setSearch] = useState('');

  // Only products that have a codigoBalanza assigned
  const productosConCodigo = useMemo(() => {
    return productos
      .filter(p => p.codigoBalanza !== undefined && p.codigoBalanza !== null && p.codigoBalanza !== 0)
      .sort((a, b) => (a.codigoBalanza ?? 0) - (b.codigoBalanza ?? 0));
  }, [productos]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productosConCodigo;
    return productosConCodigo.filter(p =>
      String(p.codigoBalanza ?? '').includes(q) ||
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.nombreCortoBalanza || '').toLowerCase().includes(q)
    );
  }, [productosConCodigo, search]);

  const totalAsignados = productosConCodigo.length;
  const totalProductos = productos.length;

  const handlePrint = () => {
    const doc = new jsPDF();

    // Brand header strip
    doc.setFillColor(196, 49, 38);
    doc.rect(0, 0, 210, 8, 'F');

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 33, 33);
    doc.text('CÓDIGOS DE BALANZA', 105, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 105, 29, { align: 'center' });

    // Stats bar
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, 34, 182, 14, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(29, 78, 216);
    doc.setFont('helvetica', 'bold');
    doc.text(`Productos con código asignado: ${productosConCodigo.length}  |  Total en catálogo: ${productos.length}`, 105, 43, { align: 'center' });

    // Table
    const rows = productosConCodigo.map(p => [
      String(p.codigoBalanza ?? ''),
      p.nombre || '',
      p.nombreCortoBalanza || '—',
      p.activo ? 'Activo' : 'Baja'
    ]);

    autoTable(doc, {
      startY: 52,
      head: [['Código', 'Producto', 'Nombre Corto', 'Estado']],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: [196, 49, 38],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [33, 33, 33]
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 85 },
        2: { cellWidth: 55 },
        3: { cellWidth: 22, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      didParseCell: (data: any) => {
        if (data.column.index === 3 && data.section === 'body') {
          const val = data.cell.raw;
          if (val === 'Activo') {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [185, 28, 28];
          }
        }
      }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
      doc.setFillColor(196, 49, 38);
      doc.rect(0, 293, 210, 4, 'F');
    }

    doc.save(`codigos-balanza-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading) return <LoadingSpinner message="Cargando códigos de balanza..." />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(29,78,216,0.25)'
          }}>
            <Scale size={26} color="#fff" />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px' }}>Códigos de Balanza</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Listado de referencia de códigos asignados a productos
            </p>
          </div>
        </div>
        <button
          id="btn-imprimir-balanza"
          className="btn-primary"
          onClick={handlePrint}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
            border: 'none', color: '#fff', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(29,78,216,0.3)'
          }}
        >
          <Printer size={18} />
          Imprimir listado
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Códigos Asignados
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#38bdf8' }}>{totalAsignados}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>de {totalProductos} productos</div>
        </div>
        <div style={{
          padding: '20px', borderRadius: '14px', background: '#fff',
          border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Sin código asignado
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalProductos - totalAsignados}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            productos pendientes
          </div>
        </div>
        <div style={{
          padding: '20px', borderRadius: '14px', background: '#fff',
          border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <BarChart2 size={14} color="var(--alvacio-red)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cobertura
            </span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: totalProductos > 0 ? '#16a34a' : 'var(--text-secondary)' }}>
            {totalProductos > 0 ? Math.round((totalAsignados / totalProductos) * 100) : 0}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            del catálogo con código
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
        background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px',
        padding: '10px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <Search size={18} color="var(--text-secondary)" />
        <input
          id="search-codigos-balanza"
          type="text"
          placeholder="Buscar por código, producto o nombre corto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: '14px',
            background: 'transparent', color: 'var(--text-primary)'
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}
          >
            ×
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)',
        overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Scale size={48} color="#e2e8f0" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, fontWeight: 500 }}>
              {search
                ? 'No se encontraron resultados para la búsqueda.'
                : 'Ningún producto tiene código de balanza asignado aún.'}
            </p>
            {!search && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
                Asigná códigos desde <strong>Configuración → Productos</strong>, editando cada producto.
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #edf2f7' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>
                    Código
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Producto
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Nombre Corto
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '52px', height: '32px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                        color: '#fff', fontWeight: 800, fontSize: '15px',
                        boxShadow: '0 2px 6px rgba(29,78,216,0.25)'
                      }}>
                        {p.codigoBalanza}
                      </span>
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {p.nombre}
                      </span>
                      <span style={{
                        marginLeft: '10px', fontSize: '11px', fontWeight: 500,
                        padding: '2px 8px', borderRadius: '10px',
                        background: p.type === 'MERCADERIA' ? '#eff6ff' : p.type === 'INSUMO' ? '#f0fdf4' : '#fdf4ff',
                        color: p.type === 'MERCADERIA' ? '#1d4ed8' : p.type === 'INSUMO' ? '#15803d' : '#7e22ce'
                      }}>
                        {p.type}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {p.nombreCortoBalanza ? (
                        <span style={{
                          fontFamily: 'monospace', fontSize: '13px', fontWeight: 600,
                          color: '#374151', background: '#f3f4f6',
                          padding: '4px 10px', borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          {p.nombreCortoBalanza}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '13px', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                        background: p.activo ? '#dcfce7' : '#fee2e2',
                        color: p.activo ? '#15803d' : '#b91c1c'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.activo ? '#15803d' : '#b91c1c' }} />
                        {p.activo ? 'Activo' : 'Baja'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #edf2f7',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Mostrando <strong>{filtered.length}</strong> {filtered.length === 1 ? 'código' : 'códigos'}
                {search && ` para "${search}"`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
