
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, storage } from '../services/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, writeBatch, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import Button from './Button';
import Input from './Input';
import Modal from './common/Modal';
import QRCode from 'qrcode';
import type { AppUser, Organisation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import EnergyManagement from './tools/EnergyManagement';

// --- QR Types ---
interface QRConfig {
    // Content
    url: string;
    label: string;
    
    // Colors & Gradient
    bgColor: string;
    qrColor: string;
    useGradient: boolean;
    gradientType: 'linear' | 'radial';
    gradientStart: string;
    gradientEnd: string;
    
    // Eyes (Finder Patterns)
    eyeColor: string;
    eyeShape: 'square' | 'circle' | 'rounded';
    eyeSize: number; // 0.1 to 1.0 relative to standard

    // Frame / Border
    frameStyle: 'none' | 'box' | 'rounded' | 'circle' | 'corners';
    frameCornerStyle: 'square' | 'circle'; 
    frameCornerRadius: number; // New field for corner roundness
    borderColor: string;
    borderWidth: number;
    borderPadding: number; // Padding between QR and Border
    outerMargin: number; // Padding outside the border
    
    // Label Style
    labelPosition: 'top' | 'bottom' | 'center';
    labelColor: string;
    labelBgColor: string;
    labelShape: 'none' | 'rectangle' | 'rounded' | 'pill' | 'callout' | 'full';
    fontFace: string;
    fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
    fontSize: number;

    // Logo
    logoData: string | null; // Base64
    logoSize: number; // 0.1 to 0.4
    logoBgColor: string;
    logoShape: 'square' | 'circle' | 'none';
}

interface QRTemplate {
    id: string;
    name: string;
    notes: string;
    config: QRConfig;
}

interface SavedQR {
    id: string;
    name: string;
    category: string;
    subCategory: string;
    config: QRConfig;
    sourceTemplateId?: string; // To track dependency
    createdAt: any;
}

// --- Category Management Types ---
interface QRSubCategory {
    name: string;
}

interface QRCategory {
    name: string;
    subCategories: QRSubCategory[];
}

interface QRCategorySettings {
    categories: QRCategory[];
}

// --- Dictionary Types ---
interface DictionaryPhonetic {
    text: string;
    audio?: string;
    sourceUrl?: string;
    license?: { name: string; url: string };
}

interface DictionaryDefinition {
    definition: string;
    synonyms: string[];
    antonyms: string[];
    example?: string;
}

interface DictionaryMeaning {
    partOfSpeech: string;
    definitions: DictionaryDefinition[];
    synonyms: string[];
    antonyms: string[];
}

interface DictionaryEntry {
    word: string;
    phonetic?: string;
    phonetics: DictionaryPhonetic[];
    meanings: DictionaryMeaning[];
    sourceUrls: string[];
}

// --- Form Builder Types ---
type QuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'checkboxes' | 'dropdown' | 'date' | 'time';

interface FormOption {
    id: string;
    text: string;
    isCorrect?: boolean; // For quiz mode
}

interface FormQuestion {
    id: string;
    type: QuestionType;
    text: string;
    description?: string;
    required: boolean;
    options?: FormOption[];
    points?: number; // For quiz mode
    mediaUrl?: string | null; // Base64 or URL
    systemTag?: string; // For auto-filling: 'name', 'email', 'l1'...'l5'
}

interface FormSection {
    id: string;
    title: string;
    description?: string;
    questions: FormQuestion[];
}

interface FormSettings {
    isAnonymous: boolean;
    allowGoBack: boolean;
    showResults: boolean;
    limitOneResponse: boolean;
    timeLimitMinutes: number; // 0 for no limit
    scheduleStart: string; // ISO string
    scheduleEnd: string; // ISO string
}

interface FormData {
    id: string;
    title: string;
    description: string;
    isQuiz: boolean;
    settings: FormSettings;
    sections: FormSection[];
    createdBy: { uid: string; name: string };
    createdAt: any;
    updatedAt: any;
}

interface FormSubmission {
    id: string;
    formId: string;
    respondentUid?: string;
    respondentName?: string; // Captured snapshot
    answers: Record<string, any>; // questionId: answer
    score: number;
    maxScore: number;
    submittedAt: any;
    timeTakenSeconds: number;
}

// --- CASIO FX-9750GIII COMPONENT ---
const CasioCalculator: React.FC = () => {
    const [display, setDisplay] = useState('');
    const [result, setResult] = useState('');
    const [lastAnswer, setLastAnswer] = useState('');
    const [shiftMode, setShiftMode] = useState(false);
    const [alphaMode, setAlphaMode] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const handlePress = (val: string) => {
        if (val === 'AC') {
            setDisplay('');
            setResult('');
        } else if (val === 'DEL') {
            setDisplay(prev => prev.slice(0, -1));
        } else if (val === 'EXE') {
            try {
                // Basic safe evaluation replacement
                let expression = display
                    .replace(/×/g, '*')
                    .replace(/÷/g, '/')
                    .replace(/\^/g, '**')
                    .replace(/√\(/g, 'Math.sqrt(')
                    .replace(/sin\(/g, 'Math.sin(')
                    .replace(/cos\(/g, 'Math.cos(')
                    .replace(/tan\(/g, 'Math.tan(')
                    .replace(/log\(/g, 'Math.log10(')
                    .replace(/ln\(/g, 'Math.log(')
                    .replace(/π/g, 'Math.PI')
                    .replace(/Ans/g, lastAnswer || '0');

                // eslint-disable-next-line no-new-func
                const evalResult = new Function('return ' + expression)();
                
                // Format result
                const finalRes = Number.isInteger(evalResult) ? evalResult.toString() : evalResult.toFixed(8).replace(/\.?0+$/, '');
                setResult(finalRes);
                setLastAnswer(finalRes);
                setDisplay(''); 
            } catch (e) {
                setResult('Syntax ERROR');
            }
        } else if (val === 'SHIFT') {
            setShiftMode(!shiftMode);
        } else if (val === 'ALPHA') {
            setAlphaMode(!alphaMode);
        } else {
            // Clear previous result if typing new number directly, unless operator
            if (result && !['+', '-', '×', '÷', '^'].includes(val) && display === '') {
                setResult('');
            }
            setDisplay(prev => prev + val);
            setShiftMode(false);
            setAlphaMode(false);
        }
    };

    // Button Styles
    const btnBase = "relative flex items-center justify-center text-xs font-bold rounded-full shadow-[0_2px_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-[2px] transition-all select-none cursor-pointer";
    const btnF = "w-8 h-5 bg-[#6d7278] text-white rounded-sm mb-6 text-[8px]";
    const btnRoundSmall = "w-8 h-6 bg-[#3b3b3b] text-white text-[9px]";
    const btnScientific = "w-10 h-7 bg-[#3b3b3b] text-white text-[10px]";
    const btnNum = "w-11 h-8 bg-[#e8e8e8] text-black text-sm";
    const btnOp = "w-11 h-8 bg-[#6d7278] text-white text-sm";
    const btnAccent = "w-11 h-8 bg-[#f7931e] text-white text-sm"; // DEL, AC
    const btnExe = "w-11 h-8 bg-[#3b82f6] text-white text-sm";

    const Key: React.FC<{ 
        label: string, 
        val?: string, 
        styleClass: string, 
        shiftLabel?: string, 
        alphaLabel?: string 
    }> = ({ label, val, styleClass, shiftLabel, alphaLabel }) => (
        <div className="flex flex-col items-center">
            <div className="flex gap-3 mb-0.5">
                {shiftLabel && <span className="text-[8px] text-[#d4aa00] font-bold">{shiftLabel}</span>}
                {alphaLabel && <span className="text-[8px] text-[#c53030] font-bold">{alphaLabel}</span>}
            </div>
            <button 
                className={styleClass}
                onClick={(e) => { e.stopPropagation(); handlePress(val || label); }}
            >
                {label}
            </button>
        </div>
    );

    const CalculatorBody = () => (
        <div 
            className={`relative w-[360px] bg-white rounded-[30px] shadow-2xl p-6 border border-slate-300 select-none transition-transform duration-300 ${isFullScreen ? 'shadow-none border-0' : ''}`}
            onClick={(e) => !isFullScreen && setIsFullScreen(true)}
        >
            {!isFullScreen && (
                <div className="absolute inset-0 bg-transparent cursor-pointer z-10 rounded-[30px]" title="Click to use calculator"></div>
            )}

            {/* Toggle Fullscreen Button (Top Right) */}
            <button 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-20 p-1"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsFullScreen(!isFullScreen);
                }}
            >
                {isFullScreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 9a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0v-4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0v-1.586l-2.293 2.293a1 1 0 01-1.414-1.414L13.586 15H12z" clipRule="evenodd" /></svg>
                )}
            </button>
            
            {/* Branding */}
            <div className="flex justify-between items-center mb-4 px-2">
                <span className="font-bold text-slate-800 text-lg tracking-widest">CASIO</span>
                <span className="text-xs font-semibold text-slate-500 italic">fx-9750GIII</span>
            </div>

            {/* Screen */}
            <div className="w-full h-32 bg-[#aebda0] rounded-lg shadow-inner border-4 border-[#8a9680] p-2 mb-6 font-mono relative overflow-hidden">
                {/* Status Bar */}
                <div className="flex justify-between text-[9px] text-slate-800 opacity-60 border-b border-slate-600/20 pb-0.5 mb-1">
                    <span>Run-Matrix</span>
                    <div className="flex gap-1">
                        {shiftMode && <span className="bg-black text-[#aebda0] px-1">S</span>}
                        {alphaMode && <span className="bg-black text-[#aebda0] px-1">A</span>}
                        <span>D</span>
                        <span>Math</span>
                    </div>
                </div>
                {/* Main Display */}
                <div className="flex flex-col justify-between h-[80%]">
                        <div className="text-right text-lg text-slate-900 break-all leading-tight">
                            {display}
                            <span className="animate-pulse">_</span>
                        </div>
                        <div className="text-right text-2xl font-bold text-slate-900">
                            {result}
                        </div>
                </div>
            </div>

            {/* F Keys Row */}
            <div className="grid grid-cols-6 gap-2 mb-2 px-2">
                <button className={btnF}>F1</button>
                <button className={btnF}>F2</button>
                <button className={btnF}>F3</button>
                <button className={btnF}>F4</button>
                <button className={btnF}>F5</button>
                <button className={btnF}>F6</button>
            </div>

            {/* Control Row (Shift, Optn, Dpad etc) */}
            <div className="grid grid-cols-5 gap-2 mb-4 items-center">
                <Key label="SHIFT" val="SHIFT" styleClass="w-9 h-6 bg-[#d4aa00] text-black text-[9px]" />
                <Key label="OPTN" styleClass={btnRoundSmall} />
                <Key label="VARS" styleClass={btnRoundSmall} />
                <Key label="MENU" styleClass={btnRoundSmall} />
                {/* D-PAD Mockup */}
                <div className="relative w-14 h-14 bg-slate-200 rounded-full shadow-inner flex items-center justify-center row-span-2 col-start-5">
                        <div className="w-10 h-10 bg-[#3b3b3b] rounded-full relative shadow-md cursor-pointer">
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[6px] text-white">▲</div>
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[6px] text-white">▼</div>
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[6px] text-white">▶</div>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] text-white">◀</div>
                        </div>
                </div>
                
                <Key label="ALPHA" val="ALPHA" styleClass="w-9 h-6 bg-[#c53030] text-white text-[9px]" />
                <Key label="x²" val="^2" styleClass={btnRoundSmall} />
                <Key label="^" val="^" styleClass={btnRoundSmall} />
                <Key label="EXIT" styleClass={btnRoundSmall} />
            </div>

            {/* Scientific Functions Row */}
            <div className="grid grid-cols-6 gap-2 mb-4">
                    <Key label="X,θ,T" styleClass={btnScientific} />
                    <Key label="log" val="log(" styleClass={btnScientific} shiftLabel="10˟"/>
                    <Key label="ln" val="ln(" styleClass={btnScientific} shiftLabel="e˟"/>
                    <Key label="sin" val="sin(" styleClass={btnScientific} shiftLabel="sin⁻¹"/>
                    <Key label="cos" val="cos(" styleClass={btnScientific} shiftLabel="cos⁻¹"/>
                    <Key label="tan" val="tan(" styleClass={btnScientific} shiftLabel="tan⁻¹"/>
                    
                    <Key label="a b/c" styleClass={btnScientific} />
                    <Key label="F↔D" styleClass={btnScientific} />
                    <Key label="(" val="(" styleClass={btnScientific} />
                    <Key label=")" val=")" styleClass={btnScientific} />
                    <Key label="," val="," styleClass={btnScientific} />
                    <Key label="→" styleClass={btnScientific} />
            </div>

            {/* Numpad Area */}
            <div className="grid grid-cols-5 gap-3">
                <Key label="7" styleClass={btnNum} />
                <Key label="8" styleClass={btnNum} />
                <Key label="9" styleClass={btnNum} />
                <Key label="DEL" styleClass={btnAccent} shiftLabel="INS"/>
                <Key label="AC" val="AC" styleClass={btnAccent} shiftLabel="OFF"/>
                
                <Key label="4" styleClass={btnNum} />
                <Key label="5" styleClass={btnNum} />
                <Key label="6" styleClass={btnNum} />
                <Key label="×" val="×" styleClass={btnOp} />
                <Key label="÷" val="÷" styleClass={btnOp} />

                <Key label="1" styleClass={btnNum} />
                <Key label="2" styleClass={btnNum} />
                <Key label="3" styleClass={btnNum} />
                <Key label="+" val="+" styleClass={btnOp} />
                <Key label="-" val="-" styleClass={btnOp} />

                <Key label="0" styleClass={btnNum} />
                <Key label="." val="." styleClass={btnNum} />
                <Key label="EXP" val="E" styleClass={btnNum} shiftLabel="π"/>
                <Key label="(-)" val="-" styleClass={btnNum} shiftLabel="Ans"/>
                <Key label="EXE" styleClass={btnExe} />
            </div>
        </div>
    );

    if (isFullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm overflow-hidden">
                <div className="transform transition-transform scale-[0.85] sm:scale-100 md:scale-110 lg:scale-125">
                    <CalculatorBody />
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center py-10 bg-slate-100 min-h-full">
            <div className="transform transition-transform hover:scale-[1.02] cursor-pointer">
                <CalculatorBody />
            </div>
        </div>
    );
};

// --- Dictionary Tool Component ---
const DictionaryTool: React.FC<{ theme: Organisation['theme'] }> = ({ theme }) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<DictionaryEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        const savedHistory = localStorage.getItem('dict_history');
        const savedFavs = localStorage.getItem('dict_favorites');
        if (savedHistory) setHistory(JSON.parse(savedHistory));
        if (savedFavs) setFavorites(JSON.parse(savedFavs));
    }, []);

    const saveToHistory = (word: string) => {
        const newHistory = [word, ...history.filter(w => w !== word)].slice(0, 20);
        setHistory(newHistory);
        localStorage.setItem('dict_history', JSON.stringify(newHistory));
    };

    const toggleFavorite = (word: string) => {
        let newFavs;
        if (favorites.includes(word)) {
            newFavs = favorites.filter(w => w !== word);
        } else {
            newFavs = [word, ...favorites];
        }
        setFavorites(newFavs);
        localStorage.setItem('dict_favorites', JSON.stringify(newFavs));
    };

    const searchWord = async (wordToSearch: string) => {
        if (!wordToSearch.trim()) return;
        setLoading(true);
        setError('');
        setQuery(wordToSearch);

        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${wordToSearch}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error("Word not found");
                throw new Error("Failed to fetch definition");
            }
            const data: DictionaryEntry[] = await res.json();
            if (data.length > 0) {
                setResult(data[0]);
                saveToHistory(data[0].word);
            }
        } catch (err: any) {
            setError(err.message);
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const playAudio = (url: string) => {
        new Audio(url).play();
    };

    const getAudioUrl = (phonetics: DictionaryPhonetic[]) => {
        return phonetics.find(p => p.audio && p.audio.length > 0)?.audio;
    };

    return (
        <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-slate-50">
            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-10">
                <div className="max-w-3xl mx-auto w-full">
                    {/* Search Bar */}
                    <div className="relative mb-8">
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchWord(query)}
                            placeholder="Search for a word..."
                            className="w-full text-lg px-6 py-4 rounded-full border-2 border-slate-200 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500 focus:outline-none transition-all pl-14"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <button 
                            onClick={() => searchWord(query)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
                            style={{ backgroundColor: theme.colorPrimary }}
                        >
                            Search
                        </button>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                             <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                            <div className="text-6xl mb-4">😕</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">{error}</h3>
                            <p className="text-slate-500">Please check your spelling or try another word.</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-6 animate-fade-in-up">
                            {/* Header Card */}
                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-start">
                                <div>
                                    <h1 className="text-5xl font-serif font-bold text-slate-900 mb-2">{result.word}</h1>
                                    <p className="text-xl text-indigo-600 font-mono">{result.phonetic}</p>
                                </div>
                                <div className="flex gap-3">
                                     {getAudioUrl(result.phonetics) && (
                                        <button 
                                            onClick={() => playAudio(getAudioUrl(result.phonetics)!)}
                                            className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                                            title="Play Pronunciation"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                     )}
                                     <button 
                                        onClick={() => toggleFavorite(result.word)}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${favorites.includes(result.word) ? 'bg-yellow-50 text-yellow-500' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        title="Add to Favorites"
                                     >
                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                         </svg>
                                     </button>
                                </div>
                            </div>

                            {/* Meanings */}
                            {result.meanings.map((meaning, idx) => (
                                <div key={idx} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
                                    <div className="flex items-center gap-4 mb-6">
                                        <span className="font-bold italic text-lg text-slate-800">{meaning.partOfSpeech}</span>
                                        <div className="h-px bg-slate-100 flex-1"></div>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-sm text-slate-400 font-bold uppercase mb-3 tracking-wide">Meaning</h4>
                                            <ul className="list-disc list-outside ml-5 space-y-3 marker:text-indigo-500">
                                                {meaning.definitions.map((def, dIdx) => (
                                                    <li key={dIdx} className="text-slate-700 leading-relaxed">
                                                        {def.definition}
                                                        {def.example && (
                                                            <p className="text-slate-500 italic mt-1 text-sm">"{def.example}"</p>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {meaning.synonyms.length > 0 && (
                                            <div>
                                                <h4 className="text-sm text-slate-400 font-bold uppercase mb-3 tracking-wide">Synonyms</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {meaning.synonyms.map(syn => (
                                                        <button 
                                                            key={syn}
                                                            onClick={() => searchWord(syn)}
                                                            className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium transition-colors border border-slate-100 hover:border-indigo-100"
                                                        >
                                                            {syn}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32 opacity-50">
                             <h2 className="text-4xl font-serif font-bold text-slate-300 mb-4">Dictionary</h2>
                             <p className="text-slate-400">Search for definitions, synonyms, and more.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-80 bg-white border-t lg:border-l border-slate-200 overflow-y-auto flex-shrink-0 p-6 space-y-8">
                {/* Word of the Day */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">Word of the Day</h3>
                    <p className="text-2xl font-serif font-bold mb-1">Serendipity</p>
                    <p className="text-sm opacity-90 italic">noun</p>
                    <p className="text-sm mt-3 opacity-90 leading-relaxed">The occurrence and development of events by chance in a happy or beneficial way.</p>
                </div>

                {/* Favorites */}
                {favorites.length > 0 && (
                    <div>
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Favorites</h3>
                         <div className="space-y-2">
                             {favorites.map(word => (
                                 <div key={word} className="flex items-center justify-between group">
                                     <button onClick={() => searchWord(word)} className="text-slate-700 font-medium hover:text-indigo-600">{word}</button>
                                     <button onClick={() => toggleFavorite(word)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                 </div>
                             ))}
                         </div>
                    </div>
                )}

                {/* Recent */}
                {history.length > 0 && (
                    <div>
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Searches</h3>
                         <div className="flex flex-wrap gap-2">
                             {history.map(word => (
                                 <button 
                                    key={word} 
                                    onClick={() => searchWord(word)}
                                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm transition-colors"
                                >
                                    {word}
                                </button>
                             ))}
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Form Builder Tool ---
const FormsBuilderTool: React.FC<{ currentUser: AppUser; theme: Organisation['theme'] }> = ({ currentUser, theme }) => {
    const [view, setView] = useState<'list' | 'edit' | 'preview' | 'responses' | 'analytics'>('list');
    const [forms, setForms] = useState<FormData[]>([]);
    const [currentForm, setCurrentForm] = useState<FormData | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [editorTab, setEditorTab] = useState<'questions' | 'settings'>('questions');
    const [viewFilter, setViewFilter] = useState<'all' | 'manage'>('all');

    // Analytics State
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

    // Changed Path to Organization Level
    const formsPath = `organisations/${currentUser.domain}/modules/TOOLS/forms`;

    useEffect(() => {
        const q = query(collection(db, formsPath), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setForms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormData)));
        });
        return () => unsubscribe();
    }, [formsPath]);

    const ensureFormStructure = (form: FormData): FormData => {
        const safeSettings: FormSettings = {
            isAnonymous: false,
            allowGoBack: true,
            showResults: false,
            limitOneResponse: false,
            timeLimitMinutes: 0,
            scheduleStart: '',
            scheduleEnd: '',
            ...(form.settings || {})
        };
        
        const safeSections = (form.sections && form.sections.length > 0) 
            ? form.sections 
            : [{ id: uuidv4(), title: 'General Information', description: 'Please provide your details.', questions: [] }];

        return {
            ...form,
            settings: safeSettings,
            sections: safeSections
        };
    };

    const createNewForm = () => {
        const newForm: FormData = {
            id: '',
            title: 'Untitled Form',
            description: '',
            isQuiz: false,
            settings: {
                isAnonymous: false,
                allowGoBack: true,
                showResults: false,
                limitOneResponse: false,
                timeLimitMinutes: 0,
                scheduleStart: '',
                scheduleEnd: ''
            },
            sections: [
                {
                    id: uuidv4(),
                    title: 'General Information',
                    description: 'Please provide your details.',
                    questions: [
                        { id: uuidv4(), type: 'short_text', text: 'Full Name', required: true, systemTag: 'name' },
                        { id: uuidv4(), type: 'short_text', text: 'Email Address', required: true, systemTag: 'email' },
                        { id: uuidv4(), type: 'short_text', text: 'Level 1 (Org)', required: false, systemTag: 'l1' },
                        { id: uuidv4(), type: 'short_text', text: 'Level 2', required: false, systemTag: 'l2' },
                        { id: uuidv4(), type: 'short_text', text: 'Level 3', required: false, systemTag: 'l3' },
                    ]
                }
            ],
            createdBy: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setCurrentForm(newForm);
        setEditorTab('questions');
        setView('edit');
    };

    const handleEditForm = (form: FormData) => {
        setCurrentForm(ensureFormStructure(form));
        setEditorTab('questions');
        setView('edit');
    };
    
    const handleViewResponses = (form: FormData) => {
        setCurrentForm(ensureFormStructure(form));
        setView('responses');
    };

    const handleDeleteForm = async (id: string) => {
        if (!id) return;
        if (!window.confirm("Are you sure you want to delete this form?")) return;
        await deleteDoc(doc(db, formsPath, id));
    };

    const handleSaveForm = async () => {
        if (!currentForm) return;
        setLoading(true);
        try {
            const dataToSave = { ...currentForm, updatedAt: new Date() };
            
            if (currentForm.id) {
                // Edit existing
                await updateDoc(doc(db, formsPath, currentForm.id), dataToSave);
            } else {
                // Create new
                dataToSave.createdAt = new Date();
                const docRef = await addDoc(collection(db, formsPath), dataToSave);
                // IMPORTANT: Update state with new ID to prevent duplicates on subsequent saves
                setCurrentForm({ ...dataToSave, id: docRef.id });
            }
            alert("Form saved successfully!");
        } catch (e) {
            console.error(e);
            alert("Error saving form.");
        } finally {
            setLoading(false);
        }
    };

    // --- Form Editor Actions ---
    const addSection = () => {
        if (!currentForm) return;
        setCurrentForm({
            ...currentForm,
            sections: [...currentForm.sections, { id: uuidv4(), title: 'Untitled Section', description: '', questions: [] }]
        });
    };

    const deleteSection = (sectionId: string) => {
        if (!currentForm || currentForm.sections.length <= 1) return;
        // Prevent deleting the first section (General Info)
        if (currentForm.sections[0].id === sectionId) {
            alert("The General Information section cannot be deleted.");
            return;
        }
        if (!window.confirm("Delete section? Questions inside will be removed.")) return;
        setCurrentForm({
            ...currentForm,
            sections: currentForm.sections.filter(s => s.id !== sectionId)
        });
    };

    const updateSection = (sectionId: string, field: string, value: string) => {
        if (!currentForm) return;
        setCurrentForm({
            ...currentForm,
            sections: currentForm.sections.map(s => s.id === sectionId ? { ...s, [field]: value } : s)
        });
    };

    const addQuestion = (sectionId: string) => {
        if (!currentForm) return;
        const newQ: FormQuestion = {
            id: uuidv4(),
            type: 'short_text',
            text: 'Untitled Question',
            required: false,
            options: [{ id: uuidv4(), text: 'Option 1' }]
        };
        setCurrentForm({
            ...currentForm,
            sections: currentForm.sections.map(s => {
                if (s.id === sectionId) {
                    return { ...s, questions: [...s.questions, newQ] };
                }
                return s;
            })
        });
        setActiveQuestionId(newQ.id);
    };

    const updateQuestion = (sectionId: string, questionId: string, updates: Partial<FormQuestion>) => {
        if (!currentForm) return;
        setCurrentForm({
            ...currentForm,
            sections: currentForm.sections.map(s => {
                if (s.id === sectionId) {
                    return {
                        ...s,
                        questions: s.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
                    };
                }
                return s;
            })
        });
    };

    const deleteQuestion = (sectionId: string, questionId: string) => {
         if (!currentForm) return;
         setCurrentForm({
             ...currentForm,
             sections: currentForm.sections.map(s => {
                 if (s.id === sectionId) {
                     return { ...s, questions: s.questions.filter(q => q.id !== questionId) };
                 }
                 return s;
             })
         });
    };

    const copyQuestion = (sectionId: string, question: FormQuestion) => {
         if (!currentForm) return;
         const newQ = { ...question, id: uuidv4() };
         if (newQ.options) {
             newQ.options = newQ.options.map(o => ({ ...o, id: uuidv4() }));
         }
         setCurrentForm({
            ...currentForm,
            sections: currentForm.sections.map(s => {
                if(s.id === sectionId) {
                    return { ...s, questions: [...s.questions, newQ] };
                }
                return s;
            })
         });
    };
    
    const handleMediaUpload = (sectionId: string, questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                updateQuestion(sectionId, questionId, { mediaUrl: ev.target?.result as string });
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    // --- RENDERERS ---
    const renderQuestionEditor = (sectionId: string, q: FormQuestion, isGeneralSection: boolean) => {
        return (
            <div key={q.id} className={`border rounded-lg p-4 bg-white shadow-sm mb-4 transition-all ${activeQuestionId === q.id ? 'border-l-4 border-l-indigo-500 ring-1 ring-indigo-100' : 'border-slate-200'}`} onClick={() => setActiveQuestionId(q.id)}>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1">
                        <Input 
                            id={`question-text-${q.id}`}
                            value={q.text} 
                            onChange={e => updateQuestion(sectionId, q.id, { text: e.target.value })} 
                            placeholder="Question Text" 
                            className="font-medium text-lg bg-gray-50 border-transparent focus:bg-white focus:border-indigo-300 transition-colors"
                            label=""
                        />
                        {q.systemTag && <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded mt-1 inline-block">Auto-fill: {q.systemTag}</span>}
                    </div>
                    <div className="w-full md:w-48">
                         <select 
                            value={q.type} 
                            onChange={e => updateQuestion(sectionId, q.id, { type: e.target.value as QuestionType })}
                            className="w-full p-2 border rounded-md text-sm bg-slate-50"
                        >
                            <option value="short_text">Short Answer</option>
                            <option value="long_text">Paragraph</option>
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="checkboxes">Checkboxes</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="date">Date</option>
                            <option value="time">Time</option>
                        </select>
                    </div>
                </div>

                {/* Media Area */}
                {q.mediaUrl && (
                    <div className="mb-4 relative group inline-block">
                        <img src={q.mediaUrl} alt="Question Media" className="max-h-64 rounded-md object-contain border" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); updateQuestion(sectionId, q.id, { mediaUrl: null }); }}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Options Editor */}
                {['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type) && (
                    <div className="space-y-2 mb-4">
                        {q.options?.map((opt, idx) => (
                            <div key={opt.id} className="flex items-center gap-2">
                                <span className="text-slate-400">
                                    {q.type === 'multiple_choice' && '○'}
                                    {q.type === 'checkboxes' && '☐'}
                                    {q.type === 'dropdown' && `${idx + 1}.`}
                                </span>
                                <input 
                                    type="text" 
                                    value={opt.text} 
                                    onChange={e => {
                                        const newOpts = [...(q.options || [])];
                                        newOpts[idx].text = e.target.value;
                                        updateQuestion(sectionId, q.id, { options: newOpts });
                                    }}
                                    className="flex-1 p-1 border-b border-slate-200 focus:border-indigo-500 outline-none text-sm"
                                    placeholder={`Option ${idx + 1}`}
                                />
                                {currentForm?.isQuiz && !isGeneralSection && (
                                    <label className="flex items-center gap-1 text-xs text-green-600 cursor-pointer">
                                        <input 
                                            type={q.type === 'checkboxes' ? 'checkbox' : 'radio'}
                                            name={`correct-${q.id}`}
                                            checked={opt.isCorrect || false}
                                            onChange={e => {
                                                const newOpts = [...(q.options || [])];
                                                if (q.type !== 'checkboxes') {
                                                    newOpts.forEach(o => o.isCorrect = false);
                                                }
                                                newOpts[idx].isCorrect = e.target.checked;
                                                updateQuestion(sectionId, q.id, { options: newOpts });
                                            }}
                                        />
                                        Correct
                                    </label>
                                )}
                                <button 
                                    onClick={() => {
                                        const newOpts = q.options?.filter((_, i) => i !== idx);
                                        updateQuestion(sectionId, q.id, { options: newOpts });
                                    }}
                                    className="text-slate-400 hover:text-red-500"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => updateQuestion(sectionId, q.id, { options: [...(q.options || []), { id: uuidv4(), text: `Option ${(q.options?.length || 0) + 1}` }] })}
                            className="text-sm text-blue-600 hover:underline ml-6"
                        >
                            Add Option
                        </button>
                    </div>
                )}
                
                {/* Text Preview */}
                {['short_text', 'long_text', 'date', 'time'].includes(q.type) && (
                     <div className="border-b border-dotted border-slate-300 p-2 mb-4 text-slate-400 text-sm italic">
                         {q.type === 'short_text' && 'Short answer text'}
                         {q.type === 'long_text' && 'Long answer text'}
                         {q.type === 'date' && 'Month, day, year'}
                         {q.type === 'time' && 'Time'}
                     </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        {currentForm?.isQuiz && !isGeneralSection && (
                             <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-600">Points:</span>
                                <input 
                                    type="number" 
                                    value={q.points || 0} 
                                    onChange={e => updateQuestion(sectionId, q.id, { points: parseInt(e.target.value) || 0 })}
                                    className="w-16 p-1 border rounded text-center"
                                />
                             </div>
                        )}
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={q.required} 
                                onChange={e => updateQuestion(sectionId, q.id, { required: e.target.checked })}
                            />
                            Required
                        </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <label className="cursor-pointer p-2 hover:bg-slate-100 rounded text-slate-500" title="Add Image">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => handleMediaUpload(sectionId, q.id, e)} />
                         </label>
                         <button onClick={() => copyQuestion(sectionId, q)} className="p-2 hover:bg-slate-100 rounded text-slate-500" title="Duplicate">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a1 1 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         </button>
                         <button onClick={() => deleteQuestion(sectionId, q.id)} className="p-2 hover:bg-slate-100 rounded text-red-500" title="Delete">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- SUB-COMPONENTS ---
    const FormAnalytics: React.FC = () => {
        useEffect(() => {
            if (!currentForm || !currentForm.id) return;
            setAnalyticsLoading(true);
            const q = query(collection(db, `${formsPath}/${currentForm.id}/submissions`), orderBy('submittedAt', 'desc'));
            const unsub = onSnapshot(q, (snapshot) => {
                setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormSubmission)));
                setAnalyticsLoading(false);
            });
            return () => unsub();
        }, [currentForm?.id]);

        const metrics = useMemo(() => {
            const total = submissions.length;
            const avgScore = total > 0 ? (submissions.reduce((acc, s) => acc + (s.score || 0), 0) / total).toFixed(1) : '0';
            const maxPossible = submissions[0]?.maxScore || 0;
            return { total, avgScore, maxPossible };
        }, [submissions]);

        if (analyticsLoading) return <div className="p-8 text-center">Loading results...</div>;

        if (selectedSubmission) {
             return (
                <div className="bg-white p-6 rounded-lg shadow-sm max-w-4xl mx-auto mt-4">
                    <button onClick={() => setSelectedSubmission(null)} className="mb-4 text-blue-600 hover:underline">&larr; Back to list</button>
                    <h3 className="text-xl font-bold mb-2">Submission by {selectedSubmission.respondentName || 'Anonymous'}</h3>
                    <p className="text-sm text-slate-500 mb-4">Submitted: {selectedSubmission.submittedAt?.toDate().toLocaleString()} | Score: {selectedSubmission.score} / {selectedSubmission.maxScore}</p>
                    
                    <div className="space-y-6">
                        {currentForm?.sections.map((sec, sIdx) => (
                            <div key={sec.id} className="border rounded-md p-4">
                                <h4 className="font-bold text-slate-700 mb-3">{sec.title}</h4>
                                {sec.questions.map(q => {
                                    const answer = selectedSubmission.answers[q.id];
                                    return (
                                        <div key={q.id} className="mb-4 last:mb-0">
                                            <p className="text-sm font-medium text-slate-900 mb-1">{q.text}</p>
                                            <div className="p-2 bg-slate-50 rounded text-slate-700 text-sm">
                                                {Array.isArray(answer) ? answer.join(', ') : String(answer || '-')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
             );
        }

        return (
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <p className="text-slate-500 text-sm">Total Responses</p>
                        <p className="text-3xl font-bold text-slate-800">{metrics.total}</p>
                    </div>
                    {currentForm?.isQuiz && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <p className="text-slate-500 text-sm">Average Score</p>
                            <p className="text-3xl font-bold text-slate-800">{metrics.avgScore} <span className="text-sm font-normal text-slate-400">/ {metrics.maxPossible}</span></p>
                        </div>
                    )}
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <p className="text-slate-500 text-sm">Status</p>
                        <p className="text-xl font-bold text-slate-800">{submissions.length > 0 ? 'Active' : 'No Data'}</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Respondent</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                {currentForm?.isQuiz && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Score</th>}
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time Taken</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {submissions.map(sub => (
                                <tr key={sub.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedSubmission(sub)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{sub.respondentName || 'Anonymous'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{sub.submittedAt?.toDate().toLocaleString()}</td>
                                    {currentForm?.isQuiz && <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-bold">{sub.score} / {sub.maxScore}</td>}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{Math.floor(sub.timeTakenSeconds / 60)}m {sub.timeTakenSeconds % 60}s</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">View</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const FormResponder: React.FC = () => {
        const [answers, setAnswers] = useState<Record<string, any>>({});
        const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
        const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
        const [startTime] = useState(new Date());
        const [submitting, setSubmitting] = useState(false);
        const [submitted, setSubmitted] = useState(false);
        const [accessError, setAccessError] = useState('');

        useEffect(() => {
            // Schedule Checks
            if (currentForm?.settings) {
                const now = new Date();
                if (currentForm.settings.scheduleStart && now < new Date(currentForm.settings.scheduleStart)) {
                    setAccessError(`This form is scheduled to open on ${new Date(currentForm.settings.scheduleStart).toLocaleString()}`);
                    return;
                }
                if (currentForm.settings.scheduleEnd && now > new Date(currentForm.settings.scheduleEnd)) {
                    setAccessError("This form has expired and is no longer accepting submissions.");
                    return;
                }
            }

            // Auto-fill logic for General Section
            if (!currentForm?.settings?.isAnonymous && currentForm?.sections?.[0]) {
                const genSection = currentForm.sections[0];
                const preFills: Record<string, any> = {};
                genSection.questions.forEach(q => {
                    if (q.systemTag === 'name') preFills[q.id] = `${currentUser.firstName} ${currentUser.lastName}`;
                    if (q.systemTag === 'email') preFills[q.id] = currentUser.email;
                    if (q.systemTag === 'l1') preFills[q.id] = currentUser.allocationLevel1Name;
                    if (q.systemTag === 'l2') preFills[q.id] = currentUser.allocationLevel2Name;
                    if (q.systemTag === 'l3') preFills[q.id] = currentUser.allocationLevel3Name;
                });
                setAnswers(prev => ({ ...prev, ...preFills }));
            }

            // Timer Logic
            if (currentForm?.settings?.timeLimitMinutes) {
                setTimeRemaining(currentForm.settings.timeLimitMinutes * 60);
                const interval = setInterval(() => {
                    setTimeRemaining(prev => {
                        if (prev === null || prev <= 0) {
                            clearInterval(interval);
                            handleSubmit(); // Auto submit
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(interval);
            }
        }, []);

        const handleAnswerChange = (questionId: string, value: any) => {
            setAnswers(prev => ({ ...prev, [questionId]: value }));
        };

        const calculateScore = () => {
            let score = 0;
            let maxScore = 0;
            currentForm?.sections.forEach(section => {
                section.questions.forEach(q => {
                    if (currentForm.isQuiz && q.points) maxScore += q.points;
                    if (currentForm.isQuiz && q.points && q.options) {
                        const answer = answers[q.id];
                        if (q.type === 'multiple_choice' || q.type === 'dropdown') {
                             const selectedOpt = q.options.find(o => o.text === answer);
                             if (selectedOpt?.isCorrect) score += q.points;
                        }
                         if (q.type === 'checkboxes' && Array.isArray(answer)) {
                             // Exact match required for checkboxes
                             const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.text).sort();
                             const userOptions = [...answer].sort();
                             if (JSON.stringify(correctOptions) === JSON.stringify(userOptions)) score += q.points;
                         }
                    }
                });
            });
            return { score, maxScore };
        };

        const handleSubmit = async () => {
            if (submitting || submitted) return;
            
            let missing = false;
            currentForm?.sections.forEach(s => {
                s.questions.forEach(q => {
                     if (q.required && (!answers[q.id] || (Array.isArray(answers[q.id]) && answers[q.id].length === 0))) missing = true;
                });
            });

            if (missing) {
                alert("Please fill in all required fields.");
                return;
            }

            if (!currentForm || !currentForm.id) {
                alert("Preview Mode: Response cannot be saved because the form has not been created yet.");
                return;
            }

            setSubmitting(true);
            try {
                const { score, maxScore } = calculateScore();
                const submissionData: FormSubmission = {
                    id: uuidv4(),
                    formId: currentForm!.id,
                    respondentUid: currentForm?.settings?.isAnonymous ? undefined : currentUser.uid,
                    respondentName: currentForm?.settings?.isAnonymous ? 'Anonymous' : `${currentUser.firstName} ${currentUser.lastName}`,
                    answers,
                    score,
                    maxScore,
                    submittedAt: new Date(),
                    timeTakenSeconds: Math.floor((new Date().getTime() - startTime.getTime()) / 1000)
                };
                
                await addDoc(collection(db, `${formsPath}/${currentForm!.id}/submissions`), submissionData);
                setSubmitted(true);
            } catch (e) {
                console.error(e);
                alert("Submission failed.");
            } finally {
                setSubmitting(false);
            }
        };
        
        if (accessError) {
            return (
                <div className="flex items-center justify-center h-full p-8 text-center">
                    <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
                        <h3 className="text-xl font-bold text-red-600 mb-2">Form Unavailable</h3>
                        <p className="text-slate-600 mb-4">{accessError}</p>
                        <Button onClick={() => setView('list')} variant="secondary" className="!w-auto">Back</Button>
                    </div>
                </div>
            );
        }

        if (submitted) {
            return (
                <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Response Recorded</h2>
                    <p className="text-slate-600 mb-6">Thank you for completing the form.</p>
                    
                    {currentForm?.settings?.showResults && currentForm.isQuiz && (
                        <div className="bg-slate-50 p-4 rounded-lg inline-block">
                            <p className="text-sm text-slate-500 uppercase tracking-wider">Your Score</p>
                            <p className="text-3xl font-bold text-indigo-600 mt-1">
                                {calculateScore().score} / {calculateScore().maxScore}
                            </p>
                        </div>
                    )}
                    
                    <div className="mt-8">
                         <Button onClick={() => setView('list')} variant="secondary" className="!w-auto">Back to Dashboard</Button>
                    </div>
                </div>
            );
        }

        const activeSection = currentForm?.sections[currentSectionIndex];
        if (!activeSection) return <div>Error</div>;
        
        const isFirstSection = currentSectionIndex === 0;
        const isLastSection = currentSectionIndex === (currentForm?.sections.length || 0) - 1;
        const isGeneralInfo = currentSectionIndex === 0;

        return (
            <div className="h-full bg-slate-100 overflow-y-auto pb-20">
                {/* Header */}
                <div className="bg-white border-b shadow-sm sticky top-0 z-30">
                    <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{currentForm?.title}</h1>
                            {timeRemaining !== null && (
                                <div className={`text-sm font-mono font-bold mt-1 ${timeRemaining < 60 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`}>
                                    Time Left: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-slate-500">
                             Section {currentSectionIndex + 1} of {currentForm?.sections.length}
                        </div>
                    </div>
                    <div className="h-1 bg-slate-200 w-full">
                         <div 
                            className="h-full bg-indigo-600 transition-all duration-500" 
                            style={{width: `${((currentSectionIndex + 1) / (currentForm?.sections.length || 1)) * 100}%`}}
                        ></div>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto p-4 space-y-6 mt-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{activeSection.title}</h2>
                        {activeSection.description && <p className="text-slate-600 text-sm">{activeSection.description}</p>}
                    </div>

                    {activeSection.questions.map(q => {
                        // Determine read-only state for pre-filled general info
                        const isReadOnly = !currentForm?.settings?.isAnonymous && isGeneralInfo && q.systemTag;
                        
                        return (
                        <div key={q.id} className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 bg-slate-50' : ''}`}>
                            <div className="mb-4">
                                <p className="text-base font-medium text-slate-900">
                                    {q.text} {q.required && <span className="text-red-500">*</span>}
                                </p>
                            </div>
                            
                            {q.mediaUrl && <img src={q.mediaUrl} className="max-h-64 rounded-lg mb-4 border" alt="media" />}

                            {q.type === 'short_text' && (
                                <input 
                                    id={`q-${q.id}`}
                                    type="text" 
                                    value={answers[q.id] || ''} 
                                    onChange={e => handleAnswerChange(q.id, e.target.value)} 
                                    className="w-full border-b border-slate-300 focus:border-indigo-600 outline-none py-2 text-slate-700 disabled:bg-transparent disabled:text-slate-500"
                                    placeholder="Your answer"
                                    disabled={!!isReadOnly}
                                />
                            )}
                             {q.type === 'long_text' && (
                                <textarea 
                                    id={`q-${q.id}`}
                                    value={answers[q.id] || ''} 
                                    onChange={e => handleAnswerChange(q.id, e.target.value)} 
                                    className="w-full border-b border-slate-300 focus:border-indigo-600 outline-none py-2 text-slate-700 resize-none disabled:bg-transparent" 
                                    placeholder="Your answer" 
                                    rows={2}
                                    disabled={!!isReadOnly}
                                />
                            )}
                             {q.type === 'multiple_choice' && (
                                <div className="space-y-3">
                                    {q.options?.map(opt => (
                                        <label key={opt.id} className="flex items-center space-x-3 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name={q.id} 
                                                checked={answers[q.id] === opt.text}
                                                onChange={() => handleAnswerChange(q.id, opt.text)}
                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" 
                                            />
                                            <span className="text-slate-700">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                             {q.type === 'checkboxes' && (
                                <div className="space-y-3">
                                    {q.options?.map(opt => (
                                        <label key={opt.id} className="flex items-center space-x-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={(answers[q.id] || []).includes(opt.text)}
                                                onChange={(e) => {
                                                    const current = answers[q.id] || [];
                                                    if (e.target.checked) handleAnswerChange(q.id, [...current, opt.text]);
                                                    else handleAnswerChange(q.id, current.filter((v: string) => v !== opt.text));
                                                }}
                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" 
                                            />
                                            <span className="text-slate-700">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                             {q.type === 'dropdown' && (
                                <select 
                                    id={`q-${q.id}`}
                                    value={answers[q.id] || ''} 
                                    onChange={e => handleAnswerChange(q.id, e.target.value)} 
                                    className="w-full border border-slate-300 rounded-md p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={!!isReadOnly}
                                >
                                    <option value="">Choose</option>
                                    {q.options?.map(opt => <option key={opt.id} value={opt.text}>{opt.text}</option>)}
                                </select>
                            )}
                             {(q.type === 'date' || q.type === 'time') && (
                                <input 
                                    id={`q-${q.id}`}
                                    type={q.type} 
                                    value={answers[q.id] || ''} 
                                    onChange={e => handleAnswerChange(q.id, e.target.value)} 
                                    className="border border-slate-300 rounded-md p-2 text-slate-700 focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={!!isReadOnly}
                                />
                            )}
                        </div>
                    )})}

                    <div className="flex justify-between pt-6">
                         {currentForm?.settings?.allowGoBack && !isFirstSection ? (
                             <button 
                                onClick={() => setCurrentSectionIndex(p => p - 1)}
                                className="text-indigo-600 font-medium px-6 py-2 rounded hover:bg-indigo-50 transition-colors"
                            >
                                Back
                            </button>
                         ) : <div></div>}
                         
                         {isLastSection ? (
                             <button 
                                onClick={handleSubmit} 
                                disabled={submitting}
                                className="bg-green-600 text-white font-bold px-8 py-2 rounded-lg shadow-lg hover:bg-green-700 transition-transform active:scale-95 disabled:opacity-70"
                            >
                                {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                         ) : (
                            <button 
                                onClick={() => {
                                    // Basic required validation for current section
                                    const missing = activeSection.questions.some(q => q.required && (!answers[q.id] || (Array.isArray(answers[q.id]) && answers[q.id].length === 0)));
                                    if (missing) alert("Please fill in required fields.");
                                    else setCurrentSectionIndex(p => p + 1);
                                }} 
                                className="bg-indigo-600 text-white font-bold px-8 py-2 rounded-lg shadow-lg hover:bg-indigo-700 transition-transform active:scale-95"
                            >
                                Next
                            </button>
                         )}
                    </div>
                </div>
            </div>
        );
    };

    // --- MAIN RENDER ---
    if (view === 'list') {
        return (
            <div className="p-8 h-full overflow-y-auto bg-slate-50">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Forms</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setViewFilter('all')} className={`px-4 py-2 rounded-md text-sm font-medium ${viewFilter === 'all' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}>Available Forms</button>
                            <button onClick={() => setViewFilter('manage')} className={`px-4 py-2 rounded-md text-sm font-medium ${viewFilter === 'manage' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}>Manage Forms</button>
                        </div>
                    </div>
                    
                    {viewFilter === 'manage' && (
                        <div className="mb-8 p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-indigo-900">Create New Form</h3>
                                <p className="text-xs text-indigo-700">Design surveys, quizzes, and data collection forms for your organization.</p>
                            </div>
                            <Button onClick={createNewForm} className="!w-auto">Create Form</Button>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {forms.map(form => {
                            // Logic to decide if form should be shown based on filter
                            // 'manage' shows forms I created or if I'm admin (simplified: everyone sees all in manage for now, typically add permissions check)
                            if (viewFilter === 'manage') {
                                return (
                                    <div key={form.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-slate-800 truncate flex-1" title={form.title}>{form.title || 'Untitled Form'}</h3>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); handleEditForm(form); }} className="text-slate-400 hover:text-indigo-600 p-1" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteForm(form.id); }} className="text-slate-400 hover:text-red-600 p-1" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 flex-1 line-clamp-2 mb-4">{form.description || 'No description'}</p>
                                        <div className="mt-auto pt-4 border-t border-slate-100">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleViewResponses(form); }} 
                                                className="w-full text-center text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-2 rounded hover:bg-indigo-100"
                                            >
                                                View Responses
                                            </button>
                                        </div>
                                    </div>
                                );
                            } else {
                                // 'all' view - shows forms available to fill
                                // Filter by schedule if needed, but showing expired forms as disabled is often better UX.
                                return (
                                    <div key={form.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-green-400 transition-all cursor-pointer flex flex-col h-full" onClick={() => { setCurrentForm(ensureFormStructure(form)); setView('preview'); }}>
                                        <h3 className="font-bold text-lg text-slate-800 mb-1">{form.title}</h3>
                                        <p className="text-sm text-slate-500 line-clamp-3 flex-1">{form.description}</p>
                                        <div className="mt-4 flex justify-end">
                                             <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                                                Fill Form &rarr;
                                             </span>
                                        </div>
                                    </div>
                                )
                            }
                        })}
                    </div>
                    {forms.length === 0 && <div className="text-center py-12 text-slate-400">No forms found.</div>}
                </div>
            </div>
        );
    }

    if (view === 'edit' && currentForm) {
        return (
            <div className="h-full flex flex-col bg-slate-100">
                {/* Toolbar */}
                <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('list')} className="text-slate-500 hover:text-slate-800">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <input 
                            value={currentForm.title} 
                            onChange={e => setCurrentForm({...currentForm, title: e.target.value})} 
                            className="font-bold text-xl text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-64 md:w-96"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="bg-slate-100 rounded p-1 flex text-xs font-medium mr-4">
                            <button onClick={() => setEditorTab('questions')} className={`px-3 py-1 rounded ${editorTab === 'questions' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Questions</button>
                            <button onClick={() => setEditorTab('settings')} className={`px-3 py-1 rounded ${editorTab === 'settings' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Settings</button>
                        </div>
                        <Button onClick={handleSaveForm} isLoading={loading} className="!w-auto !py-1.5 !px-4">Save</Button>
                    </div>
                </div>

                {/* Editor Canvas */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Header Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="h-2 bg-indigo-600 w-full"></div>
                            <div className="p-6">
                                <Input 
                                    id="formTitle"
                                    value={currentForm.title} 
                                    onChange={e => setCurrentForm({...currentForm, title: e.target.value})} 
                                    className="text-3xl font-bold border-none px-0 py-1 focus:ring-0 placeholder-slate-300" 
                                    placeholder="Form Title"
                                    label=""
                                />
                                <textarea 
                                    value={currentForm.description} 
                                    onChange={e => setCurrentForm({...currentForm, description: e.target.value})} 
                                    className="w-full mt-2 text-sm text-slate-600 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none resize-none bg-transparent" 
                                    placeholder="Form description"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {editorTab === 'questions' ? (
                             <>
                            {/* Sections Stream */}
                            {currentForm.sections.map((section, sIdx) => (
                                <div key={section.id} className="space-y-4">
                                    {/* Section Header */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative group">
                                        <div className="absolute top-0 left-0 bg-indigo-600 text-white text-xs px-2 py-1 rounded-br-lg font-bold">
                                            {sIdx === 0 ? 'General Info (Locked)' : `Section ${sIdx}`}
                                        </div>
                                        <div className="mt-4">
                                            <Input 
                                                id={`section-title-${section.id}`}
                                                value={section.title} 
                                                onChange={e => updateSection(section.id, 'title', e.target.value)} 
                                                className="font-bold text-xl border-none px-0 focus:ring-0" 
                                                placeholder="Section Title"
                                                label=""
                                                disabled={sIdx === 0} // Lock General Info Title
                                            />
                                            <input 
                                                value={section.description || ''} 
                                                onChange={e => updateSection(section.id, 'description', e.target.value)} 
                                                className="w-full text-sm text-slate-500 border-none px-0 focus:ring-0" 
                                                placeholder="Description (optional)"
                                            />
                                        </div>
                                        {sIdx > 0 && (
                                            <button onClick={() => deleteSection(section.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Questions */}
                                    {section.questions.map(q => renderQuestionEditor(section.id, q, sIdx === 0))}
                                    
                                    <div className="flex justify-center">
                                        <button onClick={() => addQuestion(section.id)} className="bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 transition-all text-sm font-medium">
                                            <span className="text-lg leading-none">+</span> Add Question
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                            <div className="pt-8 pb-20 flex justify-center">
                                <button onClick={addSection} className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    Add New Section
                                </button>
                            </div>
                            </>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                                <h3 className="text-lg font-bold text-slate-800">Form Settings</h3>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Quiz Mode</p>
                                            <p className="text-xs text-slate-500">Enable points and scoring for questions</p>
                                        </div>
                                        <input type="checkbox" checked={currentForm.isQuiz} onChange={e => setCurrentForm({...currentForm, isQuiz: e.target.checked})} className="toggle-checkbox h-5 w-5 text-indigo-600 rounded" />
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Anonymous Responses</p>
                                            <p className="text-xs text-slate-500">Do not collect user details automatically (Disables auto-fill)</p>
                                        </div>
                                        <input type="checkbox" checked={currentForm.settings?.isAnonymous || false} onChange={e => setCurrentForm({...currentForm, settings: {...(currentForm.settings || {}), isAnonymous: e.target.checked} as FormSettings})} className="h-5 w-5 text-indigo-600 rounded" />
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Show Results</p>
                                            <p className="text-xs text-slate-500">Show score summary to user after submission</p>
                                        </div>
                                        <input type="checkbox" checked={currentForm.settings?.showResults || false} onChange={e => setCurrentForm({...currentForm, settings: {...(currentForm.settings || {}), showResults: e.target.checked} as FormSettings})} className="h-5 w-5 text-indigo-600 rounded" />
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Limit to One Response</p>
                                            <p className="text-xs text-slate-500">Respondents can only submit once (Requires sign-in)</p>
                                        </div>
                                        <input type="checkbox" checked={!!(currentForm.settings?.limitOneResponse || false)} onChange={e => setCurrentForm({...currentForm, settings: {...(currentForm.settings || {}), limitOneResponse: e.target.checked} as FormSettings})} className="h-5 w-5 text-indigo-600 rounded" />
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-lg">
                                         <p className="font-medium text-sm mb-2">Time Limit (Minutes)</p>
                                         <Input 
                                            id="timeLimit"
                                            type="number" 
                                            value={currentForm.settings?.timeLimitMinutes || ''} 
                                            onChange={e => setCurrentForm({...currentForm, settings: {...(currentForm.settings || {}), timeLimitMinutes: Number(e.target.value)} as FormSettings})} 
                                            placeholder="0 for no limit"
                                            label=""
                                            containerClassName="mb-0"
                                         />
                                    </div>
                                    
                                     <div className="p-3 bg-slate-50 rounded-lg">
                                         <p className="font-medium text-sm mb-2">Schedule</p>
                                         <div className="grid grid-cols-2 gap-4">
                                             <Input type="datetime-local" label="Start" value={currentForm.settings?.scheduleStart || ''} onChange={e => setCurrentForm({...currentForm, settings: {...(currentForm.settings || {}), scheduleStart: e.target.value} as FormSettings})} id="scheduleStart"/>
                                             <Input type="datetime-local" label="End" value={currentForm.settings?.scheduleEnd || ''} onChange={e => setCurrentForm({...currentForm, settings: {...(currentForm.settings || {}), scheduleEnd: e.target.value} as FormSettings})} id="scheduleEnd"/>
                                         </div>
                                     </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'preview') {
        return <FormResponder />;
    }

    if (view === 'responses') {
        return <FormAnalytics />;
    }

    return null;
};

// --- Category Manager Component ---
const CategoryManager: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    categories: QRCategory[]; 
    onSave: (cats: QRCategory[]) => void; 
}> = ({ isOpen, onClose, categories, onSave }) => {
    const [localCategories, setLocalCategories] = useState<QRCategory[]>(categories);
    const [selectedCatIdx, setSelectedCatIdx] = useState<number | null>(null);

    const [newCatName, setNewCatName] = useState('');
    const [newSubName, setNewSubName] = useState('');

    useEffect(() => {
        setLocalCategories(categories);
    }, [categories, isOpen]);

    const addCategory = () => {
        if (!newCatName.trim()) return;
        setLocalCategories([...localCategories, { name: newCatName.trim(), subCategories: [] }]);
        setNewCatName('');
    };

    const deleteCategory = (idx: number) => {
        const updated = localCategories.filter((_, i) => i !== idx);
        setLocalCategories(updated);
        if (selectedCatIdx === idx) setSelectedCatIdx(null);
    };

    const addSubCategory = () => {
        if (selectedCatIdx === null || !newSubName.trim()) return;
        const updated = [...localCategories];
        updated[selectedCatIdx].subCategories.push({ name: newSubName.trim() });
        setLocalCategories(updated);
        setNewSubName('');
    };

    const deleteSubCategory = (subIdx: number) => {
        if (selectedCatIdx === null) return;
        const updated = [...localCategories];
        updated[selectedCatIdx].subCategories = updated[selectedCatIdx].subCategories.filter((_, i) => i !== subIdx);
        setLocalCategories(updated);
    };

    const handleSave = () => {
        onSave(localCategories);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Categories" size="2xl">
            <div className="grid grid-cols-2 gap-4 h-96">
                {/* Categories Column */}
                <div className="border rounded p-2 flex flex-col">
                    <h4 className="font-bold text-sm mb-2 text-center bg-slate-100 p-1 rounded">Categories</h4>
                    <div className="flex-1 overflow-y-auto space-y-1">
                        {localCategories.map((cat, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedCatIdx(idx)}
                                className={`p-2 text-sm flex justify-between items-center cursor-pointer rounded ${selectedCatIdx === idx ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-50'}`}
                            >
                                <span className="truncate">{cat.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); deleteCategory(idx); }} className="text-red-500 hover:text-red-700 font-bold px-1">&times;</button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-1">
                        <input className="border rounded p-1 text-xs flex-1" placeholder="New Category" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                        <button onClick={addCategory} className="bg-blue-600 text-white px-2 rounded text-xs">+</button>
                    </div>
                </div>

                {/* Sub-Categories Column */}
                <div className="border rounded p-2 flex flex-col">
                    <h4 className="font-bold text-sm mb-2 text-center bg-slate-100 p-1 rounded">Sub-Categories</h4>
                    <div className="flex-1 overflow-y-auto space-y-1">
                        {selectedCatIdx !== null && localCategories[selectedCatIdx] ? (
                            localCategories[selectedCatIdx].subCategories.map((sub, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-2 text-sm flex justify-between items-center hover:bg-slate-50 rounded"
                                >
                                    <span className="truncate">{sub.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); deleteSubCategory(idx); }} className="text-red-500 hover:text-red-700 font-bold px-1">&times;</button>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 text-center mt-4">Select a Category</p>
                        )}
                    </div>
                    <div className="mt-2 flex gap-1">
                        <input className="border rounded p-1 text-xs flex-1" placeholder="New Sub-Category" value={newSubName} onChange={e => setNewSubName(e.target.value)} disabled={selectedCatIdx === null} />
                        <button onClick={addSubCategory} className="bg-blue-600 text-white px-2 rounded text-xs" disabled={selectedCatIdx === null}>+</button>
                    </div>
                </div>
            </div>
            <div className="flex justify-end pt-4 border-t mt-4 gap-2">
                <Button onClick={onClose} variant="secondary">Cancel</Button>
                <Button onClick={handleSave}>Save Taxonomy</Button>
            </div>
        </Modal>
    );
};

// --- Config Sections ---
const navSections = [
    { id: 'content', label: 'Content & Text', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { id: 'colors', label: 'Colors & Theme', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg> },
    { id: 'logo', label: 'Logo', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'eyes', label: 'Eyes & Body', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
    { id: 'frame', label: 'Frame & Border', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> },
];

const fontOptions = [
    'Inter, sans-serif',
    'Arial, sans-serif',
    'Verdana, sans-serif',
    'Helvetica, sans-serif',
    'Tahoma, sans-serif',
    'Trebuchet MS, sans-serif',
    'Times New Roman, serif',
    'Georgia, serif',
    'Garamond, serif',
    'Courier New, monospace',
    'Brush Script MT, cursive',
    'Impact, fantasy',
    'Comic Sans MS, cursive'
];

const QRGeneratorTool: React.FC<{ theme: Organisation['theme']; currentUser: AppUser }> = ({ theme, currentUser }) => {
    
    const [activeSection, setActiveSection] = useState('content');
    const [activeQrTab, setActiveQrTab] = useState<'editor' | 'library'>('editor');
    
    const [config, setConfig] = useState<QRConfig>({
        url: 'https://manufusion.com',
        label: 'SCAN ME',
        bgColor: '#ffffff',
        qrColor: '#000000',
        useGradient: false,
        gradientType: 'linear',
        gradientStart: '#4F46E5',
        gradientEnd: '#F97316',
        eyeColor: '#000000',
        eyeShape: 'square',
        eyeSize: 1,
        frameStyle: 'box',
        frameCornerStyle: 'square',
        frameCornerRadius: 40,
        borderColor: '#000000',
        borderWidth: 5,
        borderPadding: 20,
        outerMargin: 25, 
        labelPosition: 'bottom',
        labelColor: '#ffffff',
        labelBgColor: '#000000',
        labelShape: 'pill',
        fontFace: 'Inter, sans-serif',
        fontStyle: 'bold',
        fontSize: 32,
        logoData: null,
        logoSize: 0.2,
        logoBgColor: '#ffffff',
        logoShape: 'square'
    });

    // Management State
    const [templates, setTemplates] = useState<QRTemplate[]>([]);
    const [savedQRs, setSavedQRs] = useState<SavedQR[]>([]);
    const [categories, setCategories] = useState<QRCategory[]>([]);
    
    // Filter State
    const [filterTemplateId, setFilterTemplateId] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSubCategory, setFilterSubCategory] = useState('');
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isSaveQRModalOpen, setIsSaveQRModalOpen] = useState(false);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    
    // Download State
    const [downloadOptionsOpen, setDownloadOptionsOpen] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpeg'>('png');
    const [downloadScale, setDownloadScale] = useState<number>(1);
    const [downloadTransparent, setDownloadTransparent] = useState(false);

    // Preview Modal State
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    
    // Temp state for modals
    const [templateForm, setTemplateForm] = useState({ id: '', name: '', notes: '' });
    const [saveQRForm, setSaveQRForm] = useState({ name: '', category: '', subCategory: '' });
    const [loading, setLoading] = useState(false);
    const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(undefined);
    const [currentSavedQRId, setCurrentSavedQRId] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Helpers ---
    const updateConfig = (field: keyof QRConfig, value: any) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                updateConfig('logoData', ev.target?.result as string);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const removeLogo = () => {
        updateConfig('logoData', null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Database Operations ---
    const templatesPath = `users/${currentUser.uid}/qr_templates`;
    const savedQRsPath = `users/${currentUser.uid}/saved_qrs`;
    const settingsPath = `users/${currentUser.uid}/settings/am_qr_categories`;

    const fetchTemplates = async () => {
        try {
            const snap = await db.collection(templatesPath).orderBy('name').get();
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as QRTemplate)));
        } catch (e) { console.error("Error fetching templates", e); }
    };

    const fetchCategories = async () => {
        try {
            const snap = await db.doc(settingsPath).get();
            if (snap.exists) {
                setCategories((snap.data() as QRCategorySettings).categories || []);
            }
        } catch (e) { console.error("Error fetching categories", e); }
    };

    useEffect(() => {
        if (currentUser.uid) {
            fetchTemplates();
            fetchCategories();

            // Live listener for Saved QRs (List)
            const q = db.collection(savedQRsPath).orderBy('createdAt', 'desc');
            const unsubscribeQRs = q.onSnapshot((snap) => {
                 setSavedQRs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQR)));
            }, (error) => {
                console.error("Error listening to saved QRs:", error);
            });
            
            return () => { unsubscribeQRs(); };
        }
    }, [currentUser.uid]);

    const handleSaveCategories = async (newCategories: QRCategory[]) => {
        setCategories(newCategories);
        await db.doc(settingsPath).set({ categories: newCategories });
    };

    const handleSaveTemplate = async () => {
        if (!templateForm.name) return;
        setLoading(true);
        try {
            // Ensure we are save the config but EXCLUDE specific content data
            const configToSave = { 
                ...config,
                url: '',    // Do not save URL in template
                label: ''   // Do not save Label in template
            }; 
            
            if (templateForm.id) {
                // Edit existing
                await db.collection(templatesPath).doc(templateForm.id).update({
                    name: templateForm.name,
                    notes: templateForm.notes,
                    config: configToSave
                });
            } else {
                // Create new
                await db.collection(templatesPath).add({
                    name: templateForm.name,
                    notes: templateForm.notes,
                    config: configToSave
                });
            }
            await fetchTemplates();
            setIsTemplateModalOpen(false);
            setTemplateForm({ id: '', name: '', notes: '' });
        } catch (e) {
            console.error(e);
            alert("Failed to save template");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQR = async () => {
        if (!saveQRForm.name) return;
        setLoading(true);
        try {
            const docRef = await db.collection(savedQRsPath).add({
                ...saveQRForm,
                config: config, // Saves current state including URL
                sourceTemplateId: currentTemplateId || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            setCurrentSavedQRId(docRef.id);
            // List updates automatically via onSnapshot
            setIsSaveQRModalOpen(false);
            setSaveQRForm({ name: '', category: '', subCategory: '' });
        } catch (e) {
            console.error(e);
            alert("Failed to save QR Code");
        } finally {
            setLoading(false);
        }
    };
    
    const handleUpdateSavedQR = async () => {
        if (!currentSavedQRId) return;
        setLoading(true);
        try {
             await db.collection(savedQRsPath).doc(currentSavedQRId).update({
                 config: config // Update with current editor state
             });
             // List updates automatically via onSnapshot
             alert("QR Code updated successfully.");
        } catch (e) {
            console.error("Error updating QR:", e);
            alert("Failed to update QR Code.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteTemplate = async () => {
        if (!templateForm.id) return;
        // Check dependencies
        const linkedQRs = savedQRs.filter(q => q.sourceTemplateId === templateForm.id);
        
        if (linkedQRs.length > 0) {
            alert(`Cannot delete template. There are ${linkedQRs.length} QR codes linked to this template. Please delete them first.`);
            return;
        }

        if(!window.confirm("Delete this template? This action cannot be undone.")) return;
        
        setLoading(true);
        try {
            await db.collection(templatesPath).doc(templateForm.id).delete();
            setTemplates(prev => prev.filter(t => t.id !== templateForm.id));
            setIsTemplateModalOpen(false);
            setTemplateForm({ id: '', name: '', notes: '' });
        } catch (e: any) {
            console.error("Delete Template Error:", e);
            alert(`Failed to delete template: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSavedQR = async (id: string) => {
        if(!window.confirm("Delete this saved QR?")) return;
        try {
            await db.collection(savedQRsPath).doc(id).delete();
            // List updates automatically via onSnapshot
            if (currentSavedQRId === id) {
                setCurrentSavedQRId(null); // Clear selection if deleted
            }
        } catch (e: any) {
            console.error("Delete Saved QR Error:", e);
            alert(`Failed to delete saved QR: ${e.message}`);
        }
    };

    const loadTemplate = (template: QRTemplate) => {
        setConfig(prev => ({
            ...template.config,
            url: prev.url, 
            label: prev.label
        }));
        setCurrentTemplateId(template.id);
        setTemplateForm({ id: template.id, name: template.name, notes: template.notes });
        setActiveQrTab('editor');
    };
    
    const selectTemplateFilter = (templateId: string) => {
        if (filterTemplateId === templateId) {
            setFilterTemplateId(null); // Toggle off
        } else {
            setFilterTemplateId(templateId);
        }
    };

    const handleQuickLoadTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            loadTemplate(template);
        }
    };

    const loadSavedQR = (qr: SavedQR) => {
        setConfig(qr.config);
        setCurrentSavedQRId(qr.id);
        if (qr.sourceTemplateId) {
            setCurrentTemplateId(qr.sourceTemplateId);
            const t = templates.find(temp => temp.id === qr.sourceTemplateId);
            if (t) setTemplateForm({ id: t.id, name: t.name, notes: t.notes });
        }
        setSaveQRForm({ name: qr.name, category: qr.category, subCategory: qr.subCategory });
        setActiveQrTab('editor');
    };

    const prepareNewTemplate = () => {
        if (currentTemplateId) {
            const t = templates.find(temp => temp.id === currentTemplateId);
            if (t) {
                setTemplateForm({ id: t.id, name: t.name, notes: t.notes });
            } else {
                setTemplateForm({ id: '', name: '', notes: '' });
            }
        } else {
            setTemplateForm({ id: '', name: '', notes: '' });
        }
        setIsTemplateModalOpen(true);
    };
    
    const prepareEditTemplate = (t: QRTemplate) => {
        setTemplateForm({ id: t.id, name: t.name, notes: t.notes });
        setIsTemplateModalOpen(true);
    };

    // --- Drawing Logic ---
    const renderQRToCanvas = async (targetCanvas: HTMLCanvasElement, scale: number = 1, isTransparent: boolean = false, configOverride?: QRConfig) => {
        const currentConfig = configOverride || config;
        if (!currentConfig.url) return;
        const ctx = targetCanvas.getContext('2d');
        if (!ctx) return;

        try {
            // 1. Dimensions
            const qrBaseSize = 400 * scale;
            const quietZone = 40 * scale; 
            const totalPadding = quietZone + (currentConfig.borderPadding * scale);
            const borderThickness = currentConfig.frameStyle === 'none' ? 0 : (currentConfig.borderWidth * scale);
            const boxSize = qrBaseSize + (totalPadding * 2); 
            const fontSize = currentConfig.fontSize * scale;
            const outerMargin = currentConfig.outerMargin * scale;

            ctx.font = `${currentConfig.fontStyle} ${fontSize}px ${currentConfig.fontFace}`;
            
            // Label height calculation
            const labelHeight = currentConfig.label && currentConfig.labelPosition !== 'center' ? (fontSize * 3.5) : 0;

            const totalWidth = boxSize + (borderThickness * 2) + (outerMargin * 2);
            const totalHeight = boxSize + (borderThickness * 2) + labelHeight + (outerMargin * 2);

            targetCanvas.width = totalWidth;
            targetCanvas.height = totalHeight;

            // 2. Background
            if (!isTransparent) {
                ctx.fillStyle = currentConfig.bgColor;
                ctx.fillRect(0, 0, totalWidth, totalHeight);
            } else {
                ctx.clearRect(0, 0, totalWidth, totalHeight);
            }

            // 3. Determine Offsets
            let boxY = borderThickness + outerMargin; 
            if (currentConfig.labelPosition === 'top') {
                boxY += labelHeight;
            }
            const boxX = borderThickness + outerMargin;

            const boxCenterX = totalWidth / 2;
            const boxCenterY = boxY + (boxSize / 2);
            
            const qrX = (totalWidth - qrBaseSize) / 2;
            const qrY = boxY + (boxSize - qrBaseSize) / 2;

            // 4. Generate Standard QR Logic (Modules)
            const qrRaw = QRCode.create(currentConfig.url, { errorCorrectionLevel: 'H' });
            const moduleCount = qrRaw.modules.size;
            const moduleSize = qrBaseSize / moduleCount;

            // Draw Modules
            ctx.save();
            ctx.translate(qrX, qrY);

            // Prepare Fill Style (Gradient or Solid)
            if (currentConfig.useGradient) {
                let grad;
                if (currentConfig.gradientType === 'linear') {
                    grad = ctx.createLinearGradient(0, 0, qrBaseSize, qrBaseSize);
                } else {
                    grad = ctx.createRadialGradient(qrBaseSize/2, qrBaseSize/2, 10, qrBaseSize/2, qrBaseSize/2, qrBaseSize);
                }
                grad.addColorStop(0, currentConfig.gradientStart);
                grad.addColorStop(1, currentConfig.gradientEnd);
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = currentConfig.qrColor;
            }

            // Calculate Logo Exclusion Zone
            const centerModule = moduleCount / 2;
            const logoModuleSize = moduleCount * currentConfig.logoSize;
            const logoStart = centerModule - (logoModuleSize / 2);
            const logoEnd = centerModule + (logoModuleSize / 2);

            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    const isTopLeft = row < 7 && col < 7;
                    const isTopRight = row < 7 && col >= moduleCount - 7;
                    const isBottomLeft = row >= moduleCount - 7 && col < 7;
                    const isLogoZone = currentConfig.logoData && row >= logoStart && row <= logoEnd && col >= logoStart && col <= logoEnd;

                    if (qrRaw.modules.get(row, col) && !isTopLeft && !isTopRight && !isBottomLeft && !isLogoZone) {
                        const x = col * moduleSize;
                        const y = row * moduleSize;
                        ctx.fillRect(x, y, moduleSize + 0.5, moduleSize + 0.5); 
                    }
                }
            }
            ctx.restore();

            // 5. Draw Eyes (Finder Patterns)
            const drawEye = (rowStart: number, colStart: number) => {
                ctx.save();
                ctx.translate(qrX + (colStart * moduleSize), qrY + (rowStart * moduleSize));
                
                const eyePx = 7 * moduleSize;
                const center = eyePx / 2;
                const scaleEye = currentConfig.eyeSize; 
                
                ctx.fillStyle = currentConfig.eyeColor;

                if (currentConfig.eyeShape === 'square') {
                    ctx.fillRect(0, 0, eyePx, eyePx);
                    // Clear inner if transparent BG
                    if (isTransparent) ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillRect(moduleSize, moduleSize, eyePx - 2*moduleSize, eyePx - 2*moduleSize);
                    
                    if (isTransparent) ctx.globalCompositeOperation = 'source-over';
                    else {
                        ctx.fillStyle = currentConfig.bgColor;
                        ctx.fillRect(moduleSize, moduleSize, eyePx - 2*moduleSize, eyePx - 2*moduleSize);
                    }
                    
                    ctx.fillStyle = currentConfig.eyeColor;
                    ctx.fillRect(2*moduleSize, 2*moduleSize, 3*moduleSize, 3*moduleSize);
                } else if (currentConfig.eyeShape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(center, center, (3.5 * moduleSize) * scaleEye, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.beginPath();
                    ctx.arc(center, center, (2.5 * moduleSize) * scaleEye, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = currentConfig.eyeColor;
                    ctx.beginPath();
                    ctx.arc(center, center, (1.5 * moduleSize) * scaleEye, 0, Math.PI * 2);
                    ctx.fill();
                } else if (currentConfig.eyeShape === 'rounded') {
                    const r = 1.5 * moduleSize;
                    ctx.beginPath();
                    ctx.roundRect(0, 0, eyePx, eyePx, r);
                    ctx.fill();
                    
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.beginPath();
                    ctx.roundRect(moduleSize, moduleSize, eyePx - 2*moduleSize, eyePx - 2*moduleSize, r * 0.7);
                    ctx.fill();
                    
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = currentConfig.eyeColor;
                    ctx.beginPath();
                    ctx.roundRect(2*moduleSize, 2*moduleSize, 3*moduleSize, 3*moduleSize, r * 0.4);
                    ctx.fill();
                }
                ctx.restore();
            };

            drawEye(0, 0);
            drawEye(0, moduleCount - 7);
            drawEye(moduleCount - 7, 0);

            // 6. Draw Logo
            if (currentConfig.logoData) {
                 const logoPx = (logoEnd - logoStart) * moduleSize;
                 const logoCenterX = qrX + (qrBaseSize / 2);
                 const logoCenterY = qrY + (qrBaseSize / 2);
                 const logoX = logoCenterX - (logoPx / 2);
                 const logoY = logoCenterY - (logoPx / 2);

                 ctx.fillStyle = currentConfig.logoBgColor;
                 if (currentConfig.logoShape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(logoCenterX, logoCenterY, (logoPx/2) + 2, 0, Math.PI * 2);
                    ctx.fill();
                 } else if (currentConfig.logoShape === 'square') {
                     ctx.fillRect(logoX - 2, logoY - 2, logoPx + 4, logoPx + 4);
                 }

                 const img = new Image();
                 img.src = currentConfig.logoData;
                 await new Promise<void>((resolve) => {
                     img.onload = () => resolve();
                 });
                 
                 ctx.save();
                 if (currentConfig.logoShape === 'circle') {
                     ctx.beginPath();
                     ctx.arc(logoCenterX, logoCenterY, logoPx/2, 0, Math.PI * 2);
                     ctx.clip();
                 }
                 ctx.drawImage(img, logoX, logoY, logoPx, logoPx);
                 ctx.restore();
            }

            // 7. Draw Frame
            if (currentConfig.frameStyle !== 'none') {
                ctx.lineWidth = currentConfig.borderWidth * scale;
                ctx.strokeStyle = currentConfig.borderColor;
                ctx.lineCap = 'round';
                
                const rectW = boxSize; 
                const rectH = boxSize;
                
                if (currentConfig.frameStyle === 'box') {
                    ctx.strokeRect(boxX, boxY, rectW, rectH);
                } else if (currentConfig.frameStyle === 'rounded') {
                    ctx.beginPath();
                    ctx.roundRect(boxX, boxY, rectW, rectH, 30 * scale);
                    ctx.stroke();
                } else if (currentConfig.frameStyle === 'circle') {
                    ctx.beginPath();
                    const radius = Math.min(rectW, rectH) / 2;
                    ctx.arc(boxCenterX, boxCenterY, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                } else if (currentConfig.frameStyle === 'corners') {
                    const cornerLen = 50 * scale;
                    const cornerRadius = (currentConfig.frameCornerRadius || 0) * scale;

                    ctx.beginPath();
                    
                    // Top Left
                    ctx.moveTo(boxX, boxY + cornerLen);
                    ctx.lineTo(boxX, boxY + cornerRadius);
                    ctx.arcTo(boxX, boxY, boxX + cornerRadius, boxY, cornerRadius);
                    ctx.lineTo(boxX + cornerLen, boxY);
                    
                    // Top Right
                    ctx.moveTo(boxX + rectW - cornerLen, boxY);
                    ctx.lineTo(boxX + rectW - cornerRadius, boxY);
                    ctx.arcTo(boxX + rectW, boxY, boxX + rectW, boxY + cornerRadius, cornerRadius);
                    ctx.lineTo(boxX + rectW, boxY + cornerLen);
                    
                    // Bottom Right
                    ctx.moveTo(boxX + rectW, boxY + rectH - cornerLen);
                    ctx.lineTo(boxX + rectW, boxY + rectH - cornerRadius);
                    ctx.arcTo(boxX + rectW, boxY + rectH, boxX + rectW - cornerRadius, boxY + rectH, cornerRadius);
                    ctx.lineTo(boxX + rectW - cornerLen, boxY + rectH);
                    
                    // Bottom Left
                    ctx.moveTo(boxX + cornerLen, boxY + rectH);
                    ctx.lineTo(boxX + cornerRadius, boxY + rectH);
                    ctx.arcTo(boxX, boxY + rectH, boxX, boxY + rectH - cornerRadius, cornerRadius);
                    ctx.lineTo(boxX, boxY + rectH - cornerLen);
                    
                    ctx.stroke();
                }
            }

            // 8. Draw Label
            if (currentConfig.label) {
                ctx.font = `${currentConfig.fontStyle} ${fontSize}px ${currentConfig.fontFace}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                let textX = totalWidth / 2;
                let textY = 0;
                let isUp = false; 
                
                if (currentConfig.labelPosition === 'top') {
                    textY = (labelHeight / 2) + outerMargin;
                } else if (currentConfig.labelPosition === 'bottom') {
                    textY = boxY + boxSize + (labelHeight / 2);
                    isUp = true;
                } else if (currentConfig.labelPosition === 'center') {
                     textY = boxCenterY;
                }
                
                const textMetrics = ctx.measureText(currentConfig.label);
                const textWidth = textMetrics.width;
                const textHeight = fontSize; 
                
                const padX = 20 * scale;
                const padY = 12 * scale;
                
                let bgWidth = textWidth + (padX * 2);
                let bgHeight = textHeight + (padY * 2);
                let bgX = textX - (bgWidth / 2);
                const bgY = textY - (bgHeight / 2);

                if (currentConfig.labelShape === 'full') {
                    bgWidth = totalWidth;
                    bgX = 0;
                    ctx.fillStyle = currentConfig.labelBgColor;
                    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
                } else if (currentConfig.labelShape !== 'none') {
                    ctx.fillStyle = currentConfig.labelBgColor;
                    ctx.beginPath();

                    if (currentConfig.labelShape === 'callout') {
                        const r = 8 * scale;
                        const arrowSize = 10 * scale;
                        
                        if (!isUp && currentConfig.labelPosition !== 'center') { 
                             ctx.roundRect(bgX, bgY, bgWidth, bgHeight, r);
                             ctx.moveTo(textX - arrowSize, bgY + bgHeight);
                             ctx.lineTo(textX, bgY + bgHeight + arrowSize);
                             ctx.lineTo(textX + arrowSize, bgY + bgHeight);
                        } else if (isUp) { 
                             ctx.roundRect(bgX, bgY, bgWidth, bgHeight, r);
                             ctx.moveTo(textX - arrowSize, bgY);
                             ctx.lineTo(textX, bgY - arrowSize);
                             ctx.lineTo(textX + arrowSize, bgY);
                        } else {
                             ctx.roundRect(bgX, bgY, bgWidth, bgHeight, r);
                        }
                    } else if (currentConfig.labelShape === 'rectangle') {
                        ctx.rect(bgX, bgY, bgWidth, bgHeight);
                    } else if (currentConfig.labelShape === 'rounded') {
                        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 8 * scale);
                    } else if (currentConfig.labelShape === 'pill') {
                        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, bgHeight / 2);
                    }
                    ctx.fill();
                }
                
                ctx.fillStyle = currentConfig.labelColor;
                ctx.fillText(currentConfig.label, textX, textY);
            }

        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (canvasRef.current) {
            renderQRToCanvas(canvasRef.current, 1, false);
        }
    }, [config]);

    const handleDownload = async () => {
        const tempCanvas = document.createElement('canvas');
        await renderQRToCanvas(tempCanvas, downloadScale, downloadFormat === 'png' && downloadTransparent);
        
        const link = document.createElement('a');
        link.download = `QR_${config.label || 'Code'}.${downloadFormat}`;
        link.href = tempCanvas.toDataURL(`image/${downloadFormat}`, 1.0);
        link.click();
        setDownloadOptionsOpen(false);
    };
    
    const downloadSavedQR = async (qr: SavedQR) => {
        const tempCanvas = document.createElement('canvas');
        await renderQRToCanvas(tempCanvas, 1, false, qr.config);
        
        const link = document.createElement('a');
        link.download = `QR_${qr.name}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    };

    const handleCanvasClick = () => {
        if (canvasRef.current) {
            setPreviewImage(canvasRef.current.toDataURL());
            setPreviewModalOpen(true);
        }
    };
    
    const selectedCategoryData = categories.find(c => c.name === saveQRForm.category);
    const filterSubCategories = filterCategory ? (categories.find(c => c.name === filterCategory)?.subCategories || []) : [];

    // Filter Saved Codes based on selections
    const filteredSavedQRs = savedQRs.filter(qr => {
        const matchesTemplate = filterTemplateId ? qr.sourceTemplateId === filterTemplateId : true;
        const matchesCategory = filterCategory ? qr.category === filterCategory : true;
        const matchesSubCategory = filterSubCategory ? qr.subCategory === filterSubCategory : true;
        return matchesTemplate && matchesCategory && matchesSubCategory;
    });
    
    const clearFilters = () => {
        setFilterTemplateId(null);
        setFilterCategory('');
        setFilterSubCategory('');
    };

    const NavButton: React.FC<{ id: string, label: string, icon: React.ReactNode }> = ({ id, label, icon }) => (
        <button 
            onClick={() => {
                setActiveSection(id);
                document.getElementById(`qr-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activeSection === id ? 'bg-white shadow-sm text-indigo-600 border border-indigo-100' : 'text-slate-500 hover:bg-slate-100'}`}
        >
            <span className="mr-3">{icon}</span>
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Tabs Header */}
            <div className="flex items-center border-b border-slate-200 bg-white px-6 sticky top-0 z-20">
                <button
                    onClick={() => setActiveQrTab('editor')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeQrTab === 'editor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Editor
                </button>
                <button
                    onClick={() => setActiveQrTab('library')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeQrTab === 'library' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Library
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {/* EDITOR TAB */}
                {activeQrTab === 'editor' && (
                    <div className="flex flex-col h-full lg:flex-row overflow-hidden animate-fade-in">
                        {/* Left: Configuration Area */}
                        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
                            {/* Navigation Sidebar */}
                            <div className="w-full lg:w-64 flex-shrink-0 bg-slate-50 border-b lg:border-r lg:border-b-0 border-slate-200 p-4 overflow-x-auto lg:overflow-y-auto flex lg:flex-col gap-2">
                                 {/* Quick Apply Template */}
                                 <div className="mb-4">
                                     <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Quick Apply Template</label>
                                     <select 
                                        className="w-full text-sm p-2 border rounded-lg bg-white"
                                        onChange={(e) => handleQuickLoadTemplate(e.target.value)}
                                        value={currentTemplateId || ''}
                                     >
                                        <option value="">Select Template...</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                     </select>
                                 </div>

                                 {navSections.map(section => <NavButton key={section.id} {...section} />)}
                                 <div className="lg:mt-auto pt-4 border-t border-slate-200 space-y-2">
                                    <Button onClick={prepareNewTemplate} variant="secondary" className="!w-full !text-xs">Save Template</Button>
                                    
                                    {currentSavedQRId ? (
                                        <div className="flex gap-2">
                                            <Button onClick={handleUpdateSavedQR} isLoading={loading} className="!w-full !text-xs bg-blue-600 hover:bg-blue-700">Update</Button>
                                            <Button onClick={() => setIsSaveQRModalOpen(true)} className="!w-full !text-xs bg-green-600 hover:bg-green-700">Save New</Button>
                                        </div>
                                    ) : (
                                        <Button onClick={() => setIsSaveQRModalOpen(true)} className="!w-full !text-xs bg-green-600 hover:bg-green-700">Save QR</Button>
                                    )}
                                 </div>
                            </div>

                            {/* Content Area (Editor Inputs) */}
                            <div className="flex-1 h-full overflow-y-auto p-4 md:p-8 scroll-smooth">
                                 <div className="space-y-8 pb-20 max-w-2xl mx-auto">
                                    <div id="qr-section-content" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Content & Label</h3>
                                        <div className="space-y-4">
                                            <Input id="qrUrl" label="URL / Data" value={config.url} onChange={e => updateConfig('url', e.target.value)} placeholder="https://..." />
                                            <Input id="qrLabel" label="Label Text" value={config.label} onChange={e => updateConfig('label', e.target.value)} placeholder="SCAN ME" maxLength={25} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Position</label>
                                                    <select value={config.labelPosition} onChange={e => updateConfig('labelPosition', e.target.value)} className="w-full text-sm p-2 border rounded-lg">
                                                        <option value="bottom">Bottom</option>
                                                        <option value="top">Top</option>
                                                        <option value="center">Center</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Shape</label>
                                                    <select value={config.labelShape} onChange={e => updateConfig('labelShape', e.target.value)} className="w-full text-sm p-2 border rounded-lg">
                                                        <option value="none">None</option>
                                                        <option value="rectangle">Rectangle</option>
                                                        <option value="rounded">Rounded</option>
                                                        <option value="pill">Pill</option>
                                                        <option value="callout">Callout</option>
                                                        <option value="full">Full Width</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                 <div>
                                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Font</label>
                                                    <select value={config.fontFace} onChange={e => updateConfig('fontFace', e.target.value)} className="w-full text-sm p-2 border rounded-lg">
                                                        {fontOptions.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Font Style</label>
                                                    <select value={config.fontStyle} onChange={e => updateConfig('fontStyle', e.target.value)} className="w-full text-sm p-2 border rounded-lg">
                                                        <option value="normal">Normal</option>
                                                        <option value="bold">Bold</option>
                                                        <option value="italic">Italic</option>
                                                        <option value="bold italic">Bold Italic</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Size: {config.fontSize}</label>
                                                    <input type="range" min="12" max="60" value={config.fontSize} onChange={e => updateConfig('fontSize', Number(e.target.value))} className="w-full accent-indigo-600" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="qr-section-colors" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Colors & Theme</h3>
                                        <div className="grid grid-cols-2 gap-6 mb-4">
                                            <div><label className="text-xs font-medium block mb-1">Background</label><input type="color" value={config.bgColor} onChange={e => updateConfig('bgColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" /></div>
                                            <div><label className="text-xs font-medium block mb-1">Main Code</label><input type="color" value={config.qrColor} onChange={e => updateConfig('qrColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" disabled={config.useGradient} /></div>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-4">
                                            <input type="checkbox" checked={config.useGradient} onChange={e => updateConfig('useGradient', e.target.checked)} className="h-4 w-4 text-indigo-600 rounded" id="useGrad" />
                                            <label htmlFor="useGrad" className="text-sm font-medium cursor-pointer">Use Gradient</label>
                                        </div>
                                        {config.useGradient && (
                                            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl">
                                                <div><label className="text-xs font-medium block mb-1">Start Color</label><input type="color" value={config.gradientStart} onChange={e => updateConfig('gradientStart', e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
                                                <div><label className="text-xs font-medium block mb-1">End Color</label><input type="color" value={config.gradientEnd} onChange={e => updateConfig('gradientEnd', e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-100">
                                             <div><label className="text-xs font-medium block mb-1">Label Text</label><input type="color" value={config.labelColor} onChange={e => updateConfig('labelColor', e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
                                             <div><label className="text-xs font-medium block mb-1">Label Background</label><input type="color" value={config.labelBgColor} onChange={e => updateConfig('labelBgColor', e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
                                        </div>
                                    </div>

                                    <div id="qr-section-logo" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Logo</h3>
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden bg-slate-50">
                                                {config.logoData ? <img src={config.logoData} className="w-full h-full object-contain" /> : <span className="text-xs text-slate-400">Preview</span>}
                                            </div>
                                            <div className="flex-1">
                                                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleLogoUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                                                {config.logoData && <button onClick={removeLogo} className="text-xs text-red-500 hover:underline mt-2 ml-1">Remove Logo</button>}
                                            </div>
                                        </div>
                                        {config.logoData && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-medium block mb-1">Size</label>
                                                    <input type="range" min="0.1" max="0.4" step="0.05" value={config.logoSize} onChange={e => updateConfig('logoSize', Number(e.target.value))} className="w-full accent-indigo-600" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium block mb-1">Shape</label>
                                                    <select value={config.logoShape} onChange={e => updateConfig('logoShape', e.target.value)} className="w-full text-sm p-1 border rounded">
                                                        <option value="none">None</option>
                                                        <option value="square">Square</option>
                                                        <option value="circle">Circle</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div id="qr-section-eyes" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Eyes & Frame</h3>
                                        <div className="grid grid-cols-2 gap-6 mb-4">
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Eye Shape</label>
                                                <select value={config.eyeShape} onChange={e => updateConfig('eyeShape', e.target.value)} className="w-full text-sm p-2 border rounded-lg">
                                                    <option value="square">Square</option>
                                                    <option value="circle">Circle</option>
                                                    <option value="rounded">Rounded</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Eye Color</label>
                                                <input type="color" value={config.eyeColor} onChange={e => updateConfig('eyeColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-slate-100">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs font-medium block mb-1">Frame Style</label>
                                                    <select value={config.frameStyle} onChange={e => updateConfig('frameStyle', e.target.value)} className="w-full text-sm p-2 border rounded-lg">
                                                        <option value="none">None</option>
                                                        <option value="box">Box</option>
                                                        <option value="rounded">Rounded</option>
                                                        <option value="circle">Circle</option>
                                                        <option value="corners">Corners</option>
                                                    </select>
                                                </div>
                                                <div>
                                                     <label className="text-xs font-medium block mb-1">Frame Color</label>
                                                     <input type="color" value={config.borderColor} onChange={e => updateConfig('borderColor', e.target.value)} className="w-full h-10 rounded cursor-pointer" disabled={config.frameStyle === 'none'}/>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Thickness: {config.borderWidth}</label>
                                                <input type="range" min="1" max="20" value={config.borderWidth} onChange={e => updateConfig('borderWidth', Number(e.target.value))} className="w-full accent-indigo-600" disabled={config.frameStyle === 'none'} list="thickness-markers" />
                                                <datalist id="thickness-markers">
                                                    <option value="1"></option>
                                                    <option value="5"></option>
                                                    <option value="10"></option>
                                                    <option value="15"></option>
                                                    <option value="20"></option>
                                                </datalist>
                                            </div>
                                            {config.frameStyle === 'corners' && (
                                                <div>
                                                    <label className="text-xs font-medium block mb-1">Corner Radius: {config.frameCornerRadius}</label>
                                                    <input type="range" min="0" max="50" value={config.frameCornerRadius} onChange={e => updateConfig('frameCornerRadius', Number(e.target.value))} className="w-full accent-indigo-600" list="radius-markers" />
                                                    <datalist id="radius-markers">
                                                        <option value="0"></option>
                                                        <option value="10"></option>
                                                        <option value="25"></option>
                                                        <option value="50"></option>
                                                    </datalist>
                                                </div>
                                            )}
                                             <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs font-medium block mb-1">Padding: {config.borderPadding}</label>
                                                    <input type="range" min="0" max="100" step="5" value={config.borderPadding} onChange={e => updateConfig('borderPadding', Number(e.target.value))} className="w-full accent-indigo-600" list="padding-markers" />
                                                    <datalist id="padding-markers">
                                                        <option value="0"></option>
                                                        <option value="25"></option>
                                                        <option value="50"></option>
                                                        <option value="75"></option>
                                                        <option value="100"></option>
                                                    </datalist>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium block mb-1">Outer Margin: {config.outerMargin}</label>
                                                    <input type="range" min="0" max="100" step="5" value={config.outerMargin} onChange={e => updateConfig('outerMargin', Number(e.target.value))} className="w-full accent-indigo-600" list="margin-markers" />
                                                     <datalist id="margin-markers">
                                                        <option value="0"></option>
                                                        <option value="25"></option>
                                                        <option value="50"></option>
                                                        <option value="75"></option>
                                                        <option value="100"></option>
                                                    </datalist>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>
                        
                        {/* Right: Sticky Preview Sidebar */}
                        <div className="w-full lg:w-[500px] bg-slate-100 border-t lg:border-l border-slate-200 p-8 flex flex-col items-center justify-center lg:h-full flex-shrink-0 relative z-10">
                            <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 relative group cursor-pointer" onClick={handleCanvasClick}>
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                <div className="relative bg-white rounded-2xl overflow-hidden">
                                    <canvas ref={canvasRef} className="max-w-full h-auto" />
                                </div>
                                 <p className="text-xs text-center text-slate-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to enlarge</p>
                            </div>
                            
                            <div className="mt-8 w-full max-w-xs space-y-3">
                                 <div className="relative">
                                    <button 
                                        onClick={() => setDownloadOptionsOpen(!downloadOptionsOpen)}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                    >
                                        <span>Download Image</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${downloadOptionsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    
                                    {downloadOptionsOpen && (
                                        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-slate-100 p-4 animate-fade-in-up">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Format</label>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => setDownloadFormat('png')} 
                                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border ${downloadFormat === 'png' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                        >
                                                            PNG
                                                        </button>
                                                        <button 
                                                            onClick={() => { setDownloadFormat('jpeg'); setDownloadTransparent(false); }} 
                                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border ${downloadFormat === 'jpeg' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                        >
                                                            JPEG
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Size / Scale</label>
                                                    <div className="flex gap-2">
                                                        {[1, 2, 4].map((scale) => (
                                                            <button 
                                                                key={scale}
                                                                onClick={() => setDownloadScale(scale)} 
                                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${downloadScale === scale ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                            >
                                                                {scale}x
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${downloadFormat === 'png' ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'}`}>
                                                        <span className="text-xs font-bold text-slate-600">Transparent Background</span>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={downloadTransparent} 
                                                            onChange={e => setDownloadTransparent(e.target.checked)} 
                                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                            disabled={downloadFormat !== 'png'}
                                                        />
                                                    </label>
                                                </div>

                                                <button onClick={handleDownload} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors text-sm shadow-md">
                                                    Save Image
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                 </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* LIBRARY TAB */}
                {activeQrTab === 'library' && (
                    <div className="h-full overflow-y-auto p-6 md:p-8 bg-slate-50 animate-fade-in">
                        <div className="space-y-6 max-w-6xl mx-auto">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-slate-800">QR Library</h2>
                                <div className="flex gap-2">
                                    <Button onClick={() => setIsCategoryManagerOpen(true)} variant="secondary" className="!w-auto">Manage Categories</Button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center"><span className="w-2 h-6 bg-blue-500 rounded-full mr-2"></span>Templates</h3>
                                    {templates.length === 0 && <p className="text-sm text-slate-400 italic">No templates saved yet.</p>}
                                    <ul className="space-y-3">
                                        {templates.map(t => (
                                            <li 
                                                key={t.id} 
                                                className={`flex justify-between items-center p-3 rounded-xl hover:shadow-md transition-all cursor-pointer border ${filterTemplateId === t.id ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-transparent hover:border-blue-200'}`}
                                                onClick={() => selectTemplateFilter(t.id)}
                                            >
                                                <div className="flex-1">
                                                    <span className="font-semibold text-slate-700 block">{t.name}</span>
                                                    {t.notes && <p className="text-xs text-slate-500 truncate">{t.notes}</p>}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); loadTemplate(t); }} className="text-green-600 hover:bg-green-100 p-1 rounded text-xs font-bold">Edit</button>
                                                    <button onClick={(e) => { e.stopPropagation(); prepareEditTemplate(t); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded text-xs">Prop</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setTemplateForm({ id: t.id, name: t.name, notes: t.notes }); handleDeleteTemplate(); }} className="text-red-500 hover:bg-red-100 p-1 rounded">&times;</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-800 flex items-center"><span className="w-2 h-6 bg-green-500 rounded-full mr-2"></span>Saved Codes</h3>
                                        <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline" disabled={!filterTemplateId && !filterCategory}>Clear Filters</button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(''); }} className="text-xs p-1 border rounded">
                                            <option value="">All Categories</option>
                                            {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <select value={filterSubCategory} onChange={e => setFilterSubCategory(e.target.value)} className="text-xs p-1 border rounded" disabled={!filterCategory}>
                                            <option value="">All Sub-Categories</option>
                                            {filterSubCategories.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    {filteredSavedQRs.length === 0 && <p className="text-sm text-slate-400 italic">No QR codes found matching filters.</p>}
                                    
                                    <ul className="space-y-3 max-h-[600px] overflow-y-auto">
                                        {filteredSavedQRs.map(q => (
                                            <li key={q.id} className="p-3 bg-slate-50 rounded-xl border-l-4 border-green-500 relative group hover:shadow-md transition-all">
                                                <button onClick={() => handleDeleteSavedQR(q.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">&times;</button>
                                                <div className="pr-6">
                                                    <span className="font-bold text-slate-800 block">{q.name}</span>
                                                    <p className="text-xs text-slate-500 mt-1">{q.category} {q.subCategory ? `› ${q.subCategory}` : ''}</p>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => loadSavedQR(q)} className="text-xs font-semibold text-blue-600 hover:underline">Load</button>
                                                            <button onClick={() => downloadSavedQR(q)} className="text-xs font-bold text-white bg-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-700">Download Image</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CategoryManager 
                isOpen={isCategoryManagerOpen}
                onClose={() => setIsCategoryManagerOpen(false)}
                categories={categories}
                onSave={handleSaveCategories}
            />

            <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title={templateForm.id ? "Edit Template" : "Save New Template"}>
                <div className="space-y-4">
                    <div className="mb-4 border-b pb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Overwrite Existing?</label>
                        <select 
                            className="w-full text-sm p-2 border rounded-md" 
                            onChange={(e) => {
                                const t = templates.find(temp => temp.id === e.target.value);
                                if (t) {
                                    setTemplateForm({ id: t.id, name: t.name, notes: t.notes });
                                } else {
                                    setTemplateForm({ id: '', name: '', notes: '' });
                                }
                            }}
                            value={templateForm.id}
                        >
                            <option value="">-- Save as New --</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <Input id="templateName" label="Template Name" value={templateForm.name} onChange={e => setTemplateForm(p => ({...p, name: e.target.value}))} required />
                    <Input id="templateNotes" as="textarea" label="Notes" value={templateForm.notes} onChange={e => setTemplateForm(p => ({...p, notes: e.target.value}))} />
                    
                    {templateForm.id && (
                        <div className="pt-2 border-t">
                            <Button variant="secondary" onClick={handleDeleteTemplate} className="!bg-red-100 !text-red-800 !border-red-200 hover:!bg-red-200 w-full">Delete Template</Button>
                        </div>
                    )}

                    <div className="flex justify-end pt-4"><Button onClick={handleSaveTemplate} isLoading={loading}>Save</Button></div>
                </div>
            </Modal>

            <Modal isOpen={isSaveQRModalOpen} onClose={() => setIsSaveQRModalOpen(false)} title="Save QR Code to Database">
                <div className="space-y-4">
                    <Input id="qrSaveName" label="QR Name" value={saveQRForm.name} onChange={e => setSaveQRForm(p => ({...p, name: e.target.value}))} required />
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Category</label>
                        <select 
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md"
                            value={saveQRForm.category}
                            onChange={e => setSaveQRForm(p => ({ ...p, category: e.target.value, subCategory: '' }))}
                        >
                            <option value="">Select Category...</option>
                            {categories.map((cat, i) => <option key={i} value={cat.name}>{cat.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Sub-Category</label>
                        <select 
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 rounded-md disabled:bg-slate-100"
                            value={saveQRForm.subCategory}
                            onChange={e => setSaveQRForm(p => ({ ...p, subCategory: e.target.value }))}
                            disabled={!saveQRForm.category}
                        >
                            <option value="">Select Sub-Category...</option>
                            {selectedCategoryData?.subCategories.map((sub, i) => <option key={i} value={sub.name}>{sub.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end pt-4"><Button onClick={handleSaveQR} isLoading={loading}>Save QR</Button></div>
                </div>
            </Modal>
            
            {/* QR Preview Modal */}
            <Modal isOpen={previewModalOpen} onClose={() => setPreviewModalOpen(false)} title="QR Preview" size="4xl">
                <div className="flex flex-col items-center justify-center p-4">
                     <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 overflow-auto max-h-[70vh] max-w-full">
                         <img src={previewImage} alt="QR Preview" className="max-w-full h-auto" />
                     </div>
                     <div className="mt-4">
                         <Button onClick={() => setPreviewModalOpen(false)}>Close</Button>
                     </div>
                </div>
            </Modal>
        </div>
    );
};

const ToolsDashboard: React.FC<{ currentUser: AppUser; theme: Organisation['theme'] }> = ({ currentUser, theme }) => {
  const [activeTab, setActiveTab] = useState('qr_generator');

  const tabs = [
      { id: 'qr_generator', label: 'QR Generator' },
      { id: 'calculator', label: 'Calculator' },
      { id: 'dictionary', label: 'Dictionary' },
      { id: 'forms', label: 'Forms' },
      { id: 'energy_management', label: 'Energy Management' },
  ];

  const TabButton: React.FC<{ tabId: string, label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors duration-200 ${
        activeTab === tabId
          ? '' // Active style
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
      style={activeTab === tabId ? { borderColor: theme.colorPrimary, color: theme.colorPrimary } : {}}
    >
      {label}
    </button>
  );

  const renderTabContent = () => {
      switch (activeTab) {
          case 'qr_generator':
              return <QRGeneratorTool theme={theme} currentUser={currentUser} />;
          case 'calculator':
              return <CasioCalculator />;
          case 'dictionary':
              return <DictionaryTool theme={theme} />;
          case 'forms':
              return <FormsBuilderTool currentUser={currentUser} theme={theme} />;
          case 'energy_management':
              return <EnergyManagement currentUser={currentUser} theme={theme} />;
          default:
              return null;
      }
  };

  return (
    <div className="p-4 md:p-8 w-full h-full flex flex-col">
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Tools</h1>
            <p className="text-gray-500">Utility tools and helpers.</p>
        </div>

        <div className="border-b border-slate-200 bg-white rounded-t-lg shadow-md overflow-x-auto flex-shrink-0">
            <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
                {tabs.map(tab => <TabButton key={tab.id} tabId={tab.id} label={tab.label} />)}
            </nav>
        </div>

        <div className="flex-1 bg-white shadow-md rounded-b-lg overflow-hidden">
            {renderTabContent()}
        </div>
    </div>
  );
};

export default ToolsDashboard;
