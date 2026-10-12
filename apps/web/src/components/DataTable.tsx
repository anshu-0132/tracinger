import React from 'react';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
  stickyHeader?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  children,
  className = '',
  stickyHeader: _stickyHeader = true,
}) => {
  return (
    <div className={`w-full overflow-x-auto border border-border rounded-sm bg-surface ${className}`}>
      <table className="w-full text-left text-xs text-txt-primary border-collapse">
        {children}
      </table>
    </div>
  );
};

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <thead className={`bg-surface-raised border-b border-border text-[11px] font-medium text-txt-secondary uppercase tracking-wider select-none ${className}`}>
      {children}
    </thead>
  );
};

export const TableHeaderCell: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  onClick?: () => void;
}> = ({ children, align = 'left', className = '', onClick }) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-medium ${alignClass} ${onClick ? 'cursor-pointer hover:text-txt-primary' : ''} ${className}`}
    >
      {children}
    </th>
  );
};

export const TableBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <tbody className={`divide-y divide-border-subtle ${className}`}>{children}</tbody>;
};

export const TableRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}> = ({ children, className = '', onClick, selected = false }) => {
  return (
    <tr
      onClick={onClick}
      className={`h-9 transition-colors ${
        selected ? 'bg-accent-subtle border-l-2 border-l-accent' : 'hover:bg-surface-raised/60'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
};

export const TableCell: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}> = ({ children, align = 'left', className = '', onClick }) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td onClick={onClick} className={`px-3 py-1.5 align-middle ${alignClass} ${className}`}>
      {children}
    </td>
  );
};
