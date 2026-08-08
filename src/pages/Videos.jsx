import React, { useState, useEffect } from 'react';
import {
    Video as VideoIcon,
    Calendar,
    Download,
    FolderOpen,
    Play
} from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

// --- Videos Component ---
export default function Videos({ archivePath, onChangeFolder }) {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [downloadStatus, setDownloadStatus] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    // Load videos whenever archivePath changes (mount, or user picks a new folder)
    useEffect(() => {
        async function loadVideos() {
            setLoading(true);
            setError(null);
            try {
                const data = await invoke('get_videos_from_path', { basePath: archivePath });
                setVideos(data);
            } catch (err) {
                setError(err.toString());
            } finally {
                setLoading(false);
            }
        }
        if (archivePath) loadVideos();
    }, [archivePath]);

    useEffect(() => {
        const handleKeydown = (e) => {
            if (lightboxIndex === null) return;
            if (e.key === 'Escape') {
                setLightboxIndex(null);
            } else if (e.key === 'ArrowRight') {
                setLightboxIndex((i) => (i < videos.length - 1 ? i + 1 : i));
            } else if (e.key === 'ArrowLeft') {
                setLightboxIndex((i) => (i > 0 ? i - 1 : i));
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [lightboxIndex, videos]);

    // Rust builds video_url as "asset://localhost/<absolute path>" — strip that
    // prefix to recover a real filesystem path for commands that need to copy the file.
    const getSourcePath = (video) => {
        return decodeURIComponent(video.video_url.replace('asset://localhost/', ''));
    };

    const getSafeFilename = (video) => {
        if (!video.timestamp) return `fb_video_${Math.random().toString(36).substr(2, 9)}`;
        const date = new Date(video.timestamp * 1000);
        return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    };

    const getExtension = (video) => {
        const path = getSourcePath(video);
        return path.split('.').pop().split('?')[0] || 'mp4';
    };

    const handleDownloadSingleVideo = async (video, e) => {
        e.stopPropagation();
        const sourcePath = getSourcePath(video);
        const defaultName = getSafeFilename(video);
        const ext = getExtension(video);

        try {
            const fullSelectedPath = await save({
                title: "Save Video As...",
                defaultPath: `${defaultName}.${ext}`,
                filters: [{ name: 'Video', extensions: [ext] }]
            });

            if (!fullSelectedPath) return; // User cancelled
            const lastSlashIndex = Math.max(fullSelectedPath.lastIndexOf('/'), fullSelectedPath.lastIndexOf('\\'));
            const destDir = fullSelectedPath.substring(0, lastSlashIndex);
            const chosenFullName = fullSelectedPath.substring(lastSlashIndex + 1);
            const chosenBaseName = chosenFullName.replace(new RegExp(`\\.${ext}$`, 'i'), '');

            await invoke('save_video_locally', {
                sourcePath: sourcePath,
                destDir: destDir,
                filename: chosenBaseName,
                description: video.description || '',
                timestamp: video.timestamp || null
            });

            alert('Video saved successfully!');
        } catch (err) {
            console.error(err);
            alert(`Error saving video: ${err}`);
        }
    };

    const handleDownloadAllVideos = async () => {
        try {
            const selectedDirPath = await open({
                directory: true,
                multiple: false,
                title: "Select folder to save videos"
            });
            if (!selectedDirPath) return;

            setIsDownloading(true);

            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                setDownloadStatus(`Saving video ${i + 1} of ${videos.length}...`);
                const filename = getSafeFilename(video);
                await invoke('save_video_locally', {
                    sourcePath: getSourcePath(video),
                    destDir: selectedDirPath,
                    filename: filename,
                    description: video.description || '',
                    timestamp: video.timestamp || null
                });
            }

            setDownloadStatus('Download complete!');
            setTimeout(() => setDownloadStatus(''), 3000);
        } catch (err) {
            alert("Error saving videos: " + err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    // ==========================================
    // VIEW 0: Initial Onboarding / Folder Selection
    // ==========================================
    if (!archivePath) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', padding: '2rem', textAlign: 'center' }}>
                <div style={{ background: '#f3f4f6', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                    <FolderOpen size={48} color="#4f46e5" />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: '#111827', margin: '0 0 0.5rem 0' }}>Select Your Facebook Data Archive</h2>
                <p style={{ color: '#6b7280', maxWidth: '450px', marginBottom: '2rem', lineHeight: '1.5' }}>
                    Choose the main folder that was extracted from your Facebook export zip file.
                </p>
                {error && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', maxWidth: '500px', fontSize: '0.9rem' }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}
            </div>
        );
    }

    if (loading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}><p>Scanning local video archive...</p></div>;
    }

    if (error) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem' }}>
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    const lightboxVideo = lightboxIndex !== null ? videos[lightboxIndex] : null;

    // ==========================================
    // MAIN VIEW: Video Grid
    // ==========================================
    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#111827' }}>Your Videos</h1>
                    <p style={{ color: '#6b7280', margin: 0, fontSize: '0.95rem' }}>
                        {videos.length} videos &middot; Reading from: <code style={{ background: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{archivePath}</code>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={handleDownloadAllVideos}
                        disabled={isDownloading || videos.length === 0}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            background: isDownloading ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: '6px',
                            cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#fff', fontSize: '0.85rem'
                        }}
                    >
                        <Download size={16} />
                        {isDownloading ? downloadStatus : 'Download All'}
                    </button>
                    <button
                        onClick={() => onChangeFolder && onChangeFolder()}
                        style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        Change Folder
                    </button>
                </div>
            </div>

            {videos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#9ca3af' }}>
                    <VideoIcon size={48} style={{ marginBottom: '1rem' }} />
                    <p>No videos found in this archive.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {videos.map((video, idx) => (
                        <div
                            key={video.video_url || idx}
                            onClick={() => setLightboxIndex(idx)}
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                background: '#000',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', background: '#111827' }}>
                                {video.thumbnail_url ? (
                                    <img src={video.thumbnail_url} alt={video.description} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <video src={video.video_url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}

                                <div style={{
                                    position: 'absolute', inset: 0, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(0,0,0,0.25)'
                                }}>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.9)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Play size={22} color="#111827" fill="#111827" style={{ marginLeft: '2px' }} />
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => handleDownloadSingleVideo(video, e)}
                                    title="Download video"
                                    style={{
                                        position: 'absolute', top: '0.5rem', right: '0.5rem',
                                        background: 'rgba(255, 255, 255, 0.9)', border: 'none',
                                        borderRadius: '50%', width: '32px', height: '32px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#374151'
                                    }}
                                >
                                    <Download size={16} />
                                </button>
                            </div>

                            {(video.description || video.timestamp) && (
                                <div style={{ padding: '1rem', background: '#fff' }}>
                                    {video.timestamp && (
                                        <span style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                                            <Calendar size={13} />
                                            {new Date(video.timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    )}
                                    {video.description && (
                                        <p style={{
                                            margin: 0, color: '#4b5563', fontSize: '0.9rem', lineHeight: '1.4',
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                        }}>
                                            {video.description}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox / Player */}
            {lightboxVideo && (
                <div
                    onClick={() => setLightboxIndex(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                        background: 'rgba(0, 0, 0, 0.9)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out', padding: '2rem', boxSizing: 'border-box'
                    }}
                >
                    <button
                        onClick={() => setLightboxIndex(null)}
                        style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem',
                            background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '50%',
                            width: '40px', height: '40px', color: '#fff', fontSize: '1.5rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        ×
                    </button>

                    <div
                        style={{ position: 'relative', display: 'inline-block', maxWidth: '90vw', maxHeight: '85vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <video
                            src={lightboxVideo.video_url}
                            controls
                            autoPlay
                            style={{
                                display: 'block', maxWidth: '90vw', maxHeight: '80vh',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                            }}
                        />

                        <button
                            onClick={(e) => handleDownloadSingleVideo(lightboxVideo, e)}
                            title="Download video"
                            style={{
                                position: 'absolute', top: '0.75rem', right: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.9)', border: 'none', borderRadius: '50%',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', color: '#374151'
                            }}
                        >
                            <Download size={18} />
                        </button>
                    </div>

                    {lightboxVideo.description && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                                color: '#fff', textAlign: 'center', maxWidth: '600px', padding: '0.75rem 1.5rem',
                                background: 'rgba(0,0,0,0.5)', borderRadius: '8px'
                            }}
                        >
                            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>{lightboxVideo.description}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}