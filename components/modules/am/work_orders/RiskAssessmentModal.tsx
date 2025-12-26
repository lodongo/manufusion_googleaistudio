import React, { useState, useEffect } from 'react';
import type { RiskAssessmentItem, Hazard, HazardCategory, Control, ControlCategory, RatingComponent, SheRiskAssessmentSettings, RatingLevel, RiskControl } from '../../../../types/she_types';
import type { AppUser } from '../../../../types';
import Modal from '../../../common/Modal';
import Input from '../../../Input';
import Button from '../../../Button';

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface RiskAssessmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (assessment: RiskAssessmentItem) => void;
    assessment: RiskAssessmentItem | null;
    sheMasterData: {
        riskSettings: SheRiskAssessmentSettings;
        ratingComponents: RatingComponent[];
        hazardCategories: HazardCategory[];
        hazards: Record<string, Hazard[]>;
        controlCategories: ControlCategory[];
        controls: Record<string, Control[]>;
    };
    employees: AppUser[];
}

const RiskAssessmentModal: React.FC<RiskAssessmentModalProps> = ({ isOpen, onClose, onSave, assessment, sheMasterData, employees }) => {
    const [formData, setFormData] = useState<RiskAssessmentItem>(assessment!);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if(assessment) {
            setFormData(assessment);
        }
    }, [assessment]);

    const calculateRiskScore = (ratings: Record<string, number>): number => {
        return sheMasterData.riskSettings.riskFormula.reduce((acc, componentCode) => {
            return acc * (ratings[componentCode] || 1);
        }, 1);
    };

    const handleRatingChange = (type: 'initial' | 'residual', componentCode: string, score: number) => {
        setFormData(prev => {
            const newRatings = { ...prev[`${type}Ratings`], [componentCode]: score };
            const newScore = calculateRiskScore(newRatings);
            const isIntolerable = newScore > sheMasterData.riskSettings.intolerableCutoff;
            
            if (type === 'initial') {
                return { ...prev, initialRatings: newRatings, initialScore: newScore, isIntolerable };
            } else {
                return { ...prev, residualRatings: newRatings, residualScore: newScore, isResidualTolerable: !isIntolerable };
            }
        });
    };
    
    const handleAddControl = () => {
        setFormData(prev => ({
            ...prev,
            controls: [...prev.controls, { 
                controlCategoryCode: '', 
                controlCategoryName: '', 
                controlId: '', 
                controlName: '', 
                controlDescription: '',
                isPreTask: false,
                durationMinutes: 15
            }]
        }));
    };
    
    const handleRemoveControl = (index: number) => {
        setFormData(prev => ({
            ...prev,
            controls: prev.controls.filter((_, i) => i !== index)
        }));
    };

    const handleControlChange = (index: number, field: keyof RiskControl | 'category', value: any) => {
        const newControls = [...formData.controls];
        const currentControl = { ...newControls[index] };

        if (field === 'category') {
            const category = sheMasterData.controlCategories.find((c: ControlCategory) => c.id === value);
            currentControl.controlCategoryCode = category?.code || '';
            currentControl.controlCategoryName = category?.name || '';
            currentControl.controlId = ''; 
            currentControl.controlName = '';
            currentControl.controlDescription = '';
        } else {
             if (field === 'controlId') {
                const category = sheMasterData.controlCategories.find((c: ControlCategory) => c.code === currentControl.controlCategoryCode);
                const control = sheMasterData.controls[category!.id]?.find((c: Control) => c.id === value);
                currentControl.controlId = control?.id || '';
                currentControl.controlName = control?.name || '';
                currentControl.controlDescription = control?.description || '';
             } else {
                 (currentControl as any)[field] = value;
             }
        }
        
        newControls[index] = currentControl;
        setFormData(prev => ({ ...prev, controls: newControls }));
    };

    const handleSave = () => {
        onSave(formData);
    };

    if (!assessment) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={assessment.id.startsWith('temp_') ? 'New Risk Assessment' : 'Edit Risk Assessment'} size="6xl">
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                     <Input id="hazardCategory" as="select" label="Hazard Category" value={formData.hazardCategoryCode} onChange={e => setFormData(p => ({...p, hazardCategoryCode: e.target.value, hazardId: ''}))}>
                        <option value="">Select...</option>
                        {sheMasterData.hazardCategories.map((cat: HazardCategory) => <option key={cat.id} value={cat.code}>{cat.name}</option>)}
                    </Input>
                    <Input id="specificHazard" as="select" label="Specific Hazard" value={formData.hazardId} onChange={e => {
                        const hazard = sheMasterData.hazards[sheMasterData.hazardCategories.find((c:HazardCategory) => c.code === formData.hazardCategoryCode)?.id || '']?.find((h:Hazard) => h.id === e.target.value);
                        setFormData(p => ({...p, hazardId: e.target.value, hazardName: hazard?.name || '', hazardDescription: hazard?.description || ''}));
                    }} disabled={!formData.hazardCategoryCode}>
                         <option value="">Select...</option>
                         {sheMasterData.hazards[sheMasterData.hazardCategories.find((c:HazardCategory) => c.code === formData.hazardCategoryCode)?.id || '']?.map((h:Hazard) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </Input>
                </div>
                {formData.hazardDescription && <p className="text-sm p-2 bg-slate-50 rounded-md">{formData.hazardDescription}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    <div>
                        <h4 className="font-semibold text-lg mb-2">Initial Risk</h4>
                        {sheMasterData.riskSettings.riskFormula.map((compCode: string) => {
                            const component = sheMasterData.ratingComponents.find((c: RatingComponent) => c.code === compCode);
                            if (!component) return null;
                            return (
                                <Input id={`initial-${compCode}`} as="select" key={compCode} label={component.name} value={formData.initialRatings[compCode] || ''} onChange={e => handleRatingChange('initial', compCode, Number(e.target.value))}>
                                    <option value="">Rate...</option>
                                    {component.levels.map((l: RatingLevel) => <option key={l.id} value={l.score}>{l.name} ({l.score})</option>)}
                                </Input>
                            );
                        })}
                        <div className={`mt-4 p-3 rounded-md text-center font-bold ${formData.isIntolerable ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            Score: {formData.initialScore} - {formData.isIntolerable ? 'Intolerable' : 'Tolerable'}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-lg mb-2">Residual Risk</h4>
                         {sheMasterData.riskSettings.riskFormula.map((compCode: string) => {
                            const component = sheMasterData.ratingComponents.find((c: RatingComponent) => c.code === compCode);
                            if (!component) return null;
                            return (
                                <Input id={`residual-${compCode}`} as="select" key={compCode} label={component.name} value={formData.residualRatings[compCode] || ''} onChange={e => handleRatingChange('residual', compCode, Number(e.target.value))} disabled={formData.controls.length === 0}>
                                    <option value="">Rate...</option>
                                    {component.levels.map((l: RatingLevel) => <option key={l.id} value={l.score}>{l.name} ({l.score})</option>)}
                                </Input>
                            );
                        })}
                        <div className={`mt-4 p-3 rounded-md text-center font-bold ${!formData.isResidualTolerable ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            Score: {formData.residualScore} - {formData.isResidualTolerable ? 'Tolerable' : 'Intolerable'}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <h4 className="font-semibold text-lg mb-2">Controls</h4>
                    <div className="space-y-3">
                        {formData.controls.map((control, index) => (
                            <div key={index} className="p-3 border rounded-md bg-slate-50 flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <Input id={`controlCategory-${index}`} as="select" label="Control Category" value={sheMasterData.controlCategories.find((c: ControlCategory) => c.code === control.controlCategoryCode)?.id || ''} onChange={e => handleControlChange(index, 'category', e.target.value)} containerClassName="flex-grow">
                                        <option value="">Select...</option>
                                        {sheMasterData.controlCategories.map((cat: ControlCategory) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </Input>
                                    <Input id={`control-${index}`} as="select" label="Specific Control" value={control.controlId} onChange={e => handleControlChange(index, 'controlId', e.target.value)} disabled={!control.controlCategoryCode} containerClassName="flex-grow">
                                        <option value="">Select...</option>
                                        {sheMasterData.controls[sheMasterData.controlCategories.find((c: ControlCategory) => c.code === control.controlCategoryCode)?.id || '']?.map((c: Control) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Input>
                                    <button type="button" onClick={() => handleRemoveControl(index)} className="mt-6 p-2 text-red-500 hover:bg-red-100 rounded-full"><DeleteIcon/></button>
                                </div>
                                
                                <div className="flex items-center gap-4 p-2 bg-yellow-50 rounded border border-yellow-100">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={control.isPreTask || false} 
                                            onChange={e => handleControlChange(index, 'isPreTask', e.target.checked)} 
                                            className="h-4 w-4 text-yellow-600 rounded focus:ring-yellow-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Executed before maintenance task?</span>
                                    </label>
                                    
                                    {control.isPreTask && (
                                        <div className="w-40">
                                            <Input 
                                                id={`duration-${index}`}
                                                as="select" 
                                                label="Duration" 
                                                value={control.durationMinutes || 15} 
                                                onChange={e => handleControlChange(index, 'durationMinutes', Number(e.target.value))}
                                                className="!mt-0 text-xs"
                                                containerClassName="!mb-0"
                                            >
                                                {[15, 30, 45, 60, 90, 120, 180, 240].map(m => <option key={m} value={m}>{m} mins</option>)}
                                            </Input>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="button" onClick={handleAddControl} variant="secondary" className="mt-3 !w-auto text-sm">+ Add Control</Button>
                    <Input id="controlDetails" as="textarea" label="Control Details / Remarks" value={formData.controlDetails} onChange={e => setFormData(p => ({...p, controlDetails: e.target.value}))} rows={3} containerClassName="mt-4" />
                </div>

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave}>Save Assessment</Button>
                </div>
            </div>
        </Modal>
    );
};

export default RiskAssessmentModal;