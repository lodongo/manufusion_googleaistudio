
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../services/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import type { AppUser } from '../../../types';
import type { ZeroBasedBudgetTemplate, ZeroBasedBudgetLineItem } from '../../../types/fi_types';
import Input from '../../Input';
import Button from '../../Button';
import ConfirmationModal from '../../common/ConfirmationModal';

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface ZeroBasedBudgetFormProps {
  glAccountPath: string;
  currentUser: AppUser;
  onApply: (monthlyTotals: number[]) => void;
  onCancel: () => void;
}

const ZeroBasedBudgetForm: React.FC<ZeroBasedBudgetFormProps> = ({ glAccountPath, currentUser, onApply, onCancel }) => {
  const [lineItems, setLineItems] = useState<ZeroBasedBudgetLineItem[]>([]);
  const [templates, setTemplates] = useState<ZeroBasedBudgetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<ZeroBasedBudgetTemplate | null>(null);

  const templatesRef = useMemo(() => collection(db, glAccountPath, 'zeroBasedTemplates'), [glAccountPath]);

  useEffect(() => {
    const q = query(templatesRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ZeroBasedBudgetTemplate)));
      setLoading(false);
    });
    return unsubscribe;
  }, [templatesRef]);

  const handleLineItemChange = (index: number, field: keyof Omit<ZeroBasedBudgetLineItem, 'monthlyValues'|'id'>, value: string | number) => {
    const newItems = [...lineItems];
    (newItems[index] as any)[field] = value;
    setLineItems(newItems);
  };
  
  const handleMonthlyValueChange = (index: number, monthIndex: number, value: string) => {
    const newItems = [...lineItems];
    newItems[index].monthlyValues[monthIndex] = Number(value) || 0;
    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: uuidv4(),
      description: '',
      costPerItem: 0,
      calcMode: 'DIRECT',
      monthlyValues: Array(12).fill(0),
      notes: ''
    }]);
  };
  
  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };
  
  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    lineItems.forEach(item => {
      item.monthlyValues.forEach((value, monthIndex) => {
        const monthlyQty = item.calcMode === 'DRIVER'
          ? (Number(value) || 0) * (Number(item.driverRate) || 0)
          : (Number(value) || 0);
        totals[monthIndex] += monthlyQty * (Number(item.costPerItem) || 0);
      });
    });
    return totals;
  }, [lineItems]);
  
  const annualTotal = useMemo(() => monthlyTotals.reduce((sum, val) => sum + val, 0), [monthlyTotals]);

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
        // Handle backward compatibility with old template structure
        const loadedItems = template.lineItems.map((item: any) => ({
            ...item,
            id: uuidv4(),
            calcMode: item.calcMode || 'DIRECT',
            monthlyValues: item.monthlyValues || item.monthlyQuantities || Array(12).fill(0),
        }));
        setLineItems(loadedItems);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) { alert('Please provide a name for the template.'); return; }
    setSavingTemplate(true);
    try {
        const newTemplate: Omit<ZeroBasedBudgetTemplate, 'id'> = {
            name: newTemplateName,
            lineItems: lineItems,
            createdAt: Timestamp.now(),
            createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
        };
        const docRef = doc(templatesRef);
        await setDoc(docRef, newTemplate);
        setNewTemplateName('');
        alert('Template saved successfully!');
    } catch (err) {
        console.error(err);
        alert('Failed to save template.');
    } finally {
        setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!confirmDeleteTemplate) return;
    setSavingTemplate(true);
    try {
        await deleteDoc(doc(templatesRef, confirmDeleteTemplate.id));
        setConfirmDeleteTemplate(null);
    } catch(err) {
        console.error(err);
    } finally {
        setSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-slate-50 flex flex-col md:flex-row gap-4 items-end">
        <Input as="select" id="loadTemplate" label="Load Template" onChange={e => handleLoadTemplate(e.target.value)} containerClassName="flex-grow">
            <option value="">{loading ? 'Loading...' : 'Select a template to load...'}</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Input>
        <div className="flex gap-2 w-full md:w-auto">
            <Input id="newTemplateName" label="Save Current as New Template" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Enter template name..." containerClassName="flex-grow"/>
            <Button onClick={handleSaveTemplate} isLoading={savingTemplate} className="!w-auto" disabled={!newTemplateName.trim() || lineItems.length === 0}>Save</Button>
        </div>
      </div>
      
      <div className="overflow-x-auto border rounded-lg max-h-[40vh]">
        <table className="min-w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="p-2 text-left sticky left-0 bg-slate-100 z-20 w-48">Description</th>
              <th className="p-2 text-right w-28">Cost/Item</th>
              <th className="p-2 text-left w-64">Calculation</th>
              {Array.from({ length: 12 }).map((_, i) => <th key={i} className="p-2 text-right w-24">P{i+1} <span className="font-normal text-xs">(Qty/Units)</span></th>)}
              <th className="p-2 text-right w-28">Total Units/Qty</th>
              <th className="p-2 text-right w-28">Total Calc. Qty</th>
              <th className="p-2 text-right w-32">Total Cost</th>
              <th className="p-2 text-left w-48">Notes</th>
              <th className="p-2 w-16 sticky right-0 bg-slate-100 z-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lineItems.map((item, index) => {
                const totalDriverValue = item.monthlyValues.reduce((s, q) => s + (Number(q) || 0), 0);
                const totalCalculatedQty = item.calcMode === 'DRIVER'
                    ? totalDriverValue * (Number(item.driverRate) || 0)
                    : totalDriverValue;
                const totalCost = totalCalculatedQty * (Number(item.costPerItem) || 0);

                return (
                    <tr key={item.id} className="bg-white hover:bg-slate-50">
                        <td className="p-1 sticky left-0 bg-white z-10"><Input id={`desc-${item.id}`} label="" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="!mt-0" /></td>
                        <td className="p-1"><Input id={`cost-${item.id}`} label="" type="number" value={item.costPerItem} onChange={e => handleLineItemChange(index, 'costPerItem', Number(e.target.value))} className="!mt-0 text-right" /></td>
                        <td className="p-1">
                            <select value={item.calcMode || 'DIRECT'} onChange={e => handleLineItemChange(index, 'calcMode', e.target.value as any)} className="w-full p-2 border border-slate-300 rounded-md">
                                <option value="DIRECT">Direct Quantity</option>
                                <option value="DRIVER">Driver-Based</option>
                            </select>
                            {(item.calcMode || 'DIRECT') === 'DRIVER' && (
                                <div className="mt-1 space-y-1">
                                    <Input id={`unit-${item.id}`} label="Unit Name" value={item.driverUnit || ''} onChange={e => handleLineItemChange(index, 'driverUnit', e.target.value)} placeholder="e.g., Employees" />
                                    <Input id={`rate-${item.id}`} label="Rate / Unit" type="number" value={item.driverRate || ''} onChange={e => handleLineItemChange(index, 'driverRate', Number(e.target.value))} />
                                </div>
                            )}
                        </td>
                        {item.monthlyValues.map((value, monthIndex) => (
                            <td key={monthIndex} className="p-1"><Input id={`val-${item.id}-${monthIndex}`} label="" type="number" value={value} onChange={e => handleMonthlyValueChange(index, monthIndex, e.target.value)} className="!mt-0 text-right" /></td>
                        ))}
                        <td className="p-2 text-right font-medium">{totalDriverValue.toLocaleString()}</td>
                        <td className="p-2 text-right font-medium">{totalCalculatedQty.toLocaleString()}</td>
                        <td className="p-2 text-right font-medium">{totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="p-1"><Input id={`notes-${item.id}`} label="" value={item.notes || ''} onChange={e => handleLineItemChange(index, 'notes', e.target.value)} className="!mt-0"/></td>
                        <td className="p-2 text-center sticky right-0 bg-white z-10"><button type="button" onClick={() => removeLineItem(index)} className="text-red-500 hover:text-red-700"><DeleteIcon /></button></td>
                    </tr>
                );
            })}
          </tbody>
          <tfoot className="bg-slate-200 font-bold sticky bottom-0">
            <tr>
              <td className="p-2 sticky left-0 bg-slate-200 z-10 text-right" colSpan={3}>Monthly Totals:</td>
              {monthlyTotals.map((total, i) => <td key={i} className="p-2 text-right">{total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>)}
              <td className="p-2 text-right" colSpan={3}>{annualTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td colSpan={2} className="sticky right-0 bg-slate-200"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Button type="button" onClick={addLineItem} variant="secondary" className="!w-auto">+ Add Line Item</Button>

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex gap-2 items-center flex-wrap">
            {templates.length > 0 && <p className="text-sm">Manage Templates:</p>}
            {templates.map(t => (
                <div key={t.id} className="flex items-center gap-1 p-1 rounded bg-slate-100">
                    <span className="text-sm font-medium">{t.name}</span>
                    <button type="button" onClick={() => setConfirmDeleteTemplate(t)} className="text-red-500 hover:text-red-700 text-xs"><DeleteIcon/></button>
                </div>
            ))}
        </div>
        <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="button" onClick={() => onApply(monthlyTotals)}>Apply To Budget</Button>
        </div>
      </div>
      <ConfirmationModal
            isOpen={!!confirmDeleteTemplate}
            onClose={() => setConfirmDeleteTemplate(null)}
            onConfirm={handleDeleteTemplate}
            title={`Delete Template: ${confirmDeleteTemplate?.name}?`}
            message="Are you sure you want to delete this template? This action cannot be undone."
            isLoading={savingTemplate}
        />
    </div>
  );
};

export default ZeroBasedBudgetForm;
