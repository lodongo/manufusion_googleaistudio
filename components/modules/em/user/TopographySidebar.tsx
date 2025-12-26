
import React, { useState, useEffect } from 'react';
import { db } from '../../../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { Organisation } from '../../../../types';
import type { TopographyNode } from '../../../../types/em_types';

interface TopographySidebarProps {
    organisation: Organisation;
    onSelectNode: (node: TopographyNode) => void;
    selectedNodeId?: string;
    theme: Organisation['theme'];
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-180' : '-rotate-90 text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
    </svg>
);

const NodeItem: React.FC<{ 
    node: TopographyNode; 
    onSelect: (node: TopographyNode) => void;
    selectedId?: string;
    theme: Organisation['theme'];
}> = ({ node, onSelect, selectedId, theme }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [children, setChildren] = useState<TopographyNode[]>([]);
    const [loading, setLoading] = useState(false);
    const isSelected = selectedId === node.id;

    useEffect(() => {
        if (isExpanded) {
            setLoading(true);
            const unsub = onSnapshot(query(collection(db, `${node.path}/nodes`), orderBy('name')), (snap) => {
                setChildren(snap.docs.map(d => ({ id: d.id, ...d.data(), path: d.ref.path } as TopographyNode)));
                setLoading(false);
            });
            return () => unsub();
        }
    }, [isExpanded, node.path]);

    return (
        <div className="flex flex-col">
            <div 
                className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-100'}`}
                onClick={() => onSelect(node)}
            >
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    <ChevronIcon expanded={isExpanded} />
                </button>
                <div className="flex flex-col overflow-hidden">
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {node.name}
                    </span>
                    {node.meteringType && (
                        <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">
                            {node.meteringType}
                        </span>
                    )}
                </div>
            </div>
            
            {isExpanded && (
                <div className="ml-4 border-l border-slate-200 pl-2 mt-1 space-y-1">
                    {loading ? (
                        <div className="px-4 py-2 text-[10px] text-slate-400 italic">Syncing...</div>
                    ) : children.length === 0 ? (
                        <div className="px-4 py-2 text-[10px] text-slate-300 italic">End node</div>
                    ) : (
                        children.map(child => (
                            <NodeItem 
                                key={child.id} 
                                node={child} 
                                onSelect={onSelect} 
                                selectedId={selectedId} 
                                theme={theme} 
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const TopographySidebar: React.FC<TopographySidebarProps> = ({ organisation, onSelectNode, selectedNodeId, theme }) => {
    const [rootNodes, setRootNodes] = useState<TopographyNode[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, `organisations/${organisation.domain}/modules/EM/topography`), orderBy('name'));
        const unsub = onSnapshot(q, (snap) => {
            setRootNodes(snap.docs.map(d => ({ id: d.id, ...d.data(), path: d.ref.path } as TopographyNode)));
            setLoading(false);
        });
        return () => unsub();
    }, [organisation.domain]);

    return (
        <aside className="w-72 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden shadow-inner">
            <div className="p-4 border-b border-slate-200 bg-white">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Site Topography</h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 italic text-xs">Mapping hierarchy...</div>
                ) : rootNodes.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-xs">No topography configured.</div>
                ) : (
                    rootNodes.map(node => (
                        <NodeItem 
                            key={node.id} 
                            node={node} 
                            onSelect={onSelectNode} 
                            selectedId={selectedNodeId} 
                            theme={theme} 
                        />
                    ))
                )}
            </div>
        </aside>
    );
};

export default TopographySidebar;
