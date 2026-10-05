import React, { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import Albums from './pages/Albums';
import Friends from './pages/Friends';
import Videos from './pages/Videos';
import Timeline from './pages/Timeline';
import ProfileHeader from './components/ProfileHeader';
import OnboardingScreen from './components/OnboardingScreen';

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
    return <OnboardingScreen handleSelectFolder={handleSelectFolder} />
  }

  // Archive is selected -> render the profile-style app
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f0f2f5' }}>
      <ProfileHeader archivePath={archivePath} activeTab={activeTab} setActiveTab={setActiveTab} setSelectedAlbum={setSelectedAlbum} onChangeFolder={handleSelectFolder} />

      <div style={{ maxWidth: '940px', margin: '0 auto', padding: '1.5rem' }}>
        {activeTab === 'albums' && <Albums archivePath={archivePath} setSelectedAlbum={setSelectedAlbum} selectedAlbum={selectedAlbum} />}
        {activeTab === 'videos' && <Videos archivePath={archivePath} />}
        {activeTab === 'timeline' && <Timeline archivePath={archivePath} />}
        {activeTab === 'friends' && <Friends archivePath={archivePath} />}
      </div>
    </div>
  );
}