
import React from 'react';
import type { Vendor } from '../../../../types/pr_types';
import type { Organisation } from '../../../../types';

const VendorOrdersTab: React.FC<{ vendor: Vendor; organisation: Organisation }> = () => {
    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
            <h3 className="text-lg font-bold text-slate-700 mb-2">Previous Orders</h3>
            <p className="text-slate-500">Order history integration is coming soon.</p>
        </div>
    );
};

export default VendorOrdersTab;
