import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Users, ArrowUpDown, Calendar } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// --- Friends Component ---
export default function Friends({ archivePath }) {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 'name' | 'timestamp'
    const [sortKey, setSortKey] = useState('timestamp');
    // true = ascending, false = descending
    const [sortAsc, setSortAsc] = useState(false);

    const scrollContainerRef = useRef(null);
    const sectionRefs = useRef({}); // { [groupKey]: HTMLElement }

    useEffect(() => {
        async function loadFriends() {
            setLoading(true);
            setError(null);
            try {
                const data = await invoke('get_friends_from_path', { basePath: archivePath });
                setFriends(data);
            } catch (err) {
                setError(err.toString());
            } finally {
                setLoading(false);
            }
        }
        loadFriends();
    }, [archivePath]);

    // Compute the "group key" for a friend based on current sort mode
    const getGroupKey = (friend) => {
        if (sortKey === 'name') {
            const first = (friend.name || '').trim().charAt(0).toUpperCase();
            return /[A-Z]/.test(first) ? first : '#';
        } else {
            return friend.timestamp
                ? new Date(friend.timestamp * 1000).getFullYear().toString()
                : 'Unknown';
        }
    };

    const sortedFriends = useMemo(() => {
        const list = [...friends];

        list.sort((a, b) => {
            let result = 0;

            if (sortKey === 'name') {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                result = nameA.localeCompare(nameB);
            } else {
                const tsA = a.timestamp ?? 0;
                const tsB = b.timestamp ?? 0;
                result = tsA - tsB;
            }

            return sortAsc ? result : -result;
        });

        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friends, sortKey, sortAsc]);

    // Group the sorted list into ordered sections { key, friends: [...] }
    const groupedSections = useMemo(() => {
        const map = new Map();
        for (const friend of sortedFriends) {
            const key = getGroupKey(friend);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(friend);
        }
        return Array.from(map.entries()).map(([key, list]) => ({ key, friends: list }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortedFriends, sortKey]);

    // Full alphabet for the sidebar when sorting by name (dims letters with no matches)
    const sidebarItems = useMemo(() => {
        if (sortKey === 'name') {
            const present = new Set(groupedSections.map((s) => s.key));
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
            return letters.map((l) => ({ key: l, active: present.has(l) }));
        } else {
            // Years already come out in sorted order from groupedSections
            return groupedSections.map((s) => ({ key: s.key, active: true }));
        }
    }, [groupedSections, sortKey]);

    const handleSortClick = (key) => {
        if (sortKey === key) {
            setSortAsc((prev) => !prev);
        } else {
            setSortKey(key);
            setSortAsc(key === 'name');
        }
    };

    const jumpToSection = (key) => {
        const el = sectionRefs.current[key];
        if (el && scrollContainerRef.current) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const sortButtonStyle = (key) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        background: sortKey === key ? '#2563eb' : '#ffffff',
        color: sortKey === key ? '#ffffff' : '#374151',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '0.9rem'
    });

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                Loading friends...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                {error}
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '2rem', color: '#111827' }}>Your Friends</h1>
                    <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: '500' }}>
                        {friends.length} total
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => handleSortClick('name')} style={sortButtonStyle('name')}>
                        <Users size={16} />
                        Name
                        {sortKey === 'name' && (
                            <ArrowUpDown size={14} style={{ transform: sortAsc ? 'none' : 'scaleY(-1)' }} />
                        )}
                    </button>

                    <button onClick={() => handleSortClick('timestamp')} style={sortButtonStyle('timestamp')}>
                        <Calendar size={16} />
                        Date Added
                        {sortKey === 'timestamp' && (
                            <ArrowUpDown size={14} style={{ transform: sortAsc ? 'none' : 'scaleY(-1)' }} />
                        )}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                {/* Scrollable friend list */}
                <div
                    ref={scrollContainerRef}
                    style={{
                        flex: 1,
                        maxHeight: '70vh',
                        overflowY: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        background: '#fff',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                    }}
                >
                    {groupedSections.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                            No friends found.
                        </div>
                    ) : (
                        groupedSections.map((section) => (
                            <div
                                key={section.key}
                                ref={(el) => { sectionRefs.current[section.key] = el; }}
                            >
                                <div style={{
                                    position: 'sticky',
                                    top: 0,
                                    background: '#f9fafb',
                                    padding: '0.5rem 1.25rem',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    color: '#6b7280',
                                    letterSpacing: '0.05em',
                                    borderBottom: '1px solid #e5e7eb',
                                    borderTop: '1px solid #e5e7eb'
                                }}>
                                    {section.key}
                                </div>

                                {section.friends.map((friend, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.9rem 1.25rem',
                                            borderBottom: '1px solid #f3f4f6',
                                            background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                                        }}
                                    >
                                        <span style={{ fontWeight: '500', color: '#111827', fontSize: '0.95rem' }}>
                                            {friend.name || 'Unknown'}
                                        </span>
                                        {friend.timestamp && (
                                            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                                {new Date(friend.timestamp * 1000).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* Jump sidebar */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: sortKey === 'name' ? '0.15rem' : '0.4rem',
                    padding: '0.5rem 0.35rem',
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    flexShrink: 0
                }}>
                    {sidebarItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => item.active && jumpToSection(item.key)}
                            disabled={!item.active}
                            title={item.active ? `Jump to ${item.key}` : undefined}
                            style={{
                                width: sortKey === 'name' ? '22px' : 'auto',
                                minWidth: sortKey === 'name' ? '22px' : '42px',
                                padding: sortKey === 'name' ? 0 : '0.25rem 0.5rem',
                                height: sortKey === 'name' ? '18px' : 'auto',
                                border: 'none',
                                background: 'transparent',
                                color: item.active ? '#2563eb' : '#d1d5db',
                                fontWeight: '600',
                                fontSize: sortKey === 'name' ? '0.7rem' : '0.8rem',
                                cursor: item.active ? 'pointer' : 'default',
                                borderRadius: '4px',
                                lineHeight: 1
                            }}
                            onMouseEnter={(e) => { if (item.active) e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            {item.key}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}