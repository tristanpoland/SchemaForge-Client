"use client"
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, FileText, Move, ZoomIn, ZoomOut, X, Edit2 } from 'lucide-react';

const DATA_TYPES = {
  numeric: ['INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'],
  text: ['VARCHAR', 'TEXT', 'CHAR'],
  date: ['DATE', 'TIMESTAMP', 'TIME'],
  binary: ['BLOB', 'BINARY'],
  boolean: ['BOOLEAN']
};

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/Dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/Select"
import { Checkbox } from "../components/ui/Checkbox"

const parseSQL = (sql, dialect = 'standard') => {
  const tables = [];
  // Handle different schema prefixes (e.g., "public.")
  const tableRegex = /CREATE TABLE (?:[\w.]+\.)?([\w]+)\s*\(([\s\S]*?)\)(?:\s*LOCALITY[\s\S]*?(?=CREATE|$)|\s*(?=CREATE|$))/gi;
  
  // Enhanced column regex to handle more complex types and constraints
  const columnRegex = /\s*([\w_]+)\s+([\w]+(?:\([\w\s,]*\))?)\s*(?:NOT NULL|NULL)?\s*(?:DEFAULT\s+[\w_()]+)?,?/gi;
  
  // Handle primary key constraints in different formats
  const primaryKeyRegex = /CONSTRAINT\s+[\w_]+\s+PRIMARY KEY\s*\(([\w\s,]+)(?:\s+ASC)?\)/gi;
  const simplePrimaryKeyRegex = /PRIMARY KEY\s*\(([\w\s,]+)(?:\s+ASC)?\)/gi;
  
  // Enhanced foreign key regex for different dialects
  const foreignKeyRegex = /(?:CONSTRAINT\s+[\w_]+\s+)?FOREIGN KEY\s*\(([\w_]+)\)\s*REFERENCES\s+([\w.]+)\s*\(([\w_]+)\)/gi;

  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const columnsString = match[2];
    
    const table = {
      id: `table-${Date.now()}-${Math.random()}`,
      name: tableName,
      columns: [],
      position: { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 }
    };

    // Parse columns
    let columnMatch;
    while ((columnMatch = columnRegex.exec(columnsString)) !== null) {
      if (columnMatch[1].toUpperCase() === 'CONSTRAINT') continue;
      
      const columnName = columnMatch[1];
      let columnType = columnMatch[2].toUpperCase();
      
      // Skip if this is a FOREIGN KEY or CONSTRAINT declaration
      if (['FOREIGN', 'PRIMARY', 'CONSTRAINT'].includes(columnName.toUpperCase())) continue;
      
      // Standardize type names across different dialects
      const typeMap = {
        'INT8': 'BIGINT',
        'STRING': 'TEXT',
        'BOOL': 'BOOLEAN',
        'TIMESTAMP': 'TIMESTAMP',
        'SERIAL': 'INT'
      };
      
      Object.entries(typeMap).forEach(([from, to]) => {
        if (columnType.includes(from)) columnType = to;
      });
      
      const isPrimaryKey = columnsString.includes(`${columnName} ${columnType} PRIMARY KEY`) ||
                          columnsString.includes(`PRIMARY KEY (${columnName})`) ||
                          columnsString.toLowerCase().includes(`constraint`) && 
                          columnsString.toLowerCase().includes(`primary key`) && 
                          columnsString.toLowerCase().includes(`(${columnName.toLowerCase()}`) ||
                          columnsString.toLowerCase().includes(`(${columnName.toLowerCase()} asc`);
                          
      const isNotNull = columnsString.includes(`${columnName} ${columnType} NOT NULL`) ||
                       columnsString.includes(`${columnName} ${columnType} NULL`) === false;
      
      table.columns.push({
        name: columnName,
        type: columnType,
        primaryKey: isPrimaryKey,
        notNull: isNotNull
      });
    }

    // Parse foreign keys
    let fkMatch;
    while ((fkMatch = foreignKeyRegex.exec(columnsString)) !== null) {
      const columnName = fkMatch[1];
      const referenceTable = fkMatch[2];
      const referenceColumn = fkMatch[3];
      
      // Find the column and add foreign key info
      const column = table.columns.find(col => col.name === columnName);
      if (column) {
        column.foreignKey = {
          table: referenceTable,
          column: referenceColumn
        };
      }
    }

    tables.push(table);
  }

  return tables;
};

