import React, { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import type { MemsCurrency } from '../../../types/fi_types';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';
import CurrencyModal from './CurrencyModal';
import { defaultCurrencies } from '../../../constants/currencies';

// Icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const CurrenciesTab: React.FC = () => {
  const [currencies, setCurrencies] = useState<MemsCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<MemsCurrency | null>(null);

  const collectionRef = db.collection('settings/memsSetup/currencies');

  useEffect(() => {
    const q = collectionRef.orderBy('code');
    const unsubscribe = q.onSnapshot((snapshot) => {
      if (snapshot.empty) {
        setNeedsSeeding(true);
      } else {
        setCurrencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MemsCurrency)));
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
      defaultCurrencies.forEach(currency => {
        const docRef = collectionRef.doc(currency.code);
        batch.set(docRef, { ...currency, enabled: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error seeding currency data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async (data: Omit<MemsCurrency, 'id'>, id?: string) => {
    const docRef = collectionRef.doc(data.code);
    if (id) {
      await docRef.update(data as any);
    } else {
      await docRef.set(data);
    }
  };

  const handleDelete = async () => {
    if (!selectedCurrency) return;
    await collectionRef.doc(selectedCurrency.id).delete();
    setIsConfirmModalOpen(false);
    setSelectedCurrency(null);
  };

  if (loading) {
    return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div></div>;
  }
  
  if (needsSeeding) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
        <p className="text-gray-500 mb-4">No currency data found. Populate the database with a default set of world currencies to begin.</p>
        <Button onClick={handleSeedData} isLoading={isSeeding}>Seed All Currencies</Button>
      </div>
    );
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Global Currencies</h3>
            <Button onClick={() => { setSelectedCurrency(null); setIsModalOpen(true); }}>
                Add New Currency
            </Button>
        </div>
      
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Symbol</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Used By</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {currencies.map(currency => (
                        <tr key={currency.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 bg-white text-sm font-mono">{currency.code}</td>
                            <td className="px-5 py-4 bg-white text-sm font-semibold">{currency.name}</td>
                            <td className="px-5 py-4 bg-white text-sm text-center">{currency.symbol}</td>
                            <td className="px-5 py-4 bg-white text-sm text-gray-600 truncate" style={{maxWidth: '300px'}} title={currency.countries.join(', ')}>{currency.countries.join(', ')}</td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <span className={`inline-block px-3 py-1 text-xs font-semibold leading-tight rounded-full ${currency.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {currency.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="px-5 py-4 bg-white text-sm text-center">
                                <div className="inline-flex space-x-2">
                                    <button onClick={() => { setSelectedCurrency(currency); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><EditIcon /></button>
                                    <button onClick={() => { setSelectedCurrency(currency); setIsConfirmModalOpen(true); }} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><DeleteIcon /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>

        <CurrencyModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            currencyToEdit={selectedCurrency}
        />

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleDelete}
            title="Confirm Deletion"
            message={`Are you sure you want to permanently delete "${selectedCurrency?.name}"?`}
            confirmButtonText="Delete"
        />
    </div>
  );
};

export default CurrenciesTab;