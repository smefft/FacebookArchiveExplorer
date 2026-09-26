import React, { useEffect, useState } from 'react';
import { Camera, MapPin, ImageIcon, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export function useProfileMedia({ archivePath }) {
    const [state, setState] = useState({
        loading: true,
        name: null,
        profilePicturesAlbum: null,
        coverPhotos: [],
        profilePicUrl: null,
        coverPicUrl: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;
        if (!archivePath) return;

        async function load() {
            let name = null;
            let profilePicUrl = null;
            let profilePicturesAlbum = null;
            let coverPhotos = [];
            let coverPicUrl = null;
            let error = null;

            // profile pictures
            try {
                const data = await invoke('get_profile_pictures_album', { basePath: archivePath });
                profilePicturesAlbum = data ?? null;
                profilePicUrl = data.cover_photo?.image_url ?? profilePicturesAlbum?.photos[0]?.image_url ?? null;
            } catch (err) {
                error = err.toString();
            }

            // cover photos
            try {
                const data = await invoke('get_cover_photo_album', { basePath: archivePath });
                coverPhotos = data.photos ?? [];
                coverPicUrl = data.cover_photo?.image_url ?? coverPhotos[0]?.image_url ?? null;
            } catch (err) {
                error = err.toString();
            }

            if (!cancelled) {
                setState({ loading: false, name, profilePicturesAlbum, coverPhotos, profilePicUrl, coverPicUrl, error });
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [archivePath]);

    return state;
}

// --- Component ---

const TABS = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'albums', label: 'Photo Albums' },
    { id: 'videos', label: 'Videos' },
    { id: 'friends', label: 'Friends' },
];

export default function ProfileHeader({ archivePath, activeTab, setActiveTab, setSelectedAlbum, onChangeFolder }) {
    const { loading, name, profilePicturesAlbum, coverPhotos, profilePicUrl, coverPicUrl, error } = useProfileMedia({ archivePath });
    const [isChangeHovered, setIsChangeHovered] = useState(null);
    const displayName = name || 'Your Facebook Archive';
    const initial = displayName.trim().charAt(0).toUpperCase();

    const handleAvatarClick = () => {
        setActiveTab('albums');
        setSelectedAlbum(profilePicturesAlbum);
    };

    return (
        <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #dadde1' }}>
            {/* Cover photo */}
            <div
                style={{
                    position: 'relative',
                    height: '280px',
                    width: '100%',
                    background: coverPicUrl
                        ? `center / cover no-repeat url("${coverPicUrl}")`
                        : 'linear-gradient(135deg, #1877f2 0%, #6a3df5 100%)',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                }}
            >
                {!coverPicUrl && !loading && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: 'rgba(255,255,255,0.75)',
                            fontSize: '0.9rem',
                        }}
                    >
                        <Camera size={18} />
                        No cover photo found in archive
                    </div>
                )}
            </div>

            {/* Info bar: avatar overlaps the cover, name + meta sit beside/below it */}
            <div
                style={{
                    maxWidth: '940px',
                    margin: '0 auto',
                    padding: '0 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '1.25rem',
                        marginTop: '25px',
                    }}
                >
                    <div
                        onClick={handleAvatarClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleAvatarClick();
                        }}
                        style={{
                            width: '168px',
                            height: '168px',
                            borderRadius: '50%',
                            border: '4px solid #fff',
                            backgroundColor: '#e4e6eb',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {profilePicUrl ? (
                            <img
                                src={profilePicUrl}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <ImageIcon size={48} color="#9ca3af" />
                            </div>
                        )}
                    </div>

                    <div style={{ paddingBottom: '3rem' }}>
                        <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800, color: '#050505' }}>
                            {displayName}
                        </h1>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                marginTop: '2rem',
                                color: '#65676b',
                                fontSize: '0.9rem',
                            }}
                        >
                            <MapPin size={14} />
                            <span style={{ wordBreak: 'break-all' }}>{archivePath}</span>
                        </div>
                        <button
                            onClick={onChangeFolder}
                            onMouseEnter={() => setIsChangeHovered(true)}
                            onMouseLeave={() => setIsChangeHovered(false)}
                            style={{
                                marginTop: '0.6rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.4rem 0.85rem',
                                border: '1px solid #dadde1',
                                borderRadius: '20px',
                                background: isChangeHovered ? '#f0f2f5' : '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: '#050505',
                                transition: 'background-color 0.15s ease',
                            }}
                        >
                            <FolderOpen size={14} color="#65676b" />
                            Change location of data
                        </button>
                    </div>

                </div>

                {/* Tab nav, Facebook-style underline */}
                <nav
                    style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '1rem',
                        borderTop: '1px solid #dadde1',
                        paddingTop: '0.25rem',
                    }}
                >
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '0.9rem 1rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    color: isActive ? '#1877f2' : '#65676b',
                                    borderBottom: isActive ? '3px solid #1877f2' : '3px solid transparent',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div >
    );
}