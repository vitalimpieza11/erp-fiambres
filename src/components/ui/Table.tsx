import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
}

export function Table<T>({ columns, data, keyExtractor, onRowClick }: TableProps<T>) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th 
                key={idx} 
                style={{ 
                  textAlign: col.align || 'left',
                  width: col.width
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No hay datos disponibles
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr 
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map((col, colIdx) => (
                  <td 
                    key={colIdx} 
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