const TableNode = ({ 
  table, 
  position, 
  onDragStart, 
  onDrag, 
  onDragEnd,
  onEdit,
  onDelete,
  scale,
  allTables,
  onUpdateForeignKey
}) => {
  return (
    <div
      className="absolute bg-neutral-800 rounded-lg shadow-lg border-2 border-neutral-700"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '200px'
      }}
      onMouseDown={onDragStart}
    >
      <div className="p-2 bg-neutral-700 flex justify-between items-center">
        <span className="font-medium text-white">{table.name}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-neutral-600"
            onClick={onEdit}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-red-900/50"
            onClick={onDelete}
          >
            <X className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-neutral-400">Column</th>
              <th className="text-left px-2 py-1 text-neutral-400">Type</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column, idx) => (
              <tr key={idx} className="border-t border-neutral-700">
                <td className="px-2 py-1">
                  {column.name}
                  {column.primaryKey && '🔑'}
                  {column.foreignKey && '🔗'}
                  {column.notNull && '*'}
                </td>
                <td className="px-2 py-1 text-neutral-400">
                  {column.type}
                  {column.foreignKey && ` -> ${column.foreignKey.table}.${column.foreignKey.column}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EditTableDialog = ({ table, onSave, allTables, open, onOpenChange }) => {
  const [editedTable, setEditedTable] = useState({ ...table });
  
  useEffect(() => {
    setEditedTable({ ...table });
  }, [table]);
  
  const addColumn = () => {
    setEditedTable(prev => ({
      ...prev,
      columns: [...prev.columns, { name: '', type: 'VARCHAR', primaryKey: false, notNull: false }]
    }));
  };

  const updateColumn = (index, field, value) => {
    setEditedTable(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => 
        i === index ? { ...col, [field]: value } : col
      )
    }));
  };

  const removeColumn = (index) => {
    setEditedTable(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index)
    }));
  };

  const handleForeignKeySelect = (columnIndex, targetTable, targetColumn) => {
    setEditedTable(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => 
        i === columnIndex 
          ? {
              ...col,
              foreignKey: targetTable && targetColumn 
                ? { table: targetTable, column: targetColumn }
                : null
            }
          : col
      )
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-800 text-neutral-100">
        <DialogHeader>
          <DialogTitle>Edit Table: {editedTable.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Table Name</label>
            <Input
              value={editedTable.name}
              onChange={(e) => setEditedTable(prev => ({ ...prev, name: e.target.value }))}
              className="bg-neutral-700 border-neutral-600"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Columns</label>
            {editedTable.columns.map((column, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  value={column.name}
                  onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                  placeholder="Column name"
                  className="bg-neutral-700 border-neutral-600"
                />
                <Select
                  value={column.type}
                  onValueChange={(value) => updateColumn(idx, 'type', value)}
                >
                  <SelectTrigger className="w-32 bg-neutral-700 border-neutral-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-700 border-neutral-600">
                    {Object.entries(DATA_TYPES).map(([category, types]) => (
                      <React.Fragment key={category}>
                        {types.map(type => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={column.primaryKey}
                    onCheckedChange={(checked) => updateColumn(idx, 'primaryKey', checked)}
                    id={`pk-${idx}`}
                  />
                  <label htmlFor={`pk-${idx}`} className="text-sm">PK</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={column.notNull}
                    onCheckedChange={(checked) => updateColumn(idx, 'notNull', checked)}
                    id={`nn-${idx}`}
                  />
                  <label htmlFor={`nn-${idx}`} className="text-sm">NOT NULL</label>
                </div>
                {!column.primaryKey && (
                  <Select
                    value={column.foreignKey ? `${column.foreignKey.table}.${column.foreignKey.column}` : 'none'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        handleForeignKeySelect(idx, null, null);
                      } else {
                        const [table, column] = value.split('.');
                        handleForeignKeySelect(idx, table, column);
                      }
                    }}
                  >
                    <SelectTrigger className="w-48 bg-neutral-700 border-neutral-600">
                      <SelectValue placeholder="Foreign Key" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-700 border-neutral-600">
                      <SelectItem value="none">None</SelectItem>
                      {allTables
                        .filter(t => t.id !== editedTable.id)
                        .map(t => 
                          t.columns
                            .filter(col => col.primaryKey)
                            .map(col => (
                              <SelectItem 
                                key={`${t.name}.${col.name}`} 
                                value={`${t.name}.${col.name}`}
                              >
                                {t.name}.{col.name}
                              </SelectItem>
                            ))
                        )}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeColumn(idx)}
                  className="hover:bg-red-900/50"
                >
                  <X className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))}
          </div>
          <Button onClick={addColumn} variant="outline" className="w-full">
            Add Column
          </Button>
          <div className="flex justify-end space-x-2">
            <Button onClick={() => onOpenChange(false)} variant="ghost">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onSave(editedTable);
                onOpenChange(false);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SUPPORTED_DIALECTS = {
  'standard': 'Standard SQL',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
  'cockroachdb': 'CockroachDB',
  'sqlite': 'SQLite'
};

const SchemaForge = () => {
  const [tables, setTables] = useState([]);
  const [selectedDialect, setSelectedDialect] = useState('standard');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [draggedTable, setDraggedTable] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingTable, setEditingTable] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [relationships, setRelationships] = useState([]);
  
  const canvasRef = useRef(null);

  const addTable = () => {
    const newTable = {
      id: `table-${Date.now()}`,
      name: `Table${tables.length + 1}`,
      columns: [
        { name: 'id', type: 'INT', primaryKey: true, notNull: true },
        { name: 'created_at', type: 'TIMESTAMP', notNull: false }
      ],
      position: { x: 50, y: 50 }
    };
    setTables([...tables, newTable]);
  };

  const handleTableDragStart = (e, tableId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDraggedTable(tableId);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    });
    setIsDragging(true);
  };

  const handleTableDrag = (e) => {
    if (isDragging && draggedTable) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top) / zoom - dragOffset.y;
      
      setTables(tables.map(table =>
        table.id === draggedTable
          ? { ...table, position: { x, y } }
          : table
      ));
    }
  };

  const generateSQL = () => {
    let sql = '';
    // Add header comment
    sql += '-- Generated by SchemaForge\n';
    sql += `-- Generated at: ${new Date().toISOString()}\n\n`;

    // Sort tables to handle foreign key dependencies
    const sortedTables = [...tables].sort((a, b) => {
      const aHasForeignKeys = a.columns.some(col => col.foreignKey);
      const bHasForeignKeys = b.columns.some(col => col.foreignKey);
      return aHasForeignKeys ? 1 : bHasForeignKeys ? -1 : 0;
    });
    
    sortedTables.forEach(table => {
      sql += `CREATE TABLE ${table.name} (\n`;
      
      // Column definitions
      const columnDefs = table.columns.map(column => {
        let def = `  ${column.name} ${column.type}`;
        if (column.primaryKey) {
          def += ' PRIMARY KEY';
        }
        if (column.notNull) {
          def += ' NOT NULL';
        }
        return def;
      });
      
      // Foreign key constraints
      const foreignKeys = table.columns
        .filter(column => column.foreignKey)
        .map(column => 
          `  FOREIGN KEY (${column.name}) REFERENCES ${column.foreignKey.table}(${column.foreignKey.column})`
        );
      
      sql += [...columnDefs, ...foreignKeys].join(',\n');
      sql += '\n);\n\n';
    });
    
    // Create and trigger download
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTableSave = (editedTable) => {
    setTables(prevTables => 
      prevTables.map(table => 
        table.id === editedTable.id ? editedTable : table
      )
    );

    // Update relationships based on foreign keys
    const newRelationships = [];
    tables.forEach(table => {
      table.columns.forEach(column => {
        if (column.foreignKey) {
          newRelationships.push({
            id: `rel-${table.id}-${column.name}`,
            fromTable: table.name,
            fromColumn: column.name,
            toTable: column.foreignKey.table,
            toColumn: column.foreignKey.column
          });
        }
      });
    });

    setRelationships(newRelationships);
  };

  return (
    <div className="w-full h-screen flex flex-col bg-neutral-900 text-neutral-100">
      {editingTable && (
        <EditTableDialog
          table={editingTable}
          onSave={handleTableSave}
          allTables={tables}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
      
      <div className="h-16 border-b border-neutral-800 flex items-center justify-between px-4">
        <h1 className="text-xl font-semibold">SchemaForge</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setZoom(prev => Math.max(prev * 0.9, 0.1))}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm">{Math.round(zoom * 100)}%</span>
            <Button
              onClick={() => setZoom(prev => Math.min(prev * 1.1, 2))}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            onClick={addTable}
            className="flex items-center bg-neutral-800 hover:bg-neutral-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
          
          <div className="flex items-center space-x-2">
            <Select
              value={selectedDialect}
              onValueChange={setSelectedDialect}
            >
              <SelectTrigger className="w-40 bg-neutral-700 border-neutral-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-700 border-neutral-600">
                {Object.entries(SUPPORTED_DIALECTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <label className="flex items-center bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-md cursor-pointer">
              <FileText className="w-4 h-4 mr-2" />
              Import SQL
              <input
                type="file"
                accept=".sql"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const sql = event.target?.result;
                      if (typeof sql === 'string') {
                        const importedTables = parseSQL(sql, selectedDialect);
                        setTables(importedTables);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </label>
          </div>
          
          <Button
            onClick={generateSQL}
            className="flex items-center bg-neutral-800 hover:bg-neutral-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export SQL
          </Button>
        </div>
      </div>

      <div 
        className="flex-1 relative overflow-hidden"
        ref={canvasRef}
        onMouseMove={(e) => {
          if (isPanning) {
            const dx = (e.clientX - lastPanPoint.x) / zoom;
            const dy = (e.clientY - lastPanPoint.y) / zoom;
            setPan(prev => ({
              x: prev.x + dx,
              y: prev.y + dy
            }));
            setLastPanPoint({ x: e.clientX, y: e.clientY });
          } else if (isDragging) {
            handleTableDrag(e);
          }
        }}
        onMouseUp={() => {
          setIsDragging(false);
          setIsPanning(false);
          setDraggedTable(null);
        }}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsPanning(false);
          setDraggedTable(null);
        }}
        onMouseDown={(e) => {
          // Middle mouse button (button 1)
          if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            setLastPanPoint({ x: e.clientX, y: e.clientY });
          }
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.1), 2));
          }
        }}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%'
          }}
        >
          {/* Relationship lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {relationships.map(rel => {
              const fromTable = tables.find(t => t.name === rel.fromTable);
              const toTable = tables.find(t => t.name === rel.toTable);
              if (!fromTable || !toTable) return null;

              const fromX = fromTable.position.x + 200;
              const fromY = fromTable.position.y + 40;
              const toX = toTable.position.x;
              const toY = toTable.position.y + 40;

              return (
                <g key={rel.id}>
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="#525252"
                    strokeWidth={2 / zoom}
                    markerEnd="url(#arrowhead)"
                  />
                  <circle
                    cx={fromX}
                    cy={fromY}
                    r={4 / zoom}
                    fill="#525252"
                  />
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#525252"
                />
              </marker>
            </defs>
          </svg>

          {tables.map(table => (
            <TableNode
              key={table.id}
              table={table}
              position={table.position}
              onDragStart={(e) => handleTableDragStart(e, table.id)}
              onDelete={() => {
                setTables(tables.filter(t => t.id !== table.id));
                setRelationships(relationships.filter(
                  rel => rel.fromTable !== table.name && rel.toTable !== table.name
                ));
              }}
              onEdit={() => {
                setEditingTable(table);
                setIsEditDialogOpen(true);
              }}
              scale={zoom}
              allTables={tables}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchemaForge;