import React from 'react';
import { LayoutDashboard, Clock, MessageSquare, ShieldAlert, Book } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
    const navItems = [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'albums', label: 'Photo Albums', icon: Book },
        { id: 'timeline', label: 'Memory Timeline', icon: Clock },
        { id: 'messenger', label: 'Local Messenger', icon: MessageSquare },
        { id: 'privacy', label: 'Off-Facebook Apps', icon: ShieldAlert },
    ];

    return (
        <aside style={{ width: '250px', borderRight: '1px solid #e5e7eb', height: '100vh', padding: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem' }}>FB Archive Viewer</h2>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                border: 'none',
                                background: activeTab === item.id ? '#f3f4f6' : 'transparent',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                textAlign: 'left',
                                fontWeight: activeTab === item.id ? '600' : '400'
                            }}
                        >
                            <Icon size={20} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}