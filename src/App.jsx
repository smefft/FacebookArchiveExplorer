import React, { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import Albums from './pages/Albums';
import Videos from './pages/Videos';
import Timeline from './pages/Timeline';
import ProfileHeader from './components/ProfileHeader';

// --- Main App Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState('timeline');
  const [archivePath, setArchivePath] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
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

  // Archive is selected -> render the profile-style app
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f0f2f5' }}>
      <ProfileHeader archivePath={archivePath} activeTab={activeTab} setActiveTab={setActiveTab} setSelectedAlbum={setSelectedAlbum} onChangeFolder={handleSelectFolder} />

      <div style={{ maxWidth: '940px', margin: '0 auto', padding: '1.5rem' }}>
        {activeTab === 'albums' && <Albums archivePath={archivePath} setSelectedAlbum={setSelectedAlbum} selectedAlbum={selectedAlbum} />}
        {activeTab === 'videos' && <Videos archivePath={archivePath} />}
        {activeTab === 'timeline' && <Timeline archivePath={archivePath} />}
      </div>

      <div style={{ maxWidth: '940px', margin: '0 auto', padding: '0 1.5rem 1.5rem', textAlign: 'right' }}>
        <button
          onClick={handleChangeFolder}
          style={{
            padding: '0.5rem 0.9rem',
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
    </div>
  );
}