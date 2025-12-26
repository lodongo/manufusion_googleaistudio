
import React from 'react';
import Input from '../../Input';
import type { Organisation } from '../../../types';

interface ThemeTabProps {
    orgData: Organisation;
    handleThemeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    logoPreview: string;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ThemeTab: React.FC<ThemeTabProps> = ({
    orgData,
    handleThemeChange,
    logoPreview,
    fileInputRef,
    handleLogoChange
}) => {
    return (
        <div className="space-y-4">
            <Input id="slogan" label="Slogan" type="text" value={orgData.theme.slogan} onChange={handleThemeChange} />
            <div>
                <label className="block text-sm font-medium text-slate-700">Logo</label>
                <div className="mt-1 flex items-center space-x-6">
                    <div className="shrink-0">
                        {logoPreview ? (
                            <img className="h-16 w-16 object-contain rounded-md bg-slate-100 p-1" src={logoPreview} alt="Current logo" />
                        ) : (
                            <div className="h-16 w-16 bg-slate-100 rounded-md flex items-center justify-center text-slate-400">No Logo</div>
                        )}
                    </div>
                    <label className="block">
                        <span className="sr-only">Choose logo file</span>
                        <input type="file" ref={fileInputRef} onChange={handleLogoChange} accept="image/png, image/jpeg, image/svg+xml" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </label>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input id="colorPrimary" label="Primary Color" type="color" value={orgData.theme.colorPrimary} onChange={handleThemeChange} containerClassName="h-10 w-full p-1" />
                <Input id="colorSecondary" label="Secondary Color" type="color" value={orgData.theme.colorSecondary} onChange={handleThemeChange} containerClassName="h-10 w-full p-1" />
                <Input id="colorAccent" label="Accent Color" type="color" value={orgData.theme.colorAccent} onChange={handleThemeChange} containerClassName="h-10 w-full p-1" />
            </div>
        </div>
    );
};
