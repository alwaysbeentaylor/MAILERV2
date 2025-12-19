import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/inbox', label: 'Inbox', icon: '📬' },
  { href: '/batch', label: 'Batch', icon: '📦' },
  { href: '/campaigns', label: 'Campagnes', icon: '🚀' },
  { href: '/enrich', label: 'Enricher', icon: '🔍' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/warmup', label: 'Warm-up', icon: '🔥' },
  { href: '/dashboard', label: 'Dashboard', icon: '📈' },
  { href: '/templates', label: 'Templates', icon: '🎨' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Navigation({ dark = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState({ sent: 0 });
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load sent count
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/jobs?stats=true');
        const data = await res.json();
        if (data.success && data.stats) {
          setStats({ sent: data.stats.emailsSent || 0 });
        }
      } catch (e) {
        // Silent fail
      }
    }
    loadStats();

    // Listen for updates from other components
    const handleStatsUpdate = () => loadStats();
    window.addEventListener('statsUpdated', handleStatsUpdate);
    return () => window.removeEventListener('statsUpdated', handleStatsUpdate);
  }, []);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [router.pathname]);

  return (
    <>
      <nav className={`nav-container ${dark ? 'theme-dark' : 'theme-light'}`}>
        <div className="nav-glass">
          {/* Quick Links (visible items) */}
          <div className="nav-links">
            {navItems.slice(0, 6).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${router.pathname === item.href ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {router.pathname === item.href && <span className="active-glow"></span>}
              </Link>
            ))}
          </div>

          <div className="nav-actions">
            {/* Sent Counter */}
            <div className="stats-pill">
              <span className="stat-value">{stats.sent}</span>
              <span className="stat-label">SENT</span>
              <span className="status-pulse"></span>
            </div>

            {/* Dropdown Menu */}
            <div className="dropdown-wrapper" ref={dropdownRef}>
              <button
                className={`menu-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Menu"
              >
                <span className="menu-icon-lines"></span>
              </button>

              <div className={`dropdown-menu ${isOpen ? 'visible' : ''}`}>
                <div className="dropdown-glass">
                  <div className="dropdown-header">Navigatie</div>
                  <div className="dropdown-grid">
                    {navItems.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`dropdown-item ${router.pathname === item.href ? 'active' : ''}`}
                      >
                        <div className="item-content">
                          <span className="item-icon">{item.icon}</span>
                          <span className="item-label">{item.label}</span>
                        </div>
                        {router.pathname === item.href && <span className="item-dot"></span>}
                      </Link>
                    ))}
                    <div className="dropdown-divider"></div>
                    <button
                      className="dropdown-item logout-item"
                      onClick={async () => {
                        await fetch('/api/auth/logout');
                        router.push('/login');
                      }}
                    >
                      <div className="item-content">
                        <span className="item-icon">🚪</span>
                        <span className="item-label">Uitloggen</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <style jsx>{`
        .dropdown-divider {
          height: 1px;
          background: var(--nav-border);
          margin: 8px 0;
        }

        .logout-item {
          width: 100%;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          color: #ef4444 !important;
        }

        .logout-item:hover {
          background: rgba(239, 68, 68, 0.1) !important;
        }
        /* Theme Variables */
        .theme-dark {
          --nav-bg: rgba(15, 23, 42, 0.6);
          --nav-border: rgba(255, 255, 255, 0.08);
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --hover-bg: rgba(255, 255, 255, 0.05);
          --active-bg: rgba(59, 130, 246, 0.15);
          --active-text: #60a5fa;
          --dropdown-bg: rgba(15, 23, 42, 0.95);
          --pill-bg: rgba(15, 23, 42, 0.4);
          --pill-border: rgba(34, 197, 94, 0.2);
          --glass-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .theme-light {
          --nav-bg: rgba(255, 255, 255, 0.8);
          --nav-border: rgba(226, 232, 240, 0.8);
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --hover-bg: rgba(241, 245, 249, 0.8);
          --active-bg: rgba(59, 130, 246, 0.1);
          --active-text: #2563eb;
          --dropdown-bg: rgba(255, 255, 255, 0.95);
          --pill-bg: rgba(240, 253, 244, 0.8);
          --pill-border: rgba(34, 197, 94, 0.2);
          --glass-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }

        .nav-container {
          position: sticky;
          top: 0;
          z-index: 100;
          padding: 12px 24px;
          margin-bottom: 0;
          width: 100%;
        }

        .nav-glass {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 6px 6px 12px;
          background: var(--nav-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--nav-border);
          border-radius: 16px;
          box-shadow: var(--glass-shadow);
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 10px;
          text-decoration: none;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .nav-item:hover {
          color: var(--text-primary);
          background: var(--hover-bg);
          transform: translateY(-1px);
        }

        .nav-item.active {
          color: var(--active-text);
          background: var(--active-bg);
          font-weight: 600;
        }

        .active-glow {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20%;
          height: 2px;
          background: var(--active-text);
          border-radius: 2px 2px 0 0;
          box-shadow: 0 -2px 8px var(--active-text);
        }

        .nav-icon { font-size: 16px; }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Stats Pill */
        .stats-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--pill-bg);
          border: 1px solid var(--pill-border);
          border-radius: 99px;
          transition: transform 0.2s;
        }

        .stats-pill:hover {
          transform: scale(1.02);
        }

        .stat-value {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          color: #22c55e;
          font-size: 14px;
        }

        .stat-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #22c55e;
          opacity: 0.8;
        }

        .status-pulse {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
          animation: pulse-green 2s infinite;
        }

        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        /* Menu Trigger */
        .dropdown-wrapper {
          position: relative;
        }

        .menu-trigger {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid var(--nav-border);
          background: var(--hover-bg);
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-primary);
        }

        .menu-trigger:hover, .menu-trigger.open {
          background: var(--active-bg);
          border-color: var(--active-text);
          color: var(--active-text);
        }

        .menu-icon-lines {
          position: relative;
          width: 16px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .menu-icon-lines::before,
        .menu-icon-lines::after {
          content: '';
          position: absolute;
          left: 0;
          width: 16px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .menu-icon-lines::before { transform: translateY(-5px); }
        .menu-icon-lines::after { transform: translateY(5px); }

        .menu-trigger.open .menu-icon-lines { background: transparent; }
        .menu-trigger.open .menu-icon-lines::before { transform: translateY(0) rotate(45deg); }
        .menu-trigger.open .menu-icon-lines::after { transform: translateY(0) rotate(-45deg); }

        /* Dropdown Menu */
        .dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          min-width: 300px;
          transform-origin: top right;
          transform: scale(0.95) translateY(-10px);
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1000;
        }

        .dropdown-menu.visible {
          transform: scale(1) translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        .dropdown-glass {
          background: var(--dropdown-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--nav-border);
          border-radius: 16px;
          padding: 8px;
          box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.4);
        }

        .dropdown-header {
          padding: 12px 16px 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-secondary);
          opacity: 0.8;
        }

        .dropdown-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 10px;
          text-decoration: none;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .dropdown-item:hover {
          background: var(--hover-bg);
          transform: translateX(4px);
        }

        .dropdown-item.active {
          background: var(--active-bg);
          color: var(--active-text);
        }

        .item-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .item-icon { font-size: 18px; width: 24px; text-align: center; }
        .item-label { font-size: 14px; font-weight: 500; }

        .item-dot {
          width: 6px;
          height: 6px;
          background: var(--active-text);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--active-text);
        }

        @media (max-width: 1024px) {
          .nav-links { display: none; }
          .nav-glass { padding: 8px 12px; }
        }
      `}</style>
    </>
  );
}
