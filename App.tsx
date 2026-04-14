
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
const Sidebar = lazy(() => import('./components/Sidebar').then(module => ({ default: module.Sidebar })));
const ChapterView = lazy(() => import('./components/ChapterView').then(module => ({ default: module.ChapterView })));

import { LoginScreen } from './components/LoginScreen'; 
import { UserGuide } from './components/UserGuide';
import { TutorialPage } from './components/TutorialPage';
import { OfflineBanner } from './components/OfflineBanner';
import { ProgramSelector } from './components/ProgramSelector';
import { CourseEditor } from './components/CourseEditor';
import { ExportPinModal, ImportPinModal } from './components/SecurityModals';
import { TeacherSettingsModal } from './components/TeacherSettingsModal';
import { COURSES } from './constants';
import { Menu, ChevronLeft, ChevronRight, GraduationCap, UserCog, LogOut, Sparkles, X, CheckCircle, AlertCircle, Globe, Upload, Loader2, Download, Book, Settings, ShieldCheck, HelpCircle, LayoutGrid } from 'lucide-react';
import { exportTeachingPackage, importTeachingPackage } from './utils/packageManager';
import { saveToDB, loadFromDB, initDB, STORE_NAME } from './utils/db';
import { Quiz, Course, KeyPoint } from './types';

