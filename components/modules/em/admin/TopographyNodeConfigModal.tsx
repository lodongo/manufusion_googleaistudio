
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../services/firebase';
import { collection, doc, getDocs, updateDoc, query, orderBy, where, getDoc } from 'firebase/firestore';
import type { Organisation } from '../../../../types';
import type { TopographyNode, Meter, MeteringType, LinkedMeter } from '../../../../types/em_types';
import Modal from '../../../common/Modal';
import Button from '../../../Button';

interface TopographyNodeConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    node: TopographyNode;
    organisation: Organisation;
    theme: Organisation['theme'];
}

interface ConsumerCategory {
    id: string;
    name: string;
}

interface ConsumerSubcategory {
    id: string;
    name: string;
    categoryId: string;
}

interface ConsumerItem {
    id: string;
    name: string;
    subCategoryId: string;
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
    </svg>
);

const TopographyNodeConfigModal: React.FC<TopographyNodeConfigModalProps> = ({ isOpen, onClose, node, organisation, theme }) => {
    // Core Logic States
    const [meteringType, setMeteringType] = useState<MeteringType>(node.meteringType || 'Manual');
    const [linkedMeters, setLinkedMeters] = useState<LinkedMeter[]>(node.linkedMeters || []);
    const [selectedConsumerIds, setSelectedConsumerIds] = useState<string[]>(node.consumerIds || []);
    const [selectedConsumerDetails, setSelectedConsumerDetails] = useState<Record<string, string>>({}); 
    
    // Catalog State (On-demand)
    const [categories, setCategories] = useState<ConsumerCategory[]>([]);
    const [subcategories, setSubcategories] = useState<Record<string, ConsumerSubcategory[]>>({});
    const [items, setItems] = useState<Record<string, ConsumerItem[]>>({});
    
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
    const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

    // Dependency States
    const [meters, setMeters] = useState<Meter[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    const consumerRootPath = 'modules/EM/ConsumerTypes';

    useEffect(() => {
        if (isOpen) {
            const fetchInitial = async () => {
                setLoading(true);
                try {
                    // 1. Fetch Meters
                    const metersRef = collection(db, `organisations/${organisation.domain}/modules/EM/meters`);
                    const metersSnap = await getDocs(query(metersRef, orderBy('name')));
                    setMeters(metersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Meter)));

                    // 2. Fetch Top-Level Categories
                    const catSnap = await getDocs(query(collection(db, consumerRootPath), orderBy('name')));
                    setCategories(catSnap.docs.map(d => ({ id: d.id, name: d.data().name })));

                } catch (e) {
                    console.error("Config Modal Init Error:", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchInitial();
        }
    }, [isOpen, organisation.domain]);

    const handleToggleCategory = async (catId: string) => {
        const isExpanding = !expandedCats[catId];
        setExpandedCats(prev => ({ ...prev, [catId]: isExpanding }));

        if (isExpanding && !subcategories[catId]) {
            setLoadingData(prev => ({ ...prev, [`cat_${catId}`]: true }));
            try {
                const subRef = collection(db, `${consumerRootPath}/${catId}/Subcategories`);
                const snap = await getDocs(query(subRef, orderBy('name')));
                const subData = snap.docs.map(d => ({ id: d.id, name: d.data().name, categoryId: catId }));
                setSubcategories(prev => ({ ...prev, [catId]: subData }));
            } finally {
                setLoadingData(prev => ({ ...prev, [`cat_${catId}`]: false }));
            }
        }
    };

    const handleToggleSubcategory = async (catId: string, subId: string) => {
        const isExpanding = !expandedSubs[subId];
        setExpandedSubs(prev => ({ ...prev, [subId]: isExpanding }));

        if (isExpanding && !items[subId]) {
            setLoadingData(prev => ({ ...prev, [`sub_${subId}`]: true }));
            try {
                const itemRef = collection(db, `${consumerRootPath}/${catId}/Subcategories/${subId}/SubSubcategories`);
                const snap = await getDocs(query(itemRef, orderBy('name')));
                const itemData = snap.docs.map(d => ({ id: d.id, name: d.data().name, subCategoryId: subId }));
                setItems(prev => ({ ...prev, [subId]: itemData }));
            } finally {
                setLoadingData(prev => ({ ...prev, [`sub_${subId}`]: false }));
            }
        }
    };

    const handleToggleItem = (item: ConsumerItem) => {
        setSelectedConsumerIds(prev => {
            const isSelected = prev.includes(item.id);
            if (isSelected) {
                return prev.filter(id => id !== item.id);
            } else {
                setSelectedConsumerDetails(d => ({ ...d, [item.id]: item.name }));
                return [...prev, item.id];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const nodeRef = doc(db, node.path);
            await updateDoc(nodeRef, {
                meteringType,
                linkedMeters: meteringType === 'Metered' ? linkedMeters : [],
                consumerIds: selectedConsumerIds
            });
            onClose();
        } catch (e) {
            console.error("Failed to save node config:", e);
            alert("Error saving configuration.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Composition & Consumers: ${node.name}`} size="6xl">
            <div className="flex flex-col h-[70vh] space-y-6">
                
                {/* Metering Logic Section */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner flex-shrink-0">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Master Metering Source</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { id: 'Metered', label: 'Metered', desc: 'Aggregate physical meters' },
                            { id: 'Summation', label: 'Summation', desc: 'Auto-sum child nodes' },
                            { id: 'Manual', label: 'Manual', desc: 'Periodic manual units' }
                        ].map(type => (
                            <label key={type.id} className={`flex flex-col p-4 border rounded-2xl cursor-pointer transition-all ${meteringType === type.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                                <input type="radio" name="meteringType" value={type.id} checked={meteringType === type.id} onChange={() => setMeteringType(type.id as MeteringType)} className="sr-only" />
                                <span className="font-black text-xs uppercase tracking-tight">{type.label}</span>
                                <span className={`text-[10px] mt-1 ${meteringType === type.id ? 'text-indigo-100' : 'text-slate-400'}`}>{type.desc}</span>
                            </label>
                        ))}
                    </div>

                    {meteringType === 'Metered' && (
                        <div className="mt-6 space-y-3 animate-fade-in">
                            <div className="flex justify-between items-center px-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Virtual Meter Composition</label>
                                <button onClick={() => setLinkedMeters([...linkedMeters, { meterId: '', operation: 'add' }])} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">+ Link Device</button>
                            </div>
                            <div className="space-y-2">
                                {linkedMeters.map((link, idx) => {
                                    const meter = meters.find(m => m.id === link.meterId);
                                    return (
                                    <div key={idx} className="flex items-center gap-3 bg-white p-2 border rounded-2xl shadow-sm border-slate-100">
                                        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                                            <button onClick={() => setLinkedMeters(linkedMeters.map((l, i) => i === idx ? { ...l, operation: 'add' } : l))} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${link.operation === 'add' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>+ ADD</button>
                                            <button onClick={() => setLinkedMeters(linkedMeters.map((l, i) => i === idx ? { ...l, operation: 'subtract' } : l))} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${link.operation === 'subtract' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>- SUB</button>
                                        </div>
                                        <div className="flex-1 flex items-center gap-4">
                                            <select value={link.meterId} onChange={e => setLinkedMeters(linkedMeters.map((l, i) => i === idx ? { ...l, meterId: e.target.value } : l))} className="p-2 border-0 bg-transparent text-xs font-bold text-slate-800 outline-none flex-grow">
                                                <option value="">-- Select Meter --</option>
                                                {meters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                            {meter && (
                                                <div className="flex items-center gap-2 pr-4">
                                                    <span className="text-[9px] font-mono bg-slate-100 px-2 py-0.5 rounded text-indigo-500 uppercase">IP: {meter.ipAddress}</span>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${meter.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => setLinkedMeters(linkedMeters.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                )})}
                            </div>
                        </div>
                    )}
                </div>

                {/* Consumer Mapping Section */}
                <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
                    {/* Catalog Drill-down */}
                    <div className="flex-1 bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Browse Consumer Catalog</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
                            {categories.map(cat => (
                                <div key={cat.id} className="space-y-1">
                                    <div 
                                        onClick={() => handleToggleCategory(cat.id)}
                                        className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-colors ${expandedCats[cat.id] ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        <ChevronIcon expanded={expandedCats[cat.id]} />
                                        <span className="text-xs font-bold">{cat.name}</span>
                                        {loadingData[`cat_${cat.id}`] && <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
                                    </div>

                                    {expandedCats[cat.id] && (
                                        <div className="ml-4 space-y-1">
                                            {subcategories[cat.id]?.map(sub => (
                                                <div key={sub.id} className="space-y-1">
                                                    <div 
                                                        onClick={() => handleToggleSubcategory(cat.id, sub.id)}
                                                        className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-colors ${expandedSubs[sub.id] ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                                    >
                                                        <ChevronIcon expanded={expandedSubs[sub.id]} />
                                                        <span className="text-xs font-medium">{sub.name}</span>
                                                        {loadingData[`sub_${sub.id}`] && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
                                                    </div>

                                                    {expandedSubs[sub.id] && (
                                                        <div className="ml-6 space-y-1 py-1">
                                                            {items[sub.id]?.map(item => {
                                                                const isSelected = selectedConsumerIds.includes(item.id);
                                                                return (
                                                                    <div 
                                                                        key={item.id}
                                                                        onClick={() => handleToggleItem(item)}
                                                                        className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-transparent hover:bg-slate-50 text-slate-600'}`}
                                                                    >
                                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                                                                            {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                                                        </div>
                                                                        <span className="text-xs">{item.name}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selection Summary */}
                    <div className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-100/50 flex justify-between items-center">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Selection ({selectedConsumerIds.length})</h4>
                             {selectedConsumerIds.length > 0 && (
                                 <button onClick={() => setSelectedConsumerIds([])} className="text-[10px] font-black text-rose-500 uppercase hover:underline">Clear</button>
                             )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                            {selectedConsumerIds.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic text-center py-10">No items selected.</p>
                            ) : (
                                selectedConsumerIds.map(id => (
                                    <div key={id} className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group">
                                        <span className="text-[11px] font-bold text-slate-700 truncate mr-2" title={selectedConsumerDetails[id] || id}>
                                            {selectedConsumerDetails[id] || 'Loading...'}
                                        </span>
                                        <button onClick={() => setSelectedConsumerIds(p => p.filter(x => x !== id))} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 flex-shrink-0">
                    <Button variant="secondary" onClick={onClose} disabled={saving} className="!w-auto px-10">Discard</Button>
                    <Button 
                        onClick={handleSave} 
                        isLoading={saving} 
                        className="!w-auto px-12 shadow-xl shadow-indigo-100 font-bold" 
                        style={{ backgroundColor: theme.colorPrimary }}
                    >
                        Save Configuration
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default TopographyNodeConfigModal;
