
import React from 'react';
import type { MaterialMasterData } from '../../../../types';

// Icons for sections
const IdentityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4" /></svg>;
const CatalogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const SourceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const AttributesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;

const InfoRow: React.FC<{ label: string; value?: string | number | null; mono?: boolean }> = ({ label, value, mono }) => (
    <div className="flex flex-col py-2 border-b border-slate-50 last:border-0">
        <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</dt>
        <dd className={`text-sm font-medium text-slate-800 break-words ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
    </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <span className="text-slate-400">{icon}</span>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {children}
        </div>
    </div>
);

const MasterDataInfoTab: React.FC<{ material: MaterialMasterData }> = ({ material }) => {
    return (
        <div className="p-6 bg-slate-50 min-h-full">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Identity & Catalog */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Section title="Identity & Registry" icon={<IdentityIcon />}>
                        <InfoRow label="MEMS Material Number" value={material.materialCode} mono />
                        <InfoRow label="Registry Status" value={material.status} />
                        <InfoRow label="Origin Warehouse" value={material.allocationLevel5Name} />
                        <InfoRow label="Origin Department" value={material.allocationLevel4Name} />
                        <InfoRow label="Record Creator" value={material.createdBy.name} />
                        <InfoRow label="Registration Date" value={material.createdAt.toDate().toLocaleDateString()} />
                    </Section>

                    <Section title="Catalog Classification" icon={<CatalogIcon />}>
                        <InfoRow label="Category" value={material.procurementCategoryName} />
                        <InfoRow label="Subcategory" value={material.procurementSubcategoryName} />
                        <InfoRow label="Material Type" value={material.materialTypeName} />
                        <InfoRow label="Component Name" value={material.procurementComponentName} />
                    </Section>
                </div>

                {/* Sourcing */}
                <Section title="Source & Procurement Reference" icon={<SourceIcon />}>
                    <InfoRow label="Primary Sourcing" value={material.source} />
                    <InfoRow label="Manufacturer (OEM)" value={material.oemName} />
                    <InfoRow label="OEM Part Number" value={material.oemPartNumber} mono />
                    <InfoRow label="OCM Alias" value={material.ocmName} />
                    <InfoRow label="OCM Part Number" value={material.ocmPartNumber} mono />
                    <InfoRow label="Default Storage Loc" value={material.storageLocationName} />
                </Section>

                {/* Attributes - Full Width Section */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                        <span className="text-slate-400"><AttributesIcon /></span>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Technical Attributes</h3>
                    </div>
                    <div className="p-4">
                        {Object.keys(material.attributes || {}).length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-2">
                                {Object.entries(material.attributes).map(([key, value]) => (
                                    <InfoRow key={key} label={key} value={String(value)} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic py-2">No technical attributes recorded for this component.</p>
                        )}
                    </div>
                </div>

                {/* Audit Trail Note */}
                <div className="flex justify-center pt-4">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                        System Material ID: <span className="font-mono">{material.id}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MasterDataInfoTab;
