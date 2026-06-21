import { useEffect, useState } from 'react';
import { useStore } from './store';
import { wsClient } from './ws/client';

type Tab = 'agents' | 'permissions' | 'chat' | 'presence' | 'authority';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: '#22c55e',
    away: '#eab308',
    busy: '#f97316',
    offline: '#6b7280',
    connecting: '#3b82f6',
  };
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: colors[status] ?? '#6b7280',
    }} />
  );
}

function AgentCard({ agent }: { agent: import('./store').AgentRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: '1px solid #2a2a3a',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      background: '#1a1a24',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <StatusBadge status={agent.status} />
        <strong style={{ color: '#e0e0e0' }}>{agent.manifest.name}</strong>
        <span style={{ color: '#888', fontSize: 12 }}>v{agent.manifest.version}</span>
        <span style={{ color: '#666', fontSize: 11, marginLeft: 'auto' }}>{agent.agentId}</span>
        <span style={{ color: '#555', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
          <div>Capabilities: {agent.manifest.capabilities.join(', ') || 'none'}</div>
          <div>Session: {agent.sessionId}</div>
          <div>Connected: {new Date(agent.connectedAt).toLocaleTimeString()}</div>
          <div>Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}</div>
          {Object.keys(agent.manifest.modules ?? {}).length > 0 && (
            <div style={{ marginTop: 4 }}>
              Modules: {Object.keys(agent.manifest.modules!).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PermissionCard({ permission }: { permission: import('./store').PendingRequest }) {
  const severityColors: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };

  return (
    <div style={{
      border: '1px solid #2a2a3a',
      borderLeftWidth: 3,
      borderLeftColor: severityColors[permission.severity] ?? '#6b7280',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      background: '#1a1a24',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>{permission.severity}</span>
        <strong style={{ color: '#e0e0e0' }}>{permission.tool}</strong>
        <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto' }}>{permission.agentId}</span>
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>{permission.reason}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => wsClient.approvePermission(permission.requestId)}
          style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          Approve
        </button>
        <button
          onClick={() => wsClient.denyPermission(permission.requestId)}
          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function ChatPanel() {
  const messages = useStore((s) => s.messages);
  const [draft, setDraft] = useState('');
  const [broadcast, setBroadcast] = useState(true);

  const send = () => {
    if (!draft.trim()) return;
    wsClient.sendMessage('host', draft, undefined, broadcast);
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {messages.length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>
            No messages yet
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: '#888' }}>{msg.from}</span>
            {msg.to && <span style={{ color: '#555' }}> → {msg.to}</span>}
            {msg.broadcast && <span style={{ color: '#3b82f6' }}> [broadcast]</span>}
            <span style={{ color: '#e0e0e0', marginLeft: 8 }}>{String(msg.payload)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #2a2a3a', padding: 8, display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message..."
          style={{ flex: 1, background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 4, padding: '6px 10px', color: '#e0e0e0', fontSize: 13 }}
        />
        <button
          onClick={() => setBroadcast(!broadcast)}
          style={{ background: broadcast ? '#3b82f6' : '#2a2a3a', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}
        >
          {broadcast ? 'BCast' : 'DM'}
        </button>
        <button onClick={send} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
          Send
        </button>
      </div>
    </div>
  );
}

function PresenceBoard() {
  const presence = useStore((s) => s.presence);

  return (
    <div>
      {presence.length === 0 && (
        <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>No agents</div>
      )}
      {presence.map((p) => (
        <div key={p.agentId} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderBottom: '1px solid #1e1e2a',
        }}>
          <StatusBadge status={p.status} />
          <span style={{ color: '#e0e0e0' }}>{p.agentId}</span>
          <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto' }}>{p.status}</span>
          {p.activity && <span style={{ color: '#888', fontSize: 11 }}>{p.activity}</span>}
        </div>
      ))}
    </div>
  );
}

function AuthorityPanel() {
  const authority = useStore((s) => s.authority);

  return (
    <div>
      {authority.length === 0 && (
        <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>No authority grants</div>
      )}
      {authority.map((g) => (
        <div key={g.grantId} style={{
          border: '1px solid #2a2a3a',
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
          background: '#1a1a24',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888', fontSize: 12 }}>{g.fromAgentId}</span>
            <span style={{ color: '#555', fontSize: 12 }}>→</span>
            <span style={{ color: '#888', fontSize: 12 }}>{g.toAgentId}</span>
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
            Tools: {g.scope.tools?.join(', ') || 'all'}
          </div>
          <div style={{ fontSize: 11, color: '#555' }}>
            {g.expiresAt ? `Expires: ${new Date(g.expiresAt).toLocaleString()}` : 'No expiry'}
          </div>
          <button
            onClick={() => wsClient.revokeAuthority(g.grantId)}
            style={{ marginTop: 6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}
          >
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>('agents');
  const agents = useStore((s) => s.agents);
  const pendingPermissions = useStore((s) => s.pendingPermissions);
  const connected = useStore((s) => s.connected);

  useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'agents', label: 'Agents', badge: agents.filter((a) => a.status !== 'offline').length },
    { id: 'permissions', label: 'Permissions', badge: pendingPermissions.length },
    { id: 'chat', label: 'Chat' },
    { id: 'presence', label: 'Presence' },
    { id: 'authority', label: 'Authority' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#16161e',
        borderBottom: '1px solid #2a2a3a',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>SuperHive</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? '#2a2a3a' : 'transparent',
                color: tab === t.id ? '#e0e0e0' : '#888',
                border: 'none',
                borderRadius: 4,
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 13,
                position: 'relative',
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 2,
                  right: 4,
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '0 4px',
                  fontSize: 10,
                  minWidth: 16,
                  textAlign: 'center',
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={connected ? 'online' : 'offline'} />
          <span style={{ fontSize: 11, color: connected ? '#22c55e' : '#ef4444' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'agents' && (
          <div>
            {agents.length === 0 && (
              <div style={{ color: '#555', textAlign: 'center', marginTop: 60 }}>
                No agents connected. Start an agent with the communication module to see it here.
              </div>
            )}
            {agents.map((a) => <AgentCard key={a.agentId} agent={a} />)}
          </div>
        )}
        {tab === 'permissions' && (
          <div>
            {pendingPermissions.length === 0 && (
              <div style={{ color: '#555', textAlign: 'center', marginTop: 60 }}>
                No pending permission requests.
              </div>
            )}
            {pendingPermissions.map((p) => <PermissionCard key={p.requestId} permission={p} />)}
          </div>
        )}
        {tab === 'chat' && <ChatPanel />}
        {tab === 'presence' && <PresenceBoard />}
        {tab === 'authority' && <AuthorityPanel />}
      </div>
    </div>
  );
}

export default App;