interface ToastProps { 
  message: string; 
  type: 'success' | 'error' | 'info'; 
  onClose: () => void; 
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => { 
    const timer = setTimeout(() => { onClose(); }, 3000); 
    return () => clearTimeout(timer); 
  }, [onClose]);

  const bgColors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-slate-800' };
  const icons = { success: <CheckCircle className="w-5 h-5" />, error: <AlertCircle className="w-5 h-5" />, info: <Sparkles className="w-5 h-5" /> };
  
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${bgColors[type]} animate-in slide-in-from-right-10 fade-in duration-300`} role="alert">
      {icons[type]} 
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded p-1"><X className="w-4 h-4" /></button>
    </div>
  );
};

const EmptyStateModal = ({ onImport, onBack }: { onImport: (file: File) => Promise<boolean>; onBack: () => void }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { 
      setIsProcessing(true); 
      await onImport(e.target.files[0]); 
      setIsProcessing(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-indigo-600 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2 font-burmese">Setup Required (စတင်ရန်လိုသည်)</h2>
            <p className="text-slate-500 mb-8 font-burmese leading-relaxed">သင်ခန်းစာများ မရှိသေးပါ။ ဆရာပေးပို့သော Lesson Package ကို ထည့်သွင်းပါ။</p>
            <div className="space-y-3">
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-3">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} Import Lesson Package</button>
                <button onClick={onBack} className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2"><LogOut className="w-4 h-4" />Back to Login</button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFile} accept=".zip" className="hidden" />
        </div>
    </div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'teacher' | 'student' | 'admin' | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false); 
  const [language, setLanguage] = useState<'my' | 'en'>(() => (localStorage.getItem('app_language') as 'my' | 'en') || 'my');
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isTeacherSettingsOpen, setIsTeacherSettingsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>(COURSES);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | undefined>(undefined);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<Course | 'all' | null>(null);
  const [importTarget, setImportTarget] = useState<Course | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const [chapterImages, setChapterImages] = useState<Record<string, string[]>>({});
  const [chapterDiagrams, setChapterDiagrams] = useState<Record<string, string[]>>({});
  const [chapterHtml, setChapterHtml] = useState<Record<string, string>>({});
  const [chapterResources, setChapterResources] = useState<Record<string, { audio?: string; youtube?: string; tiktok?: string; questions?: string[]; links?: { title: string; url: string }[] }>>({});
  const [chapterQuizzes, setChapterQuizzes] = useState<Record<string, Quiz>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [currentTab, setCurrentTab] = useState<'content' | 'concepts' | 'visual' | 'gallery' | 'resources' | 'quiz'>('content');

  const activeCourse = courses.find(c => c.id === activeCourseId);
  const activeChapter = activeCourse ? (activeCourse.chapters.find(c => c.id === activeChapterId) || activeCourse.chapters[0]) : null;

  const getScopedKey = useCallback((chId: number) => { return activeCourseId ? `${activeCourseId}:${chId}` : `${chId}`; }, [activeCourseId]);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => { setToast({ message, type }); }, []);

  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const handleLanguageToggle = () => { const newLang = language === 'my' ? 'en' : 'my'; setLanguage(newLang); localStorage.setItem('app_language', newLang); };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => { if (!installPrompt) return; installPrompt.prompt(); const { outcome } = await installPrompt.userChoice; if (outcome === 'accepted') setInstallPrompt(null); };

  useEffect(() => {
    const savedRole = sessionStorage.getItem('user_role');
    if (savedRole === 'teacher' || savedRole === 'student' || savedRole === 'admin') { 
      setUserRole(savedRole as any); 
      setIsLoggedIn(true); 
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [images, diagrams, html, resources, quizzes, savedCourses] = await Promise.all([
          loadFromDB('images'), loadFromDB('diagrams'), loadFromDB('html'), loadFromDB('resources'), loadFromDB('quizzes'), loadFromDB('courses_list')
        ]);
        if (images) setChapterImages(images); if (diagrams) setChapterDiagrams(diagrams); if (html) setChapterHtml(html);
        if (resources) setChapterResources(resources); if (quizzes) setChapterQuizzes(quizzes);
        if (savedCourses && savedCourses.length > 0) setCourses(savedCourses);
      } catch (err) { console.error(err); showToast("Failed to load saved content", 'error'); } finally { setIsLoading(false); }
    };
    if (isLoggedIn) loadData();
  }, [isLoggedIn, showToast]);

  useEffect(() => { if (!isLoading && isLoggedIn && userRole !== 'student') saveToDB('images', chapterImages); }, [chapterImages, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole !== 'student') saveToDB('diagrams', chapterDiagrams); }, [chapterDiagrams, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole !== 'student') saveToDB('html', chapterHtml); }, [chapterHtml, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole !== 'student') saveToDB('resources', chapterResources); }, [chapterResources, isLoading, isLoggedIn, userRole]);
  useEffect(() => { if (!isLoading && isLoggedIn && userRole !== 'student') saveToDB('quizzes', chapterQuizzes); }, [chapterQuizzes, isLoading, isLoggedIn, userRole]);
  
  const handleLogin = (role: 'teacher' | 'student' | 'admin') => { setUserRole(role); setIsLoggedIn(true); sessionStorage.setItem('user_role', role); };
  const handleLogout = () => { setIsLoggedIn(false); setUserRole(null); sessionStorage.removeItem('user_role'); setIsPresentationMode(false); setIsFocusMode(false); setActiveCourseId(null); setActiveChapterId(1); setCurrentTab('content'); };

  const handleSelectCourse = (courseId: string) => { setActiveCourseId(courseId); const selectedCourse = courses.find(c => c.id === courseId); if (selectedCourse && selectedCourse.chapters.length > 0) setActiveChapterId(selectedCourse.chapters[0].id); else setActiveChapterId(1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleNext = () => { if (!activeCourse) return; const currentIndex = activeCourse.chapters.findIndex(c => c.id === activeChapterId); if (currentIndex !== -1 && currentIndex < activeCourse.chapters.length - 1) setActiveChapterId(activeCourse.chapters[currentIndex + 1].id); };
  const handlePrev = () => { if (!activeCourse) return; const currentIndex = activeCourse.chapters.findIndex(c => c.id === activeChapterId); if (currentIndex > 0) setActiveChapterId(activeCourse.chapters[currentIndex - 1].id); };

  const togglePresentationMode = useCallback(() => {
      if (!isPresentationMode) { document.documentElement.requestFullscreen().catch(err => console.error(err)); setIsPresentationMode(true); setIsSidebarOpen(false); setIsFocusMode(false); }
      else { if (document.fullscreenElement) document.exitFullscreen().catch(err => console.error(err)); setIsPresentationMode(false); setIsSidebarOpen(true); }
  }, [isPresentationMode]);

  useEffect(() => {
    const handleFullscreenChange = () => { const isFullscreen = !!document.fullscreenElement; setIsPresentationMode(isFullscreen); if (!isFullscreen) setIsSidebarOpen(true); };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFocusMode = useCallback(() => { setIsFocusMode((prev) => { const next = !prev; setIsSidebarOpen(!next); return next; }); }, []);

  const handleAddImage = useCallback((scopedKey: string, img: string | string[]) => { setChapterImages(prev => ({ ...prev, [scopedKey]: [...(prev[scopedKey] || []), ...(Array.isArray(img) ? img : [img])] })); }, []);
  const handleReorderImages = useCallback((scopedKey: string, newImages: string[]) => { setChapterImages(prev => ({ ...prev, [scopedKey]: newImages })); }, []);
  const handleRemoveImage = useCallback((scopedKey: string, index: number) => { setChapterImages(prev => ({ ...prev, [scopedKey]: prev[scopedKey].filter((_, i) => i !== index) })); showToast("Image removed", 'info'); }, [showToast]);
  const handleBulkRemoveImages = useCallback((scopedKey: string, indices: number[]) => { setChapterImages(prev => ({ ...prev, [scopedKey]: (prev[scopedKey] || []).filter((_, idx) => !indices.includes(idx)) })); showToast(`Deleted ${indices.length} images`, 'info'); }, [showToast]);
  const handleBulkMoveGalleryToVisual = useCallback((chapterId: number, indices: number[]) => { const scopedKey = getScopedKey(chapterId); setChapterImages(prevImages => { const currentImages = prevImages[scopedKey] || []; const imagesToMove = currentImages.filter((_, idx) => indices.includes(idx)); if (imagesToMove.length > 0) { setChapterDiagrams(prevDiag => ({ ...prevDiag, [scopedKey]: [...(prevDiag[scopedKey] || []), ...imagesToMove] })); const updated = { ...prevImages, [scopedKey]: currentImages.filter((_, idx) => !indices.includes(idx)) }; showToast(`Moved ${imagesToMove.length} images to Visual Aid`); return updated; } return prevImages; }); }, [showToast, getScopedKey]);
  const handleAddDiagram = useCallback((scopedKey: string, img: string | string[]) => { const newDiagrams = Array.isArray(img) ? img : [img]; setChapterDiagrams(prev => ({ ...prev, [scopedKey]: [...(prev[scopedKey] || []), ...newDiagrams] })); showToast("Visual aid added"); }, [showToast]);
  const handleReorderDiagrams = useCallback((scopedKey: string, newDiagrams: string[]) => { setChapterDiagrams(prev => ({ ...prev, [scopedKey]: newDiagrams })); }, []);
  const handleRemoveDiagram = useCallback((scopedKey: string, index: number) => { setChapterDiagrams(prev => ({ ...prev, [scopedKey]: prev[scopedKey].filter((_, i) => i !== index) })); showToast("Visual aid removed", 'info'); }, [showToast]);
  const handleClearDiagrams = useCallback((scopedKey: string) => { setChapterDiagrams(prev => { const n = { ...prev }; delete n[scopedKey]; return n; }); }, []);
  const handleSetHtml = useCallback((scopedKey: string, html: string) => { setChapterHtml(prev => ({ ...prev, [scopedKey]: html })); showToast("Lecture notes saved"); }, [showToast]);
  const handleRemoveHtml = useCallback((scopedKey: string) => { setChapterHtml(prev => { const n = { ...prev }; delete n[scopedKey]; return n; }); }, []);
  const handleUpdateResources = useCallback((scopedKey: string, audio?: string, youtube?: string, tiktok?: string, questions?: string[], links: { title: string; url: string }[] = []) => { setChapterResources(prev => ({ ...prev, [scopedKey]: { ...prev[scopedKey], audio, youtube, tiktok, questions, links } })); }, []);
  const handleUpdateKeyPoints = useCallback((chapterId: number, keyPoints: KeyPoint[]) => { setCourses(prev => { const updated = prev.map(course => (course.id === activeCourseId) ? { ...course, chapters: course.chapters.map(ch => ch.id === chapterId ? { ...ch, keyPoints } : ch) } : course); saveToDB('courses_list', updated); return updated; }); showToast("Key Concepts Updated!"); }, [activeCourseId, showToast]);
  const handleUpdateSummary = useCallback((chapterId: number, summary: string) => { setCourses(prev => { const updated = prev.map(course => (course.id === activeCourseId) ? { ...course, chapters: course.chapters.map(ch => ch.id === chapterId ? { ...ch, summary } : ch) } : course); saveToDB('courses_list', updated); return updated; }); showToast("Summary Updated!"); }, [activeCourseId, showToast]);
  const handleSaveQuiz = useCallback((scopedKey: string, quiz: Quiz) => { setChapterQuizzes(prev => ({ ...prev, [scopedKey]: quiz })); }, []);

  const handleExportCourse = (course: Course) => { setExportTarget(course); setIsExportModalOpen(true); };
  const handleExportAll = () => { setExportTarget('all'); setIsExportModalOpen(true); };
  const handleImportCourse = (course: Course, file: File) => { setImportTarget(course); handleImport(file); };

  const filterDataByCourse = (data: Record<string, any>, courseId: string) => { const filtered: Record<string, any> = {}; Object.entries(data).forEach(([key, value]) => { if (key.startsWith(`${courseId}:`)) { filtered[key.split(':')[1]] = value; } }); return filtered; };

  const handleConfirmExport = async (pin: string) => {
    setIsExportModalOpen(false);
    try {
      setIsLoading(true); 
      let targetCourse: Course | undefined = undefined; 
      let allCoursesToExport: Course[] | undefined = undefined;
      let finalImages = chapterImages; let finalDiagrams = chapterDiagrams; let finalHtml = chapterHtml; let finalResources = chapterResources; let finalQuizzes = chapterQuizzes;
      
      if (exportTarget && exportTarget !== 'all') { 
        targetCourse = exportTarget; 
        finalImages = filterDataByCourse(chapterImages, targetCourse.id); 
        finalDiagrams = filterDataByCourse(chapterDiagrams, targetCourse.id); 
        finalHtml = filterDataByCourse(chapterHtml, targetCourse.id); 
        finalResources = filterDataByCourse(chapterResources, targetCourse.id); 
        finalQuizzes = filterDataByCourse(chapterQuizzes, targetCourse.id); 
      } else {
        // Master export - include all course definitions
        allCoursesToExport = courses;
      }
      
      await exportTeachingPackage(finalImages, finalDiagrams, finalHtml, finalResources, finalQuizzes, targetCourse, pin, allCoursesToExport);
      showToast(pin ? "Secured Package exported!" : "Package exported successfully!");
    } catch (error) { console.error(error); showToast("Failed to export package", 'error'); } finally { setTimeout(() => { setIsLoading(false); }, 500); setExportTarget(null); }
  };

  const handleImport = async (file: File): Promise<boolean> => {
    try { setIsLoading(true); setImportError(''); const data = await importTeachingPackage(file); if (data.isLocked) { setPendingImportFile(file); setIsImportModalOpen(true); setIsLoading(false); return false; } await applyImportData(data); return true;
    } catch (error) { console.error(error); showToast("Failed to load package.", 'error'); setIsLoading(false); return false; }
  };

  const handleConfirmImport = async (pin: string) => {
      if (!pendingImportFile) return;
      try { setIsLoading(true); const data = await importTeachingPackage(pendingImportFile, pin); await applyImportData(data); setIsImportModalOpen(false); setPendingImportFile(null); if (!isLoggedIn) handleLogin('student');
      } catch (e: any) { setIsLoading(false); setImportError(e.message === "Invalid PIN" ? "Incorrect PIN. Please try again." : "Decryption failed. File may be corrupted."); }
  };

  const mapImportedData = (importedData: Record<string, any>, courseId: string) => { const mapped: Record<string, any> = {}; Object.entries(importedData).forEach(([key, value]) => { mapped[`${courseId}:${key}`] = value; }); return mapped; };

  const applyImportData = async (data: any) => {
      let targetCourseId = importTarget?.id || (data.courseDefinition?.id);
      
      // Update media content
      if (targetCourseId) { 
        setChapterImages(prev => ({...prev, ...mapImportedData(data.images, targetCourseId)})); 
        setChapterDiagrams(prev => ({...prev, ...mapImportedData(data.diagrams, targetCourseId)})); 
        setChapterHtml(prev => ({...prev, ...mapImportedData(data.html, targetCourseId)})); 
        setChapterResources(prev => ({...prev, ...mapImportedData(data.resources, targetCourseId)})); 
        setChapterQuizzes(prev => ({...prev, ...mapImportedData(data.quizzes, targetCourseId)})); 
      } else {
        // Full backup restore
        setChapterImages(prev => ({...prev, ...data.images})); 
        setChapterDiagrams(prev => ({...prev, ...data.diagrams})); 
        setChapterHtml(prev => ({...prev, ...data.html})); 
        setChapterResources(prev => ({...prev, ...data.resources})); 
        setChapterQuizzes(prev => ({...prev, ...data.quizzes}));
      }

      // Restore Course Definitions
      if (data.allCourses && Array.isArray(data.allCourses)) {
          // Master backup restore
          setCourses(data.allCourses);
          saveToDB('courses_list', data.allCourses);
          showToast(`Full Backup Restored (${data.allCourses.length} Programs)`);
      } else if (!importTarget && data.courseDefinition) {
          const newCourse = data.courseDefinition; 
          setCourses(prev => { 
            let updated = [...prev]; 
            const existsIdx = updated.findIndex(c => c.id === newCourse.id); 
            if (existsIdx >= 0) updated[existsIdx] = newCourse; else updated.push(newCourse); 
            saveToDB('courses_list', updated); 
            return updated; 
          }); 
          setActiveCourseId(newCourse.id); 
          if (newCourse.chapters.length > 0) setActiveChapterId(newCourse.chapters[0].id); 
          showToast(`Course "${newCourse.titleEnglish}" added!`); 
      } else if (importTarget) {
          showToast(`Updated Program: ${importTarget.titleEnglish}`);
      } else {
          showToast("Content Package Loaded!");
      }
      
      setIsLoading(false); setImportTarget(null);
  };

  const handleFactoryReset = async () => {
    try { setIsLoading(true); const db = await initDB(); const transaction = db.transaction(['teaching_materials'], 'readwrite'); const request = transaction.objectStore('teaching_materials').clear();
      request.onsuccess = () => { setChapterImages({}); setChapterDiagrams({}); setChapterHtml({}); setChapterResources({}); setChapterQuizzes({}); setCourses(COURSES); setIsLoading(false); window.location.reload(); };
    } catch (e) { console.error(e); setIsLoading(false); }
  };

  const handleCreateCourse = () => { setCourseToEdit(undefined); setIsEditingCourse(true); };
  const handleEditCourse = (course: Course) => { setCourseToEdit(course); setIsEditingCourse(true); };
  const handleDeleteCourse = (courseId: string) => { if (window.confirm("Delete this course and ALL its associated data?")) { setCourses(prev => { const updated = prev.filter(c => c.id !== courseId); saveToDB('courses_list', updated); return updated; }); const cleanup = (data: Record<string, any>) => { const next = { ...data }; Object.keys(next).forEach(key => { if (key.startsWith(`${courseId}:`)) delete next[key]; }); return next; }; setChapterImages(cleanup); setChapterDiagrams(cleanup); setChapterHtml(cleanup); setChapterResources(cleanup); setChapterQuizzes(cleanup); showToast("Course deleted."); } };
  const handleSaveCourse = (newCourse: Course) => { setCourses(prev => { const idx = prev.findIndex(c => c.id === newCourse.id); let updated = idx >= 0 ? [...prev] : [...prev, newCourse]; if (idx >= 0) updated[idx] = newCourse; saveToDB('courses_list', updated); return updated; }); setIsEditingCourse(false); showToast("Program structure saved!"); };

  if (!isLoggedIn) {
    return (
      <>
        <OfflineBanner />
        <ImportPinModal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setPendingImportFile(null); setImportTarget(null); }} onConfirm={handleConfirmImport} error={importError} />
        <LoginScreen onLogin={handleLogin} onImport={handleImport} language={language} onToggleLanguage={handleLanguageToggle} onOpenGuide={() => setIsUserGuideOpen(true)} onOpenTutorial={() => setIsTutorialOpen(true)} installPrompt={installPrompt} onInstallApp={handleInstallApp} />
        <UserGuide isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} language={language} defaultRole="student" />
        {isTutorialOpen && <TutorialPage language={language} onClose={() => setIsTutorialOpen(false)} />}
      </>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
      <div className="fixed top-0 left-0 right-0 z-[200]"><OfflineBanner /></div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ExportPinModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onConfirm={handleConfirmExport} language={language} />
      <ImportPinModal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setPendingImportFile(null); setImportTarget(null); }} onConfirm={handleConfirmImport} error={importError} />
      <UserGuide isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} language={language} defaultRole={userRole === 'admin' ? 'teacher' : userRole || 'student'} />
      {isTutorialOpen && <TutorialPage language={language} onClose={() => setIsTutorialOpen(false)} />}
      <TeacherSettingsModal isOpen={isTeacherSettingsOpen} onClose={() => setIsTeacherSettingsOpen(false)} onFactoryReset={handleFactoryReset} language={language} showToast={showToast} isAdmin={userRole === 'admin'} />
      
      {isEditingCourse && <CourseEditor course={courseToEdit} onSave={handleSaveCourse} onCancel={() => setIsEditingCourse(false)} language={language} />}
      
      {userRole === 'student' && !isLoading && Object.keys(chapterImages).length === 0 && <EmptyStateModal onImport={handleImport} onBack={handleLogout} />}
      
      {!activeCourseId && (
          <div className="flex-1 flex flex-col h-full bg-slate-50">
              <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-[50]">
                  <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 ${userRole === 'admin' ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                        {userRole === 'admin' ? <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" /> : <Book className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </div>
                    <h1 className="font-bold text-slate-800 text-sm sm:text-xl font-burmese truncate max-w-[150px] xs:max-w-none">
                        {language === 'my' ? 'သင်ရိုးရွေးချယ်ပါ' : 'Select Program'}
                    </h1>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                      <button onClick={handleLanguageToggle} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-white text-[10px] sm:text-xs font-black transition-all text-slate-600">
                          <Globe className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="hidden xs:inline">{language === 'my' ? 'MY' : 'EN'}</span>
                      </button>
                      <button onClick={() => setIsTutorialOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white" title="Tutorial">
                          <Sparkles className="w-5 h-5 text-indigo-500" />
                      </button>
                      <button onClick={() => setIsUserGuideOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white" title="User Guide">
                          <HelpCircle className="w-5 h-5 text-indigo-500" />
                      </button>
                      <label className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer" title="Import Package">
                        <Upload className="w-5 h-5" />
                        <input type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} className="hidden" />
                      </label>
                      {userRole !== 'student' && (
                        <>
                          <button onClick={handleExportAll} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white" title="Export All">
                              <Download className="w-5 h-5 text-emerald-600" />
                          </button>
                          <button onClick={() => setIsTeacherSettingsOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white" title="Settings">
                              <Settings className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <button onClick={handleLogout} className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200 bg-white" title="Logout">
                          <LogOut className="w-5 h-5" />
                      </button>
                  </div>
              </header>
              <ProgramSelector 
                  courses={courses} 
                  onSelectCourse={handleSelectCourse} 
                  language={language} 
                  isTeacher={userRole !== 'student'} 
                  onCreateCourse={handleCreateCourse} 
                  onEditCourse={handleEditCourse} 
                  onDeleteCourse={handleDeleteCourse} 
                  onExportCourse={handleExportCourse} 
                  onImportCourse={handleImportCourse}
                  chapterStats={{ images: chapterImages, diagrams: chapterDiagrams, quizzes: chapterQuizzes }}
              />
          </div>
      )}

      {activeCourseId && activeCourse && activeChapter && (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>}>
            {isSidebarOpen && !isPresentationMode && !isFocusMode && (
                <Sidebar 
                  activeChapterId={activeChapterId} 
                  onSelectChapter={setActiveChapterId} 
                  isOpen={isSidebarOpen} 
                  toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
                  onExport={() => setIsExportModalOpen(true)} 
                  onImport={handleImport} 
                  onFactoryReset={handleFactoryReset} 
                  userRole={userRole || 'student'} 
                  showToast={showToast} 
                  language={language} 
                  onOpenGuide={() => setIsUserGuideOpen(true)} 
                  installPrompt={installPrompt} 
                  onInstallApp={handleInstallApp} 
                  chapters={activeCourse.chapters} 
                  courseTitle={{ my: activeCourse.titleBurmese, en: activeCourse.titleEnglish }} 
                  onSwitchProgram={() => setActiveCourseId(null)} 
                  activeCourseId={activeCourseId} 
                  chapterStats={{ images: chapterImages, diagrams: chapterDiagrams, quizzes: chapterQuizzes }} 
                />
            )}
            <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${!isSidebarOpen || isPresentationMode || isFocusMode ? 'w-full' : ''}`}>
                {isLoading && <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center"><div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div><span className="font-burmese">Loading...</span></div></div>}
                {!isPresentationMode && !isFocusMode && (
                <header className="min-h-[56px] lg:min-h-[64px] h-auto bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-6 py-2 shadow-sm z-10 gap-2 shrink-0">
                    <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Toggle Sidebar"><Menu className="w-6 h-6" /></button>
                      <div className="hidden md:flex flex-col justify-center">
                        <h2 className="font-bold text-indigo-700 text-sm sm:text-lg font-burmese leading-[2.2]">
                          {language === 'my' ? activeChapter.titleBurmese : activeChapter.titleEnglish}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <button onClick={handleLanguageToggle} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-white text-xs font-bold transition-all text-slate-600"><Globe className="w-4 h-4 text-indigo-500" /><span>{language === 'my' ? 'MY' : 'EN'}</span></button>
                      
                      <div className="hidden md:flex items-center gap-2 pr-4 mr-4 border-r border-slate-200">
                          <button 
                            onClick={() => setActiveCourseId(null)} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm active:scale-95"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span className="font-burmese pt-0.5">{language === 'my' ? 'သင်ရိုးများသို့' : 'Programs'}</span>
                          </button>
                      </div>

                      <div className="hidden md:flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <button onClick={handlePrev} disabled={activeChapterId === activeCourse.chapters[0].id} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600" aria-label="Previous Chapter"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="flex flex-col items-center justify-center min-w-[70px]">
                          <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">{language === 'my' ? 'အခန်း' : 'Chapter'}</span>
                          <span className="text-base font-bold text-slate-700 leading-none font-burmese">{activeChapterId}</span>
                        </div>
                        <button onClick={handleNext} disabled={activeChapterId === activeCourse.chapters[activeCourse.chapters.length - 1].id} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600" aria-label="Next Chapter"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                      <button onClick={handleLogout} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full text-sm font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all"><LogOut className="w-4 h-4" /><span className="hidden sm:inline font-burmese pt-0.5">{language === 'my' ? 'ထွက်မည်' : 'Logout'}</span></button>
                    </div>
                </header>
                )}
                <div className="flex-1 overflow-hidden relative">
                {activeChapter && (
                  <ChapterView 
                    chapter={activeChapter} isPresentationMode={isPresentationMode} 
                    chapterImages={chapterImages[getScopedKey(activeChapter.id)] || []} 
                    customDiagrams={chapterDiagrams[getScopedKey(activeChapter.id)] || []} 
                    customHtml={chapterHtml[getScopedKey(activeChapter.id)]} 
                    resources={chapterResources[getScopedKey(activeChapter.id)]} 
                    quiz={chapterQuizzes[getScopedKey(activeChapter.id)]} 
                    onAddImage={(img) => handleAddImage(getScopedKey(activeChapter.id), img)} 
                    onRemoveImage={(idx) => handleRemoveImage(getScopedKey(activeChapter.id), idx)} 
                    onBulkRemoveImage={(indices) => handleBulkRemoveImages(getScopedKey(activeChapter.id), indices)} 
                    onReorderImages={(imgs) => handleReorderImages(getScopedKey(activeChapter.id), imgs)} 
                    onAddDiagram={(img) => handleAddDiagram(getScopedKey(activeChapter.id), img)} 
                    onRemoveDiagram={(idx) => handleRemoveDiagram(getScopedKey(activeChapter.id), idx)} 
                    onReorderDiagrams={(diagrams) => handleReorderDiagrams(getScopedKey(activeChapter.id), diagrams)} 
                    onClearDiagrams={() => handleClearDiagrams(getScopedKey(activeChapter.id))} 
                    onSetHtml={(html) => handleSetHtml(getScopedKey(activeChapter.id), html)} 
                    onRemoveHtml={() => handleRemoveHtml(getScopedKey(activeChapter.id))} 
                    onUpdateResources={(audio, youtube, tiktok, questions, links) => handleUpdateResources(getScopedKey(activeChapter.id), audio, youtube, tiktok, questions, links)} 
                    onUpdateKeyPoints={(keyPoints) => handleUpdateKeyPoints(activeChapter.id, keyPoints)} 
                    onUpdateSummary={(summary) => handleUpdateSummary(activeChapter.id, summary)} 
                    onSaveQuiz={(quiz) => handleSaveQuiz(getScopedKey(activeChapter.id), quiz)} 
                    isReadOnly={userRole === 'student'} 
                    canManageVisuals={userRole !== 'student'} 
                    activeTab={currentTab} 
                    onTabChange={setCurrentTab} 
                    showToast={showToast} 
                    onBulkMoveToVisual={(indices) => handleBulkMoveGalleryToVisual(activeChapter.id, indices)} 
                    onExitPresentation={() => { if (document.fullscreenElement) document.exitFullscreen(); setIsPresentationMode(false); setIsSidebarOpen(true); }} 
                    onEnterPresentation={togglePresentationMode} 
                    language={language} 
                    isFocusMode={isFocusMode} 
                    onToggleFocusMode={toggleFocusMode} 
                  />
                )}
                </div>
            </main>
        </Suspense>
      )}
    </div>
  );
}
