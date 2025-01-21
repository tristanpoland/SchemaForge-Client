import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onExecuteCommand, commands = [] }) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(search.toLowerCase()) ||
    cmd.keywords?.some(k => k.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % filteredCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onExecuteCommand(filteredCommands[selectedIndex]);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-32"
      onClick={onClose}
    >
      <div 
        className="w-[40rem] bg-neutral-900/80 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Search size={20} className="text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="w-full bg-transparent text-white placeholder-neutral-400 outline-none text-lg"
          />
        </div>

        {/* Results */}
        <div className="max-h-[28rem] overflow-y-auto">
          <div className="p-2">
            {filteredCommands.length === 0 ? (
              <div className="px-3 py-8 text-center text-neutral-400">
                No matching commands found
              </div>
            ) : (
              filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => {
                    onExecuteCommand(command);
                    onClose();
                  }}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-lg text-left transition-colors ${
                    index === selectedIndex 
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-white hover:bg-white/5'
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-neutral-800">
                    {command.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{command.title}</div>
                    {command.description && (
                      <div className="text-sm text-neutral-400 truncate">
                        {command.description}
                      </div>
                    )}
                  </div>
                  {command.shortcut && (
                    <div className="flex gap-1 items-center">
                      {command.shortcut.map((key, i) => (
                        <kbd
                          key={i}
                          className="min-w-[1.5rem] h-6 flex items-center justify-center px-1.5 text-xs font-medium bg-neutral-800 rounded border border-neutral-700 text-neutral-300"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Quick help */}
        <div className="p-2 border-t border-white/10 bg-neutral-900/50">
          <div className="flex items-center justify-between text-xs text-neutral-500 px-3">
            <div className="flex gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700">Enter</kbd>
                <span>Select</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}