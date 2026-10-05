import { FolderOpen, Clock } from "lucide-react";

export default function OnboardingScreen({ handleSelectFolder }) {
    const EXPORT_STEPS = [
        'Open Settings & Privacy, then Settings',
        'Go to Accounts Center',
        'Choose \'Your Information and Permissions\'',
        'Select \'Export Your Information\', then \'Create Export\'',
        'Choose \'Export to Device\'',
        'Set \'Date Range\' to \'All Time\'',
        'Set \'Format\' to \'JSON\'',
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
            <div style={{ background: '#f3f4f6', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                <FolderOpen size={48} color="#4f46e5" />
            </div>
            <h2 style={{ fontSize: '1.8rem', color: '#f3f4f6', margin: '0 0 0.5rem 0' }}>Select Your Facebook Data Archive</h2>
            <p style={{ color: '#9ca3af', maxWidth: '450px', marginBottom: '2rem', lineHeight: '1.5' }}>
                Choose the main folder extracted from your Facebook export zip file.
            </p>
            <button
                onClick={handleSelectFolder}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}
            >
                <FolderOpen size={20} /> Open Archive Folder
            </button>

            {/* Export instructions */}
            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #2a2d38', maxWidth: '450px', width: '100%', textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#f3f4f6', margin: '0 0 0.25rem 0' }}>Don't have an export yet?</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                    Request your data from Facebook:
                </p>
                <ol style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 1.25rem 0', paddingLeft: '1.25rem' }}>
                    {EXPORT_STEPS.map((step) => (
                        <li key={step} style={{ marginBottom: '0.35rem' }}>{step}</li>
                    ))}
                </ol>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    <Clock size={16} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                    <span>
                        The export can take several days. Facebook will notify you when it's ready.
                        Download the zip, extract it, then select the extracted folder above.
                    </span>
                </div>
            </div>
        </div>
    );
}
