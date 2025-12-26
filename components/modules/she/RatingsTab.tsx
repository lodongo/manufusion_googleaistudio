// components/modules/she/RatingsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../../services/firebase';
import type { RatingComponent, RatingLevel } from '../../../types/she_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import RatingComponentModal from './RatingComponentModal';
import RatingLevelModal from './RatingLevelModal';
import { defaultSheRatings } from '../../../constants/she_ratings';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const RatingsTab: React.FC = () => {
    const [components, setComponents] = useState<RatingComponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);
    
    const [compModal, setCompModal] = useState<{ isOpen: boolean; data: RatingComponent | null }>({ isOpen: false, data: null });
    const [levelModal, setLevelModal] = useState<{ isOpen: boolean; data: RatingLevel | null; component: RatingComponent | null }>({ isOpen: false, data: null, component: null });
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; onConfirm: () => void; title: string; message: string }>({ isOpen: false, onConfirm: () => {}, title: '', message: '' });

    const collectionRef = db.collection('modules/SHE/Ratings');

    useEffect(() => {
        const q = collectionRef.orderBy('name');
        const unsubscribe = q.onSnapshot((snapshot) => {
            if (snapshot.empty) setNeedsSeeding(true);
            else {
                setComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RatingComponent)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = db.batch();
            for (const component of defaultSheRatings) {
                const docRef = collectionRef.doc(component.code);
                batch.set(docRef, component);
            }
            await batch.commit();
        } catch (error) { console.error("Error seeding rating data:", error); } 
        finally { setIsSeeding(false); }
    };
    
    const handleSaveComponent = async (data: Omit<RatingComponent, 'id'>) => {
        const docRef = collectionRef.doc(data.code);
        if (compModal.data) {
            await docRef.update(data);
        } else {
            await docRef.set(data);
        }
    };
    
    const handleSaveLevel = async (level: RatingLevel) => {
        if (!levelModal.component) return;
        const componentDocRef = collectionRef.doc(levelModal.component.id);
        const existingLevels = levelModal.component.levels || [];
        
        let updatedLevels;
        if (levelModal.data) { // Editing
            updatedLevels = existingLevels.map(l => (l.id === level.id ? level : l));
        } else { // Adding
            updatedLevels = [...existingLevels, level];
        }
        updatedLevels.sort((a,b) => a.score - b.score);
        await componentDocRef.update({ levels: updatedLevels });
    };

    if (loading) return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
    if (needsSeeding) return (
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
            <p className="text-gray-500 mb-4">No risk rating data found. Populate with defaults to begin.</p>
            <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Ratings</Button>
        </div>
    );
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Risk Rating Components</h3>
                <Button onClick={() => setCompModal({ isOpen: true, data: null })}>Add Component</Button>
            </div>
            <div className="space-y-4">
                {components.map(comp => (
                    <div key={comp.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-800">{comp.name}</h4>
                            <Button onClick={() => setLevelModal({ isOpen: true, data: null, component: comp })} className="!py-1 !px-3 text-xs">Add Level</Button>
                        </div>
                        <div className="divide-y">
                            {comp.levels?.map(level => (
                                <div key={level.id} className="py-2 flex justify-between items-center">
                                    <div>
                                        <p><strong>{level.score}</strong> - {level.name}</p>
                                        <p className="text-sm text-gray-500">{level.description}</p>
                                    </div>
                                    <button onClick={() => setLevelModal({ isOpen: true, data: level, component: comp })} className="p-2 text-blue-600"><EditIcon /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {compModal.isOpen && <RatingComponentModal isOpen={compModal.isOpen} onClose={() => setCompModal({isOpen:false, data: null})} onSave={handleSaveComponent} component={compModal.data} />}
            {levelModal.isOpen && <RatingLevelModal isOpen={levelModal.isOpen} onClose={() => setLevelModal({isOpen:false, data: null, component: null})} onSave={handleSaveLevel} level={levelModal.data} />}
        </div>
    );
};

export default RatingsTab;