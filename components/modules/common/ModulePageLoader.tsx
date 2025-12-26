
import React, { Suspense } from 'react';

// Statically define lazy-loaded components
const components = {
    // AM Module
    am_user: React.lazy(() => import('../modules/am_user')),
    am_admin: React.lazy(() => import('../modules/am_admin')),
    am_memssetup: React.lazy(() => import('../modules/am_memssetup')),
    // FI Module
    fi_user: React.lazy(() => import('../modules/fi_user')),
    fi_admin: React.lazy(() => import('../modules/fi_admin')),
    fi_memssetup: React.lazy(() => import('../modules/fi_memssetup')),
    // FL Module
    fl_user: React.lazy(() => import('../modules/fl_user')),
    fl_admin: React.lazy(() => import('../modules/fl_admin')),
    fl_memssetup: React.lazy(() => import('../modules/fl_memssetup')),
    // HR Module
    hr_user: React.lazy(() => import('../modules/hr_user')),
    hr_admin: React.lazy(() => import('../modules/hr_admin')),
    hr_memssetup: React.lazy(() => import('../modules/hr_memssetup')),
    // IN Module
    in_user: React.lazy(() => import('../modules/in_user')),
    in_admin: React.lazy(() => import('../modules/in_admin')),
    in_memssetup: React.lazy(() => import('../modules/in_memssetup')),
    // MA Module
    ma_user: React.lazy(() => import('../modules/ma_user')),
    ma_admin: React.lazy(() => import('../modules/ma_admin')),
    ma_memssetup: React.lazy(() => import('../modules/ma_memssetup')),
    // MAT Module
    mat_user: React.lazy(() => import('../modules/mat_user')),
    mat_admin: React.lazy(() => import('../modules/mat_admin')),
    // FIX: The mat_memssetup module was missing a default export, which is required by React.lazy.
    mat_memssetup: React.lazy(() => import('../modules/mat_memssetup')),
    // OD Module
    od_user: React.lazy(() => import('../modules/od_user')),
    od_admin: React.lazy(() => import('../modules/od_admin')),
    od_memssetup: React.lazy(() => import('../modules/od_memssetup')),
    // PR Module
    pr_user: React.lazy(() => import('../modules/pr_user')),
    pr_admin: React.lazy(() => import('../modules/pr_admin')),
    pr_memssetup: React.lazy(() => import('../modules/pr_memssetup')),
    // WH Module
    wh_user: React.lazy(() => import('../modules/wh_user')),
    wh_admin: React.lazy(() => import('../modules/wh_admin')),
    wh_memssetup: React.lazy(() => import('../modules/wh_memssetup')),
    // SHE Module
    she_user: React.lazy(() => import('../modules/she_user')),
    she_admin: React.lazy(() => import('../modules/she_admin')),
    she_memssetup: React.lazy(() => import('../modules/she_memssetup')),
};

type ComponentKey = keyof typeof components;

interface ModulePageLoaderProps {
    moduleCode: string;
    pageType: 'admin' | 'user' | 'memssetup';
    [key: string]: any; // To pass through other props
}

const ModulePageLoader: React.FC<ModulePageLoaderProps> = ({ moduleCode, pageType, ...props }) => {
    
    const key: ComponentKey = `${moduleCode.toLowerCase()}_${pageType}` as ComponentKey;
    const PageComponent = components[key];

    if (!PageComponent) {
        const path = `/components/modules/${moduleCode.toLowerCase()}_${pageType}.tsx`;
        const onBack = props.onBackToDashboard || props.onBackToModules;
        return (
            <div className="p-8 bg-white rounded-lg shadow">
                <h2 className="text-2xl font-bold text-red-600">Component Not Found</h2>
                <p className="mt-2 text-gray-600">The page component for module code <strong>{moduleCode}</strong> and view type <strong>{pageType}</strong> could not be loaded.</p>
                <p className="mt-1 text-sm text-gray-500">Please ensure the file exists at: <code>{path}</code> and that it is registered in <code>ModulePageLoader.tsx</code>.</p>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mt-4 text-sm text-blue-600 hover:underline"
                    >
                       &larr; Go Back
                    </button>
                )}
            </div>
        );
    }

    return (
        <Suspense fallback={<div className="flex justify-center items-center p-8"><div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div></div>}>
            <PageComponent {...props} />
        </Suspense>
    );
};

export default ModulePageLoader;
