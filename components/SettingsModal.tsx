
import React, { useState } from 'react';
import { UserSettings, DEFAULT_INSTANCES } from '../types';
import { X, Server, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-red-500" />
            Network
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              API Server
            </label>
            <select
              value={localSettings.invidiousInstance}
              onChange={(e) => setLocalSettings({ ...localSettings, invidiousInstance: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
            >
              {DEFAULT_INSTANCES.map(inst => (
                <option key={inst} value={inst}>{inst.replace('https://', '')}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-2">
              If videos fail to load, try selecting a different server.
            </p>
          </div>

          <button
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-all"
          >
            Save Connection
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
