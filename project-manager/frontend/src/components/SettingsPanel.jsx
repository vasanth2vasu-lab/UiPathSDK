import React from 'react';

export default function SettingsPanel({ settings, onClose, onRefresh, onExport, projects }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Salesforce Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Salesforce Connection</h3>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${settings?.salesforce?.connected ? 'bg-green-500' : settings?.salesforce?.configured ? 'bg-red-500' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {settings?.salesforce?.connected ? 'Connected' : settings?.salesforce?.configured ? 'Disconnected / Error' : 'Not Configured'}
              </span>
            </div>
            {settings?.salesforce?.instance_url && (
              <p className="text-xs text-gray-400 mt-1">{settings.salesforce.instance_url}</p>
            )}
          </div>

          {/* Excel Files */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Loaded Excel Files</h3>
            {settings?.excelFiles?.length > 0 ? (
              <ul className="space-y-2">
                {settings.excelFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-500">{f.rowCount} rows</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No Excel files loaded. Place .xlsx files in the /data directory.</p>
            )}
          </div>

          {/* Errors */}
          {settings?.errors?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-2">Warnings / Errors</h3>
              <ul className="space-y-1">
                {settings.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onRefresh}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Refresh All Data
            </button>
            <button
              onClick={onExport}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
