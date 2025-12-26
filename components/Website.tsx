
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import type { Module } from '../types';

interface WebsiteProps {
  onLoginClick: () => void;
  onSetupClick: () => void;
}

// --- Icon Components for Modules ---
const ModuleIcon: React.FC<{ code: string }> = ({ code }) => {
  const iconClass = "w-6 h-6 text-blue-600";
  switch (code) {
    case 'OD': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
    case 'HR': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a3.001 3.001 0 015.658 0M12 6a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'FI': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
    case 'PR': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
    case 'MA': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'AM': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14M5 10h14M5 14h14M5 18h14" /></svg>;
    case 'IN': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case 'WH': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 17l-3.13-3.13a4 4 0 010-5.66L14 5" /><path d="M7 12a4 4 0 000 5.66L10.13 20.8a4 4 0 005.66 0L19 17.66a4 4 0 000-5.66L15.87 8.87a4 4 0 00-5.66 0L7 12z" /><path d="M7 12L3.13 8.13a4 4 0 010-5.66L6.26  H12a4 4 0 015.66 0L20.8 5.47a4 4 0 010 5.66L17 14" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
    case 'FL': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    default: return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>;
  }
};

const Website: React.FC<WebsiteProps> = ({ onLoginClick, onSetupClick }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const modulesCollection = db.collection("modules");
        const q = modulesCollection.where("active", "==", true);
        const querySnapshot = await q.get();
        const modulesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
        modulesData.sort((a, b) => a.name.localeCompare(b.name));
        setModules(modulesData);
      } catch (error) {
        console.error("Error fetching modules:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchModules();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const ServiceCard: React.FC<{ module: Module }> = ({ module }) => (
    <div className="group bg-white rounded-2xl shadow-lg p-8 flex flex-col text-left transition-all duration-300 ease-in-out hover:shadow-2xl hover:-translate-y-2">
      <div className="mb-5 bg-blue-100 rounded-full h-14 w-14 flex items-center justify-center">
        <ModuleIcon code={module.code} />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{module.name}</h3>
      <p className="text-slate-600 text-sm flex-grow leading-relaxed">{module.description}</p>
    </div>
  );

  return (
    <div className="w-full bg-slate-50 min-h-screen antialiased flex flex-col">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${isScrolled || isMobileMenuOpen ? 'bg-white/80 backdrop-blur-lg shadow-md py-3' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              <a href="#" className="hover:text-blue-600 transition-colors">MEMS</a>
            </div>
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-4">
              <button onClick={onLoginClick} className="font-bold text-slate-700 hover:text-blue-600 transition-colors text-sm" aria-label="Sign In">Sign In</button>
              <button onClick={onSetupClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-full text-sm transition-all duration-300 ease-in-out transform hover:scale-105 shadow-sm" aria-label="Get Started">Get Started</button>
            </div>
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md text-slate-600 hover:bg-slate-100" aria-label="Open menu">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 px-4 pb-4 space-y-4">
            <button onClick={onLoginClick} className="w-full text-left font-bold text-slate-700 hover:text-blue-600 transition-colors text-sm py-2" aria-label="Sign In">Sign In</button>
            <button onClick={onSetupClick} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-full text-sm" aria-label="Get Started">Get Started</button>
          </div>
        )}
      </nav>

      <header className="relative w-full text-center pt-32 pb-24 md:pt-40 md:pb-32 px-4 bg-gradient-to-br from-blue-50 via-white to-gray-50 overflow-hidden border-b border-slate-200">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full opacity-30 -translate-x-16 -translate-y-16 blur-2xl"></div>
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-200 rounded-full opacity-30 translate-x-16 translate-y-16 blur-2xl"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-4">
            Build Your Future with <span className="text-blue-600">MEMS</span>
          </h1>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            The all-in-one Enterprise Management System designed for efficiency, scalability, and success.
          </p>
        </div>
      </header>
      
      <main className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex-grow">
        <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Powerful Modules, Seamless Integration</h2>
            <p className="text-slate-600 mt-4 text-lg">Everything your enterprise needs, connected in one intelligent platform.</p>
        </div>

        {loading ? (
            <div className="flex justify-center items-center py-10">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        ) : (
          modules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {modules.map(module => (
                    <ServiceCard key={module.id} module={module} />
                ))}
            </div>
          ) : (
            <div className="text-center bg-white p-12 rounded-2xl shadow-md">
                <p className="text-slate-500 text-lg">No services are available at the moment. Please check back later.</p>
            </div>
          )
        )}
      </main>

      <footer className="w-full bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16">
                <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-slate-900">MEMS</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        The Manufusion Enterprise Management System provides a robust, scalable platform to streamline your business operations and drive growth.
                    </p>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 tracking-wider uppercase">Our Offices</h4>
                        <div className="mt-4 space-y-4 text-sm text-slate-500">
                            <div>
                                <p className="font-medium text-slate-600">Headquarters</p>
                                <p>123 Innovation Drive</p>
                                <p>New York, NY 10001, USA</p>
                            </div>
                            <div>
                                <p className="font-medium text-slate-600">Europe Office</p>
                                <p>789 Tech Avenue</p>
                                <p>London, EC1Y 8SY, UK</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 tracking-wider uppercase">Contact Us</h4>
                        <div className="mt-4 space-y-2 text-sm text-slate-500">
                            <p>
                                <a href="mailto:info@mems.com" className="hover:text-blue-600">info@mems.com</a>
                            </p>
                            <p>
                                <a href="tel:+1-202-555-0149" className="hover:text-blue-600">(202) 555-0149</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-12 border-t border-slate-200 pt-8">
                <p className="text-sm text-slate-500 text-center">&copy; {new Date().getFullYear()} Manufusion Enterprise Management System. All Rights Reserved.</p>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default Website;