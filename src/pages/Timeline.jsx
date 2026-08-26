import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Image as ImageIcon,
    Download,
    FolderOpen
} from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';


// --- Timeline Component ---
export default function Timeline({ archivePath }) {
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState(null); // index into selectedYear.photos, or null when closed

    // Load years whenever archivePath changes (mount, or user picks a new folder)
    useEffect(() => {
        async function loadYears() {
            setLoading(true);
            setError(null);
            try {
                const data = await invoke('get_photos_by_year', { basePath: archivePath });
                setYears(data);
            } catch (err) {
                setError(err.toString());
            } finally {
                setLoading(false);
            }
        }
        loadYears();
    }, [archivePath]);

    useEffect(() => {
        const handleKeydown = (e) => {
            if (lightboxIndex === null) return; // only act when lightbox is open

            if (e.key === 'Escape') {
                setLightboxIndex(null);
            } else if (e.key === 'ArrowRight') {
                setLightboxIndex((i) => (i < selectedYear.photos.length - 1 ? i + 1 : i));
            } else if (e.key === 'ArrowLeft') {
                setLightboxIndex((i) => (i > 0 ? i - 1 : i));
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [lightboxIndex, selectedYear]);

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

    const handleDownloadYear = async () => {
        try {
            const selectedDirPath = await open({
                directory: true,
                multiple: false,
                title: "Select folder to save photos"
            });
            if (!selectedDirPath) return;

            setIsDownloading(true);
            setDownloadStatus('Creating directory...');

            const safeYearName = selectedYear.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const yearDirPath = await join(selectedDirPath, safeYearName);
            await mkdir(yearDirPath, { recursive: true });

            for (let i = 0; i < selectedYear.photos.length; i++) {
                setDownloadStatus(`Saving photo ${i + 1} of ${selectedYear.photos.length}...`);
                await writePhotoAndMetadata(selectedYear.photos[i], yearDirPath);
            }

            setDownloadStatus('Download complete!');
            setTimeout(() => setDownloadStatus(''), 3000);
        } catch (err) {
            alert("Error saving photos: " + err.message);
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

            // Send to Rust to perform the instant local copy
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

    if (loading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}><p>Sorting photos by year...</p></div>;
    }

    // ==========================================
    // VIEW 1: Detail Gallery (Inside a Year)
    // ==========================================
    const lightboxPhoto = lightboxIndex !== null ? selectedYear.photos[lightboxIndex] : null;
    if (selectedYear) {
        return (
            <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <button
                        onClick={() => setSelectedYear(null)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px',
                            cursor: 'pointer', fontWeight: '500', color: '#374151'
                        }}
                    >
                        <ArrowLeft size={18} /> Back to Timeline
                    </button>

                    <button
                        onClick={handleDownloadYear}
                        disabled={isDownloading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            background: isDownloading ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: '6px',
                            cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#ffffff'
                        }}
                    >
                        <Download size={18} />
                        {isDownloading ? downloadStatus : 'Download All'}
                    </button>
                </div>

                <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#111827' }}>{selectedYear.name}</h1>
                    <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: '500' }}>
                        {selectedYear.photo_count} Photos
                    </span>
                </div>

                <div style={{
                    columnCount: 3,
                    columnGap: '1.5rem',
                }}>
                    {selectedYear.photos.map((photo, idx) => (
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
    // VIEW 2: Master Grid (All Years Overview)
    // ==========================================
    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#111827' }}>Photo Timeline</h1>
                </div>
            </div>

            {error && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '2rem'
            }}>
                {years.map((year) => (
                    <div
                        key={year.id}
                        onClick={() => setSelectedYear(year)}
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
                            {year.cover_photo?.image_url ? (
                                <img
                                    src={year.cover_photo.image_url}
                                    alt={year.name}
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
                                    {year.name}
                                </h3>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                                <span>{year.photo_count} items</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}