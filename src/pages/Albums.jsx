import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Clock,
    MessageSquare,
    ShieldAlert,
    Book,
    ArrowLeft,
    Image as ImageIcon,
    Calendar,
    Download,
    FolderOpen, Trash2
} from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';


// --- Albums Component ---
export default function Albums({ archivePath, setSelectedAlbum, selectedAlbum }) {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(null); // index into selectedAlbum.photos, or null when closed

    // Load albums whenever archivePath changes (mount, or user picks a new folder)
    useEffect(() => {
        async function loadAlbums() {
            setLoading(true);
            setError(null);
            try {
                const data = await invoke('get_albums_from_path', { basePath: archivePath });
                setAlbums(data);
            } catch (err) {
                setError(err.toString());
            } finally {
                setLoading(false);
            }
        }
        loadAlbums();
    }, [archivePath]);

    useEffect(() => {
        const handleKeydown = (e) => {
            if (lightboxIndex === null) return; // only act when lightbox is open

            if (e.key === 'Escape') {
                setLightboxIndex(null);
            } else if (e.key === 'ArrowRight') {
                setLightboxIndex((i) => (i < selectedAlbum.photos.length - 1 ? i + 1 : i));
            } else if (e.key === 'ArrowLeft') {
                setLightboxIndex((i) => (i > 0 ? i - 1 : i));
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [lightboxIndex, selectedAlbum]);

    // Prompt the user to select their unzipped Facebook export folder
    const handleSelectFolder = async () => {
        try {
            setError(null);
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: "Select your unzipped Facebook data folder"
            });

            if (!selectedDir) return; // User cancelled dialog

            setLoading(true);
            setArchivePath(selectedDir);

            // Pass the folder path directly to Rust! Note the exact parameter name: basePath
            const data = await invoke('get_albums_from_path', { basePath: selectedDir });
            setAlbums(data);
        } catch (err) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    // --- Download Helper Functions ---
    const getSafeFilename = (photo) => {
        if (!photo.timestamp) return `fb_photo_${Math.random().toString(36).substr(2, 9)}`;
        const date = new Date(photo.timestamp * 1000);
        return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    };

    const writePhotoAndMetadata = async (photo, dirPath) => {
        const filename = getSafeFilename(photo);

        try {
            // Tell Rust to natively copy the file on disk!
            await invoke('save_photo_locally', {
                sourcePath: photo.source_path,
                destDir: dirPath,
                filename: filename,
                title: photo.title || '',
                description: photo.description || '',
                timestamp: photo.timestamp || null
            });
        } catch (err) {
            console.error(`Failed to save ${filename}:`, err);
            alert(`Error saving photo: ${err}`);
        }
    };

    const handleDeleteAlbum = async () => {
        const confirmed = window.confirm(
            `Delete "${selectedAlbum.name}" and all its photos from disk?`
        );
        if (!confirmed) return;

        try {
            const photoPaths = selectedAlbum.photos.map(p => p.source_path).filter(Boolean);
            await invoke('delete_album_locally', {
                albumId: selectedAlbum.id,
                basePath: archivePath,
                photoPaths: photoPaths
            });
            setAlbums(prev => prev.filter(a => a.id !== selectedAlbum.id));
            setSelectedAlbum(null);
        } catch (err) {
            alert("Error deleting album: " + err);
        }
    };

    const handleDownloadAlbum = async () => {
        try {
            const selectedDirPath = await open({
                directory: true,
                multiple: false,
                title: "Select folder to save album"
            });
            if (!selectedDirPath) return;

            setIsDownloading(true);
            setDownloadStatus('Creating directory...');

            const safeAlbumName = selectedAlbum.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const albumDirPath = await join(selectedDirPath, safeAlbumName);
            await mkdir(albumDirPath, { recursive: true });

            for (let i = 0; i < selectedAlbum.photos.length; i++) {
                setDownloadStatus(`Saving photo ${i + 1} of ${selectedAlbum.photos.length}...`);
                await writePhotoAndMetadata(selectedAlbum.photos[i], albumDirPath);
            }

            setDownloadStatus('Download complete!');
            setTimeout(() => setDownloadStatus(''), 3000);
        } catch (err) {
            alert("Error saving album: " + err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadSinglePhoto = async (photo, e) => {
        e.stopPropagation();
        const defaultName = getSafeFilename(photo);
        const ext = photo.image_url.split('.').pop().split('?')[0] || 'jpg';
        try {
            const fullSelectedPath = await save({
                title: "Save Photo As...",
                defaultPath: `${defaultName}.${ext}`,
                filters: [{
                    name: 'Image',
                    extensions: [ext]
                }]
            });

            // If the user hits "Cancel", fullSelectedPath will be null
            if (!fullSelectedPath) return;
            const lastSlashIndex = Math.max(fullSelectedPath.lastIndexOf('/'), fullSelectedPath.lastIndexOf('\\'));
            const destDir = fullSelectedPath.substring(0, lastSlashIndex);
            const chosenFullName = fullSelectedPath.substring(lastSlashIndex + 1);

            // Strip the extension so your Rust function saves the .txt sidecar with the same base name
            const chosenBaseName = chosenFullName.replace(new RegExp(`\\.${ext}$`, 'i'), '');

            // 3. Send to Rust to perform the instant local copy
            await invoke('save_photo_locally', {
                sourcePath: photo.source_path,
                destDir: destDir,
                filename: chosenBaseName,
                title: photo.title || '',
                description: photo.description || '',
                timestamp: photo.timestamp || null
            });

            alert('Photo saved successfully!');
        } catch (err) {
            console.error(err);
        }
    };

    // ==========================================
    // VIEW 1: Detail Gallery (Inside an Album)
    // ==========================================
    const lightboxPhoto = lightboxIndex !== null ? selectedAlbum.photos[lightboxIndex] : null;
    if (selectedAlbum) {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <button
                        onClick={() => setSelectedAlbum(null)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px',
                            cursor: 'pointer', fontWeight: '500', color: '#374151'
                        }}
                    >
                        <ArrowLeft size={18} /> Back to All Albums
                    </button>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {/* Delete Album Button */}
                        <button
                            onClick={handleDeleteAlbum}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                                background: '#ef4444', border: 'none', borderRadius: '6px',
                                cursor: 'pointer', fontWeight: '500', color: '#ffffff',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                        >
                            <Trash2 size={18} /> Delete Album
                        </button>

                        {/* Existing Download Album Button */}
                        <button
                            onClick={handleDownloadAlbum}
                            disabled={isDownloading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                                background: isDownloading ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: '6px',
                                cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#ffffff'
                            }}
                        >
                            <Download size={18} />
                            {isDownloading ? downloadStatus : 'Download Album'}
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#111827' }}>{selectedAlbum.name}</h1>
                    {selectedAlbum.description && (
                        <p style={{ color: '#4b5563', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{selectedAlbum.description}</p>
                    )}
                    <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: '500' }}>
                        {selectedAlbum.photo_count} Photos
                    </span>
                </div>

                <div style={{
                    columnCount: 3,
                    columnGap: '1.5rem',
                }}>
                    {selectedAlbum.photos.map((photo, idx) => (
                        <div
                            key={idx}
                            style={{
                                breakInside: 'avoid',
                                marginBottom: '1.5rem',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}
                        >
                            <div style={{ width: '100%', position: 'relative', cursor: 'pointer' }} onClick={() => setLightboxIndex(idx)}>
                                <img
                                    src={photo.image_url}
                                    alt={photo.title || "Facebook Photo"}
                                    loading="lazy"
                                    style={{ width: '100%', height: 'auto', display: 'block' }}
                                />

                                {/* Single Photo Download Button */}
                                <button
                                    onClick={(e) => handleDownloadSinglePhoto(photo, e)}
                                    title="Download photo"
                                    style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        background: 'rgba(255, 255, 255, 0.9)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        color: '#374151'
                                    }}
                                >
                                    <Download size={16} />
                                </button>
                            </div>

                            {(photo.title || photo.description || photo.timestamp) && (
                                <div style={{ padding: '1rem' }}>
                                    {photo.timestamp && (
                                        <span style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.35rem' }}>
                                            {new Date(photo.timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    )}
                                    {photo.description && <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem', lineHeight: '1.4' }}>{photo.description}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {lightboxPhoto && (
                    <div
                        onClick={() => setLightboxIndex(null)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(0, 0, 0, 0.9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            cursor: 'zoom-out',
                            padding: '2rem',
                            boxSizing: 'border-box'
                        }}
                    >
                        <button
                            onClick={() => setLightboxIndex(null)}
                            style={{
                                position: 'absolute',
                                top: '1.5rem',
                                right: '1.5rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                color: '#fff',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>

                        {/* Wrapper so the download button can be positioned relative to the image itself */}
                        <div
                            style={{ position: 'relative', display: 'inline-block', maxWidth: '90vw', maxHeight: '85vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={lightboxPhoto.image_url}
                                alt={lightboxPhoto.title || "Facebook Photo"}
                                style={{
                                    display: 'block',
                                    maxWidth: '90vw',
                                    maxHeight: '85vh',
                                    objectFit: 'contain',
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                                    cursor: 'default'
                                }}
                            />

                            {/* Download button on the enlarged photo */}
                            <button
                                onClick={(e) => handleDownloadSinglePhoto(lightboxPhoto, e)}
                                title="Download photo"
                                style={{
                                    position: 'absolute',
                                    top: '0.75rem',
                                    right: '0.75rem',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    color: '#374151'
                                }}
                            >
                                <Download size={18} />
                            </button>
                        </div>

                        {(lightboxPhoto.title || lightboxPhoto.description) && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'absolute',
                                    bottom: '1.5rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    color: '#fff',
                                    textAlign: 'center',
                                    maxWidth: '600px',
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(0,0,0,0.5)',
                                    borderRadius: '8px'
                                }}
                            >
                                {lightboxPhoto.title && <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{lightboxPhoto.title}</strong>}
                                {lightboxPhoto.description && <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>{lightboxPhoto.description}</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // VIEW 2: Master Grid (All Albums Overview)
    // ==========================================
    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#111827' }}>Your Photo Albums</h1>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '2rem'
            }}>
                {albums.map((album) => (
                    <div
                        key={album.id}
                        onClick={() => setSelectedAlbum(album)}
                        style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            background: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                        }}
                    >
                        <div style={{ width: '100%', height: '220px', background: '#f3f4f6', position: 'relative' }}>
                            {album.cover_photo?.image_url ? (
                                <img
                                    src={album.cover_photo.image_url}
                                    alt={album.name}
                                    loading="lazy"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <ImageIcon size={48} color="#9ca3af" />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '600', color: '#111827' }}>
                                    {album.name}
                                </h3>
                                {album.description && (
                                    <p style={{
                                        fontSize: '0.9rem',
                                        color: '#6b7280',
                                        margin: '0 0 0.5rem 0',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: '1.4'
                                    }}>
                                        {album.description}
                                    </p>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                                <span>{album.photo_count} items</span>
                                {album.last_modified && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <Calendar size={14} />
                                        {new Date(album.last_modified * 1000).getFullYear()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

