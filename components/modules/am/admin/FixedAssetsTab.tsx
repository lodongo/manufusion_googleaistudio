import React from 'react';
import type { Organisation } from '../../../../types';

interface FixedAssetsTabProps {
  theme: Organisation['theme'];
}

const FixedAssetsTab: React.FC<FixedAssetsTabProps> = ({ theme }) => {
  return (
    <div className="bg-white p-8 rounded-b-lg shadow-md min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fixed Assets Registry</h2>
          <p className="text-sm text-slate-500 mt-1">Configure asset categories, depreciation methods, and mandatory attribute requirements.</p>
        </div>
        <div className="flex gap-2">
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200 transition-colors border border-slate-300">
                Asset Categories
            </button>
            <button 
                className="px-4 py-2 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: theme.colorPrimary }}
            >
                + Register New Asset
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Total Active Assets</p>
              <p className="text-3xl font-black text-blue-900 mt-2">0</p>
          </div>
          <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Net Book Value</p>
              <p className="text-3xl font-black text-emerald-900 mt-2">$0.00</p>
          </div>
          <div className="p-6 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pending Disposal</p>
              <p className="text-3xl font-black text-amber-900 mt-2">0</p>
          </div>
      </div>

      <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
        <p className="text-slate-400 text-sm">Registry is empty. Use the 'Register New Asset' button to begin.</p>
      </div>
    </div>
  );
};

export default FixedAssetsTab;