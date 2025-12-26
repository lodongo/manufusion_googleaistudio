
import React from 'react';
import WarehouseConfiguration from '../../org/WarehouseConfiguration';
import { MaterialDetailPage } from '../../modules/in/MaterialDetailPage';
import { OrgHierarchy } from '../../org/OrgHierarchy';
import type { AppUser, Organisation } from '../../../types';
import type { HierarchyNode } from '../../org/HierarchyNodeModal';

interface SetupHierarchyProps {
    configuringWarehouseNode: HierarchyNode | null;
    setConfiguringWarehouseNode: (node: HierarchyNode | null) => void;
    viewingMaterialPath: string | null;
    setViewingMaterialPath: (path: string | null) => void;
    currentUserProfile: AppUser;
    organisationData: Organisation | undefined;
    theme: Organisation['theme'];
    /* Added currencyConfig prop to fix MaterialDetailPage missing prop error */
    currencyConfig: { local: string; base: string; rate: number };
}

export const SetupHierarchy: React.FC<SetupHierarchyProps> = ({
    configuringWarehouseNode,
    setConfiguringWarehouseNode,
    viewingMaterialPath,
    setViewingMaterialPath,
    currentUserProfile,
    organisationData,
    theme,
    currencyConfig
}) => {
    if (configuringWarehouseNode) {
        return (
            <WarehouseConfiguration 
                 warehouseNode={configuringWarehouseNode}
                 onBack={() => setConfiguringWarehouseNode(null)}
                 currentUserProfile={currentUserProfile}
                 theme={theme}
                 onViewMaterial={(path) => setViewingMaterialPath(path)}
            />
        );
    }
    
    if (viewingMaterialPath) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm">
                 <MaterialDetailPage
                     materialPath={viewingMaterialPath}
                     onBack={() => setViewingMaterialPath(null)}
                     currentUser={currentUserProfile}
                     organisation={organisationData!}
                     theme={theme}
                     /* Passed currencyConfig to MaterialDetailPage */
                     currencyConfig={currencyConfig}
                 />
            </div>
        );
    }

    return (
        <OrgHierarchy 
             currentUserProfile={currentUserProfile}
             organisationData={organisationData}
             theme={theme}
             onConfigureNode={(node) => setConfiguringWarehouseNode(node)}
        />
    );
};
