
import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import Input from '../../Input';
import Button from '../../Button';
import ZeroBasedBudgetForm from './ZeroBasedBudgetForm';
import type { AppUser, Organisation } from '../../../types';

interface BudgetEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Record<string, number>) => Promise<void>;
  period: string; // 'P01', 'P02', ... or 'Total'
  currentValues: { budget: number; actuals: number; previous: number };
  glAccountPath: string;
  currentUser: AppUser;
  organisation: Organisation;
}

const BudgetEntryModal: React.FC<BudgetEntryModalProps> = ({ isOpen, onClose, onSave, period, currentValues, glAccountPath, currentUser, organisation }) => {
  const [editMode, setEditMode] = useState<'equal' | 'monthly' | 'zerobased'>('equal');
  const [totalValue, setTotalValue] = useState<number | ''>('');
  const [monthlyValues, setMonthlyValues] = useState<Array<number | ''>>(Array(12).fill(''));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (period !== 'Total') {
        setTotalValue(currentValues.budget);
      } else {
        setTotalValue('');
      }
      setMonthlyValues(Array(12).fill(''));
      setEditMode('equal');
    }
  }, [isOpen, period, currentValues.budget]);

  const handleSave = async () => {
    setIsLoading(true);
    const updates: Record<string, number> = {};

    if (period !== 'Total') {
      updates[period] = Number(totalValue) || 0;
    } else {
      if (editMode === 'equal') {
        const monthlyAmount = (Number(totalValue) || 0) / 12;
        for (let i = 1; i <= 12; i++) {
          updates[`P${i.toString().padStart(2, '0')}`] = monthlyAmount;
        }
      } else { // monthly
        for (let i = 0; i < 12; i++) {
          updates[`P${(i + 1).toString().padStart(2, '0')}`] = Number(monthlyValues[i]) || 0;
        }
      }
    }
    await onSave(updates);
    setIsLoading(false);
    onClose();
  };

  const handleApplyZeroBased = async (monthlyTotals: number[]) => {
    const updates: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
        updates[`P${(i + 1).toString().padStart(2, '0')}`] = monthlyTotals[i] || 0;
    }
    
    setIsLoading(true);
    try {
        await onSave(updates);
        onClose();
    } catch (err) {
        console.error("Failed to apply zero-based budget:", err);
    } finally {
        setIsLoading(false);
    }
  };

  const renderTotalEdit = () => (
    <>
      <div className="flex items-center space-x-4 mb-4 border-b pb-4">
        <label className="flex items-center"><input type="radio" name="editMode" value="equal" checked={editMode === 'equal'} onChange={() => setEditMode('equal')} className="mr-2" /> Distribute Equally</label>
        <label className="flex items-center"><input type="radio" name="editMode" value="monthly" checked={editMode === 'monthly'} onChange={() => setEditMode('monthly')} className="mr-2" /> Enter Monthly</label>
        <label className="flex items-center"><input type="radio" name="editMode" value="zerobased" checked={editMode === 'zerobased'} onChange={() => setEditMode('zerobased')} className="mr-2" /> Zero-Based</label>
      </div>
      {editMode === 'equal' && (
        <Input id="totalValue" label="Total Annual Budget" type="number" value={totalValue} onChange={e => setTotalValue(Number(e.target.value))} />
      )}
      {editMode === 'monthly' && (
        <div className="space-y-2">
            <h4 className="font-medium text-slate-700">Monthly Budget Amounts</h4>
            <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                    <Input key={i} id={`month-${i}`} label={`P${i + 1}`} type="number" value={monthlyValues[i]} 
                        onChange={e => {
                            const newValues = [...monthlyValues];
                            newValues[i] = Number(e.target.value);
                            setMonthlyValues(newValues);
                        }} 
                    />
                ))}
            </div>
            <p className="text-right font-semibold">
                Total: {monthlyValues.reduce((sum: number, val) => sum + Number(val), 0).toLocaleString()}
            </p>
        </div>
      )}
      {editMode === 'zerobased' && (
        <ZeroBasedBudgetForm
            glAccountPath={glAccountPath}
            currentUser={currentUser}
            onApply={handleApplyZeroBased}
            onCancel={onClose}
        />
      )}
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Budget for ${period === 'Total' ? 'Annual Total' : `Period ${period}`}`} size={period === 'Total' && editMode === 'zerobased' ? '7xl' : '3xl'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-100 rounded-md text-center">
                <p className="text-sm font-medium text-slate-500">Actuals</p>
                <p className="text-lg font-bold text-slate-800">{currentValues.actuals.toLocaleString()}</p>
            </div>
             <div className="p-3 bg-slate-100 rounded-md text-center">
                <p className="text-sm font-medium text-slate-500">Previous Year</p>
                <p className="text-lg font-bold text-slate-800">{currentValues.previous.toLocaleString()}</p>
            </div>
        </div>
        
        {period === 'Total' ? (
          renderTotalEdit()
        ) : (
          <Input id="periodValue" label={`New Budget for ${period}`} type="number" value={totalValue} onChange={e => setTotalValue(Number(e.target.value))} required />
        )}
        
        {editMode !== 'zerobased' && (
            <div className="flex justify-end pt-4 border-t gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button onClick={handleSave} isLoading={isLoading}>Save Budget</Button>
            </div>
        )}
      </div>
    </Modal>
  );
};

export default BudgetEntryModal;
