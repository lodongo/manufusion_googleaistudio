
import React from 'react';
import type { MaterialMasterData } from '../../../../types';
import { DetailItem } from './Shared';

const CoreDetailsTab: React.FC<{ material: MaterialMasterData }> = ({ material }) => {
    return (
        <div className="p-6 space-y-8">
            <section>
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">General Information</h3>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
                    <DetailItem label="MEMS Code" value={material.materialCode} />
                    <DetailItem label="Status" value={material.status} />
                    <DetailItem label="Created By" value={`${material.createdBy.name} on ${material.createdAt.toDate().toLocaleDateString()}`} />
                </dl>
            </section>

            <section>
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Classification & Type</h3>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
                    <DetailItem label="Material Type" value={material.materialTypeName} />
                    <DetailItem label="Procurement Category" value={material.procurementCategoryName} />
                    <DetailItem label="Subcategory" value={material.procurementSubcategoryName} />
                    <DetailItem label="Component Name" value={material.procurementComponentName} />
                </dl>
            </section>
            
            <section>
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Source Information</h3>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
                    <DetailItem label="Source Type" value={material.source} />
                    {material.source === 'OEM' && <>
                        <DetailItem label="OEM Name" value={material.oemName} />
                        <DetailItem label="OEM Part Number" value={material.oemPartNumber} />
                    </>}
                    {material.source === 'OCM' && <>
                        <DetailItem label="OCM Name" value={material.ocmName} />
                        <DetailItem label="OCM Part Number" value={material.ocmPartNumber} />
                    </>}
                </dl>
            </section>

            <section>
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Attributes</h3>
                <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    {Object.entries(material.attributes).map(([key, value]) => (
                        <DetailItem key={key} label={key} value={String(value)} />
                    ))}
                </dl>
            </section>
        </div>
    );
};

export default CoreDetailsTab;
