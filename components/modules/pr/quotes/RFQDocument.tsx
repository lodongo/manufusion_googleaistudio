
import React from 'react';
import type { Organisation } from '../../../../types';
import type { ProcurementQuote, Vendor } from '../../../../types/pr_types';
import type { MaterialMasterData } from '../../../../types';

interface RFQDocumentProps {
    organisation: Organisation;
    vendor: Vendor;
    quote: ProcurementQuote;
    materialDetails: Record<string, MaterialMasterData>;
}

export const RFQDocument: React.FC<RFQDocumentProps> = ({ organisation, vendor, quote, materialDetails }) => {
    
    const formatAddress = (addr: any) => {
        if (!addr) return '';
        const parts = [
            addr.building,
            addr.road,
            addr.block,
            addr.town,
            addr.city,
            addr.state,
            addr.country
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Address not specified';
    };

    const formatAttributesToProse = (materialId: string) => {
        const mat = materialDetails[materialId];
        if (!mat || !mat.attributes) return '';
        
        return Object.entries(mat.attributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ');
    };

    return (
        <div className="bg-white text-slate-900 font-sans text-sm w-[210mm] min-h-[297mm] mx-auto p-12 relative print:w-full print:max-w-none print:min-h-0 print:p-0 page-break-after-always">
            
            {/* Watermark for Draft */}
            {quote.status === 'DRAFT' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0 overflow-hidden">
                    <p className="text-[150px] font-black -rotate-45 uppercase text-slate-900 select-none">DRAFT</p>
                </div>
            )}

            {/* Header Section */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-10">
                {/* Organization Info */}
                <div className="w-1/2 pr-6">
                    {organisation.theme.logoURL ? (
                        <img src={organisation.theme.logoURL} alt={organisation.name} className="h-16 max-w-[200px] object-contain mb-4" />
                    ) : (
                        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-900 mb-2">{organisation.name}</h1>
                    )}
                    <div className="text-xs text-slate-600 leading-relaxed">
                        <p className="font-bold text-sm text-slate-800">{organisation.name}</p>
                        <p>{organisation.address.block} {organisation.address.road}</p>
                        <p>{organisation.address.town}, {organisation.address.country} {organisation.address.countryIsoCode}</p>
                        <p className="mt-1"><strong>Phone:</strong> {organisation.phoneNumber}</p>
                        <p><strong>Email:</strong> procurement@{organisation.domain}</p>
                    </div>
                </div>

                {/* Document Info */}
                <div className="w-1/2 text-right">
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-wide mb-1">RFQ</h2>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Request for Quotation</p>
                    
                    <table className="text-xs text-left inline-table border-collapse">
                        <tbody>
                            <tr>
                                <th className="pr-4 py-1 font-bold text-slate-500 uppercase text-right border-r border-slate-300">RFQ Number</th>
                                <td className="pl-4 py-1 font-mono font-bold text-slate-900">{quote.quoteNumber}</td>
                            </tr>
                            <tr>
                                <th className="pr-4 py-1 font-bold text-slate-500 uppercase text-right border-r border-slate-300">Date</th>
                                <td className="pl-4 py-1">{new Date(quote.createdAt.seconds * 1000).toLocaleDateString()}</td>
                            </tr>
                            <tr>
                                <th className="pr-4 py-1 font-bold text-slate-500 uppercase text-right border-r border-slate-300">Valid Until</th>
                                <td className="pl-4 py-1 text-red-600 font-bold">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'Upon Receipt'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Addresses Grid */}
            <div className="flex gap-12 mb-12">
                {/* To: Vendor */}
                <div className="flex-1">
                    <h3 className="text-xs font-bold uppercase text-white bg-slate-800 px-3 py-1.5 mb-3 rounded-sm inline-block tracking-wider">To: Vendor</h3>
                    <div className="text-sm text-slate-700 ml-1 leading-relaxed">
                        <p className="font-bold text-lg text-slate-900 mb-1">{vendor.legalName}</p>
                        <p className="text-xs text-slate-500 mb-2">{formatAddress(vendor.physicalAddress)}</p>
                        <div className="text-xs border-t border-slate-200 pt-2 mt-2">
                            <p><strong>Attn:</strong> {vendor.primaryContact.name}</p>
                            <p><strong>Email:</strong> {vendor.primaryContact.email}</p>
                        </div>
                    </div>
                </div>

                {/* Ship To */}
                <div className="flex-1">
                    <h3 className="text-xs font-bold uppercase text-white bg-slate-500 px-3 py-1.5 mb-3 rounded-sm inline-block tracking-wider">Ship To</h3>
                    <div className="text-sm text-slate-700 ml-1 leading-relaxed">
                        <p className="font-bold text-lg text-slate-900 mb-1">{organisation.name}</p>
                         <p className="text-xs text-slate-500 mb-2">
                            {organisation.address.block} {organisation.address.road}<br/>
                            {organisation.address.town}, {organisation.address.country}<br/>
                            {organisation.address.countryIsoCode}
                        </p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-800 bg-slate-50">
                            <th className="py-3 pl-3 text-xs uppercase font-extrabold text-slate-600 w-12 text-center border-r border-slate-300">#</th>
                            <th className="py-3 pl-4 text-xs uppercase font-extrabold text-slate-600">Item Description & Specifications</th>
                            <th className="py-3 pr-4 text-xs uppercase font-extrabold text-slate-600 w-24 text-right border-l border-slate-300">Qty</th>
                            <th className="py-3 pr-3 text-xs uppercase font-extrabold text-slate-600 w-20 text-center border-l border-slate-300">Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quote.items.map((item, index) => {
                            const details = formatAttributesToProse(item.materialId);
                            const oemPart = item.materialId && materialDetails[item.materialId]?.oemPartNumber;
                            const isEven = index % 2 === 0;
                            
                            return (
                                <tr key={index} className={`border-b border-slate-200 break-inside-avoid ${isEven ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="py-4 pl-3 align-top text-slate-500 text-center font-mono text-xs border-r border-slate-200">{index + 1}</td>
                                    <td className="py-4 pl-4 align-top">
                                        <p className="font-bold text-slate-900 text-base mb-1">{item.materialName}</p>
                                        
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
                                            <span className="font-mono bg-slate-100 px-1 rounded">SKU: {item.materialCode}</span>
                                            {oemPart && <span className="font-mono bg-slate-100 px-1 rounded">MPN: {oemPart}</span>}
                                        </div>
                                        
                                        {details && (
                                            <div className="text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-100 mt-2">
                                                {details}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 pr-4 align-top text-right font-bold text-slate-900 text-base border-l border-slate-200">{item.quantity}</td>
                                    <td className="py-4 pr-3 align-top text-center text-slate-500 text-xs font-bold uppercase border-l border-slate-200">{item.uom}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Terms & Footer */}
            <div className="mt-auto break-inside-avoid border-t-2 border-slate-800 pt-8">
                <div className="flex gap-12">
                    <div className="flex-1">
                        <h4 className="text-xs font-bold uppercase text-slate-800 mb-4 tracking-wider">Terms & Conditions</h4>
                        <ul className="text-xs text-slate-600 space-y-2 list-disc list-outside ml-4">
                            <li>Please provide your best price and lead time for delivery.</li>
                            <li>Prices should include all applicable taxes and delivery charges (DDP) unless specified otherwise.</li>
                            <li>This document serves as a request for quotation only and does not constitute a purchase commitment.</li>
                            <li>The quote must remain valid for a minimum of 30 days from the date of submission.</li>
                            <li>Please reference the RFQ Number <strong>{quote.quoteNumber}</strong> on all correspondence.</li>
                        </ul>
                    </div>
                    <div className="w-1/3 bg-slate-50 p-6 rounded border border-slate-200 flex flex-col justify-center text-center">
                        <h4 className="text-xs font-bold uppercase text-slate-800 mb-4 tracking-wider">Submission</h4>
                        <p className="text-xs text-slate-600 mb-1">Please submit your formal quotation to:</p>
                        <p className="text-sm font-bold text-slate-900 mb-4">procurement@{organisation.domain}</p>
                        
                        <div className="border-t border-slate-200 pt-4 mt-auto">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Authorized Signature</p>
                            <div className="h-12"></div> 
                            <div className="border-b border-slate-300 w-2/3 mx-auto"></div>
                        </div>
                    </div>
                </div>
                
                <div className="text-center mt-12 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-widest">
                    <span>Generated by MEMS</span>
                    <span>{new Date().toISOString()}</span>
                    <span>Page 1 of 1</span>
                </div>
            </div>
        </div>
    );
};
