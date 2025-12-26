
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Module, OrgPillarConfig } from '../../types';
import type { FullPillar } from '../../types/mat_types';
import Button from '../Button';
import ModuleRightsManager from '../admin/ModuleRightsManager';
import { addLog } from '../../services/logger';
import { matSupplyChainData } from '../../constants/mat_supply_chain';
import { matSustainabilityData } from '../../constants/mat_sustainability';
import { matTeamworkData } from '../../constants/mat_teamwork';

const seedDataMap: Record<string, { name: string, data: any }> = {
    'SUPPLY_CHAIN_MATURITY': { name: 'Supply Chain Maturity', data: matSupplyChainData },
    'SUSTAINABILITY_MATURITY': { name: 'Sustainability Maturity', data: matSustainabilityData },
    'TEAMWORK_MATURITY': { name: 'Teamwork Maturity', data: matTeamworkData },
};

interface ModuleSetupPageProps {
  module: Module;
  onBackToModules: () => void;
}

const PillarConfigTab: React.FC = () => {
    const [pillars, setPillars] = useState<FullPillar[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [needsSeeding, setNeedsSeeding] = useState(false);

    const pillarsRef = collection(db, 'modules/MAT/pillars');

    useEffect(() => {
        const q = query(pillarsRef, orderBy('code'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setNeedsSeeding(true);
            } else {
                setPillars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FullPillar)));
                setNeedsSeeding(false);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSeedData = async () => {
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            
            // Seed Pillars and their sub-collections
            Object.entries(seedDataMap).forEach(([code, info]) => {
                const pillarRef = doc(pillarsRef, code);
                batch.set(pillarRef, { 
                    code, 
                    name: info.name, 
                    description: `${info.name} Assessment Model`,
                    enabled: true 
                });

                // Seed Stages
                Object.values(info.data).forEach((stage: any) => {
                    const stageRef = doc(collection(pillarRef, 'stages'), stage.code);
                    batch.set(stageRef, { 
                        code: stage.code, 
                        name: stage.name,
                        enabled: true 
                    });

                    // Seed Themes
                    stage.themes.forEach((theme: any) => {
                        const themeRef = doc(collection(stageRef, 'themes'), theme.code);
                        batch.set(themeRef, {
                            code: theme.code,
                            name: theme.name,
                            enabled: true
                        });

                        // Seed Questions
                        theme.questions.forEach((question: any) => {
                            const questionRef = doc(collection(themeRef, 'questions'), question.code);
                            batch.set(questionRef, {
                                code: question.code,
                                text: question.text,
                                audit_guidelines: question.audit_guidelines || [],
                                enabled: true
                            });
                        });
                    });
                });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error seeding MAT data:", error);
            alert("Failed to seed data.");
        } finally {
            setIsSeeding(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading configuration...</div>;

    if (needsSeeding) {
        return (
            <div className="text-center p-8 bg-gray-50 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Setup Required</h3>
                <p className="text-gray-500 mb-4">No maturity assessment models found. Populate the database with default models (Supply Chain, Sustainability, Teamwork) to begin.</p>
                <Button onClick={handleSeedData} isLoading={isSeeding}>Seed Default Models</Button>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Available Maturity Models</h3>
            <p className="text-sm text-gray-600 mb-6">The following assessment pillars are available in the system master data.</p>
            <div className="grid grid-cols-1 gap-4">
                {pillars.map(pillar => (
                    <div key={pillar.id} className="p-4 border rounded-lg bg-white shadow-sm">
                        <h4 className="font-bold text-slate-800">{pillar.name}</h4>
                        <p className="text-sm text-slate-600">{pillar.description}</p>
                        <div className="mt-2 text-xs text-slate-400 font-mono">{pillar.code}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MatMemsSetupPage: React.FC<ModuleSetupPageProps> = ({ module, onBackToModules }) => {
  const [activeTab, setActiveTab] = useState('pillars');

  const TabButton: React.FC<{tabName: string; label: string}> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabName
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pillars':
        return <PillarConfigTab />;
      case 'rights':
        return <ModuleRightsManager module={module} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{module.name}</h1>
          <p className="text-gray-500 font-semibold">Module Setup</p>
        </div>
        <button
            onClick={onBackToModules}
            className="text-sm text-blue-600 hover:underline"
        >
            &larr; Back to Module Management
        </button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                <TabButton tabName="pillars" label="Maturity Models" />
                <TabButton tabName="rights" label="Rights" />
            </nav>
        </div>
        
        <div className="mt-6">
            {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default MatMemsSetupPage;
