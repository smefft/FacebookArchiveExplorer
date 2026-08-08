import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Clock, MessageSquare, ShieldAlert, Book, FolderOpen, Video } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import Albums from './pages/Albums';
import Videos from './pages/Videos';

// --- Sidebar Component ---
function Sidebar({ activeTab, setActiveTab, archivePath, onChangeFolder }) {
  const navItems = [
    //{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'albums', label: 'Photo Albums', icon: Book },
    { id: 'videos', label: 'Videos', icon: Video }
    //{ id: 'timeline', label: 'Memory Timeline', icon: Clock },
    //{ id: 'messenger', label: 'Local Messenger', icon: MessageSquare },
    //{ id: 'privacy', label: 'Off-Facebook Apps', icon: ShieldAlert },
  ];

  return (
    <aside style={{ width: '260px', borderRight: '1px solid #e5e7eb', height: '100vh', padding: '1.5rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem', color: '#111827' }}>FB Archive Viewer</h2>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                border: 'none',
                background: isActive ? '#f3f4f6' : 'transparent',
                color: isActive ? '#111827' : '#4b5563',
                cursor: 'pointer',
                borderRadius: '8px',
                textAlign: 'left',
                fontWeight: isActive ? '600' : '500',
                transition: 'background 0.2s',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={20} color={isActive ? '#3b82f6' : '#6b7280'} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.5rem 0', wordBreak: 'break-all' }}>
          {archivePath}
        </p>
        <button
          onClick={onChangeFolder}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: '#374151'
          }}
        >
          Change Folder
        </button>
      </div>
    </aside>
  );
}

// --- Main App Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState('albums');
  const [archivePath, setArchivePath] = useState(null);
  const [isLoadingPath, setIsLoadingPath] = useState(true);
  const [store, setStore] = useState(null);

  // On startup: open the store file and check for a saved path
  useEffect(() => {
    async function init() {
      const s = await load('settings.json', { autoSave: true });
      setStore(s);

      const savedPath = await s.get('archivePath');
      if (savedPath) {
        setArchivePath(savedPath);
      }
      setIsLoadingPath(false);
    }
    init();
  }, []);

  const handleSelectFolder = async () => {
    const selectedDir = await open({
      directory: true,
      multiple: false,
      title: "Select your unzipped Facebook data folder"
    });
    if (!selectedDir) return;

    setArchivePath(selectedDir);
    await store.set('archivePath', selectedDir);
    await store.save(); // persist to disk immediately
  };

  const handleChangeFolder = async () => {
    setArchivePath(null);
    await store.delete('archivePath');
    await store.save();
  };

  // Still figuring out if we have a saved path — avoid flashing the picker
  if (isLoadingPath) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  // No archive selected yet -> onboarding screen, blocks the whole app
  if (!archivePath) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ background: '#f3f4f6', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
          <FolderOpen size={48} color="#4f46e5" />
        </div>
        <h2 style={{ fontSize: '1.8rem', color: '#111827', margin: '0 0 0.5rem 0' }}>Select Your Facebook Data Archive</h2>
        <p style={{ color: '#6b7280', maxWidth: '450px', marginBottom: '2rem', lineHeight: '1.5' }}>
          Choose the main folder extracted from your Facebook export zip file.
        </p>
        <button
          onClick={handleSelectFolder}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}
        >
          <FolderOpen size={20} /> Open Archive Folder
        </button>
      </div>
    );
  }

  // Archive is selected -> render the real app
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f9fafb' }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} archivePath={archivePath} onChangeFolder={handleChangeFolder} />
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        {activeTab === 'albums' && <Albums archivePath={archivePath} onChangeFolder={handleChangeFolder} />}
        {activeTab === 'videos' && <Videos archivePath={archivePath} onChangeFolder={handleChangeFolder} />}

      </main>
    </div>
  );
}