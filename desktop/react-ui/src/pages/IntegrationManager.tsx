/**
 * Integration Manager Component
 * Main UI for managing integrations
 */

import React, { useCallback, useEffect, useState } from 'react';
import IntegrationAPI from '../services/integrations.api';
import { Integration, IntegrationProvider } from '../types/integration.types';
import './IntegrationManager.css';

type BrowserTab = {
  id: string;
  title: string;
  url: string;
  type: string;
};

type EmailMessage = {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  date?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
};

type Toast = {
  id: number;
  message: string;
  tone: 'success' | 'info';
};

export const IntegrationManager: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [availableProviders, setAvailableProviders] = useState<IntegrationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingType, setConnectingType] = useState<string | null>(null);

  // Browser panel state
  const [selectedBrowserIntegrationId, setSelectedBrowserIntegrationId] = useState('');
  const [browserHealth, setBrowserHealth] = useState<string>('unknown');
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([]);
  const [browserUrl, setBrowserUrl] = useState('');
  const [browserExpression, setBrowserExpression] = useState('document.title');
  const [selectedTabId, setSelectedTabId] = useState('');
  const [browserEvalResult, setBrowserEvalResult] = useState('');
  const [browserBusy, setBrowserBusy] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);

  // Email panel state
  const [selectedEmailIntegrationId, setSelectedEmailIntegrationId] = useState('');
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [emailUnreadCount, setEmailUnreadCount] = useState<number | null>(null);
  const [emailSearch, setEmailSearch] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Calendar panel state
  const [selectedCalendarIntegrationId, setSelectedCalendarIntegrationId] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onOAuthMessage = (event: MessageEvent) => {
      if (event?.data?.type !== 'elixi-oauth-complete') {
        return;
      }
      void loadData();
      pushToast('Integration connected');
    };

    window.addEventListener('message', onOAuthMessage);
    return () => {
      window.removeEventListener('message', onOAuthMessage);
    };
  }, [pushToast]);

  useEffect(() => {
    const browserConnected = integrations.filter((integration) => integration.type === 'browser' && integration.status === 'connected');
    const emailConnected = integrations.filter((integration) => integration.type === 'email' && integration.status === 'connected');
    const calendarConnected = integrations.filter((integration) => integration.type === 'calendar' && integration.status === 'connected');

    if (browserConnected.length > 0 && !browserConnected.some((integration) => integration.id === selectedBrowserIntegrationId)) {
      setSelectedBrowserIntegrationId(browserConnected[0].id);
    }

    if (emailConnected.length > 0 && !emailConnected.some((integration) => integration.id === selectedEmailIntegrationId)) {
      setSelectedEmailIntegrationId(emailConnected[0].id);
    }

    if (calendarConnected.length > 0 && !calendarConnected.some((integration) => integration.id === selectedCalendarIntegrationId)) {
      setSelectedCalendarIntegrationId(calendarConnected[0].id);
    }
  }, [integrations, selectedBrowserIntegrationId, selectedCalendarIntegrationId, selectedEmailIntegrationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [integrations, providers] = await Promise.all([
        IntegrationAPI.getIntegrations(),
        IntegrationAPI.getAvailableProviders(),
      ]);
      setIntegrations(integrations);
      setAvailableProviders(providers);
      setError(null);
    } catch (err) {
      setError('Failed to load integrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (type: string) => {
    try {
      setConnectingType(type);
      const result = await IntegrationAPI.startConnect(type as any);

      if (result.type === 'oauth' && result.authUrl) {
        // Open OAuth flow in browser
        window.open(result.authUrl, 'oauth-window', 'width=500,height=600');
        pushToast(`${type} OAuth started`);
      } else if (result.type === 'manual') {
        // TODO: Show manual auth modal
        console.log('Manual auth fields:', result.fields);
        pushToast(`${type} requires manual auth`, 'info');
      }
    } catch (err) {
      setError(`Failed to connect ${type}`);
      console.error(err);
    } finally {
      setConnectingType(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!window.confirm('Are you sure you want to disconnect this integration?')) {
      return;
    }

    try {
      await IntegrationAPI.disconnect(id);
      await loadData();
      pushToast('Integration disconnected');
    } catch (err) {
      setError('Failed to disconnect integration');
      console.error(err);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await IntegrationAPI.sync(id);
      await loadData();
      pushToast('Sync triggered');
    } catch (err) {
      setError('Failed to sync integration');
      console.error(err);
    }
  };

  const connectedByType = (type: Integration['type']) => {
    return integrations.filter((integration) => integration.type === type && integration.status === 'connected');
  };

  const browserIntegrations = connectedByType('browser');
  const emailIntegrations = connectedByType('email');
  const calendarIntegrations = connectedByType('calendar');

  const loadBrowserStatus = useCallback(async (silent = false) => {
    if (!selectedBrowserIntegrationId) return;

    setBrowserBusy(true);
    setBrowserError(null);
    try {
      const [health, tabs] = await Promise.all([
        IntegrationAPI.getBrowserHealth(selectedBrowserIntegrationId),
        IntegrationAPI.getBrowserTabs(selectedBrowserIntegrationId),
      ]);

      setBrowserHealth(health.available ? 'available' : 'unavailable');
      setBrowserTabs(Array.isArray(tabs) ? tabs : []);

      if (Array.isArray(tabs) && tabs.length > 0) {
        setSelectedTabId((current) => current || tabs[0].id);
      }

      if (!silent) {
        pushToast(`Browser tabs refreshed (${Array.isArray(tabs) ? tabs.length : 0})`);
      }
    } catch (err) {
      setBrowserError('Failed to load browser state. Ensure Chrome is running with --remote-debugging-port=9222.');
      console.error(err);
    } finally {
      setBrowserBusy(false);
    }
  }, [pushToast, selectedBrowserIntegrationId]);

  const handleOpenBrowserUrl = async () => {
    if (!selectedBrowserIntegrationId || !browserUrl.trim()) return;

    setBrowserBusy(true);
    setBrowserError(null);
    try {
      await IntegrationAPI.openBrowserUrl(selectedBrowserIntegrationId, browserUrl.trim());
      await loadBrowserStatus();
      setBrowserUrl('');
      pushToast('URL opened in browser');
    } catch (err) {
      setBrowserError('Failed to open URL in browser.');
      console.error(err);
      setBrowserBusy(false);
    }
  };

  const handleEvaluateExpression = async () => {
    if (!selectedBrowserIntegrationId || !selectedTabId || !browserExpression.trim()) return;

    setBrowserBusy(true);
    setBrowserError(null);
    try {
      const result = await IntegrationAPI.evaluateBrowserExpression(
        selectedBrowserIntegrationId,
        selectedTabId,
        browserExpression.trim()
      );
      setBrowserEvalResult(JSON.stringify(result, null, 2));
      pushToast('JavaScript executed');
    } catch (err) {
      setBrowserError('Failed to evaluate expression in selected tab.');
      console.error(err);
    } finally {
      setBrowserBusy(false);
    }
  };

  const handleActivateTab = async (tabId: string) => {
    if (!selectedBrowserIntegrationId) return;

    setBrowserBusy(true);
    setBrowserError(null);
    try {
      await IntegrationAPI.activateBrowserTab(selectedBrowserIntegrationId, tabId);
      setSelectedTabId(tabId);
      await loadBrowserStatus();
      pushToast('Tab activated');
    } catch (err) {
      setBrowserError('Failed to activate tab.');
      console.error(err);
      setBrowserBusy(false);
    }
  };

  const handleCloseTab = async (tabId: string) => {
    if (!selectedBrowserIntegrationId) return;

    setBrowserBusy(true);
    setBrowserError(null);
    try {
      await IntegrationAPI.closeBrowserTab(selectedBrowserIntegrationId, tabId);
      await loadBrowserStatus();
      pushToast('Tab closed');
    } catch (err) {
      setBrowserError('Failed to close tab.');
      console.error(err);
      setBrowserBusy(false);
    }
  };

  const loadEmailInbox = useCallback(async (silent = false) => {
    if (!selectedEmailIntegrationId) return;

    setEmailBusy(true);
    setEmailError(null);
    try {
      const [messages, unread] = await Promise.all([
        IntegrationAPI.getEmailInbox(selectedEmailIntegrationId, 8),
        IntegrationAPI.getEmailUnreadCount(selectedEmailIntegrationId),
      ]);
      setEmailMessages(Array.isArray(messages) ? messages : []);
      setEmailUnreadCount(typeof unread === 'number' ? unread : null);
      if (!silent) {
        pushToast(`Inbox loaded (${Array.isArray(messages) ? messages.length : 0} messages)`);
      }
    } catch (err) {
      setEmailError('Failed to load email preview.');
      console.error(err);
    } finally {
      setEmailBusy(false);
    }
  }, [pushToast, selectedEmailIntegrationId]);

  const handleEmailSearch = async () => {
    if (!selectedEmailIntegrationId || !emailSearch.trim()) {
      await loadEmailInbox();
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    try {
      const messages = await IntegrationAPI.searchEmail(selectedEmailIntegrationId, emailSearch.trim(), 8);
      setEmailMessages(Array.isArray(messages) ? messages : []);
      pushToast(`Search complete (${Array.isArray(messages) ? messages.length : 0})`);
    } catch (err) {
      setEmailError('Failed to search inbox.');
      console.error(err);
    } finally {
      setEmailBusy(false);
    }
  };

  const loadCalendarEvents = useCallback(async (silent = false) => {
    if (!selectedCalendarIntegrationId) return;

    setCalendarBusy(true);
    setCalendarError(null);
    try {
      const events = await IntegrationAPI.getCalendarEvents(selectedCalendarIntegrationId, 14, 10);
      setCalendarEvents(Array.isArray(events) ? events : []);
      if (!silent) {
        pushToast(`Upcoming events loaded (${Array.isArray(events) ? events.length : 0})`);
      }
    } catch (err) {
      setCalendarError('Failed to load upcoming events.');
      console.error(err);
    } finally {
      setCalendarBusy(false);
    }
  }, [pushToast, selectedCalendarIntegrationId]);

  const handleCreateCalendarEvent = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedCalendarIntegrationId || !eventTitle.trim() || !eventStart || !eventEnd) {
      setCalendarError('Title, start and end are required.');
      return;
    }

    setCalendarBusy(true);
    setCalendarError(null);
    try {
      await IntegrationAPI.createCalendarEvent(selectedCalendarIntegrationId, {
        title: eventTitle.trim(),
        start: new Date(eventStart).toISOString(),
        end: new Date(eventEnd).toISOString(),
        location: eventLocation.trim() || undefined,
        description: eventDescription.trim() || undefined,
      });

      setEventTitle('');
      setEventStart('');
      setEventEnd('');
      setEventLocation('');
      setEventDescription('');

      await loadCalendarEvents();
      pushToast('Calendar event created');
    } catch (err) {
      setCalendarError('Failed to create event.');
      console.error(err);
    } finally {
      setCalendarBusy(false);
    }
  };

  useEffect(() => {
    if (!selectedBrowserIntegrationId || browserIntegrations.length === 0) {
      return;
    }

    void loadBrowserStatus(true);
    const intervalId = window.setInterval(() => {
      void loadBrowserStatus(true);
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [browserIntegrations.length, loadBrowserStatus, selectedBrowserIntegrationId]);

  useEffect(() => {
    if (!selectedEmailIntegrationId || emailIntegrations.length === 0) {
      return;
    }

    void loadEmailInbox(true);
    const intervalId = window.setInterval(() => {
      void loadEmailInbox(true);
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [emailIntegrations.length, loadEmailInbox, selectedEmailIntegrationId]);

  useEffect(() => {
    if (!selectedCalendarIntegrationId || calendarIntegrations.length === 0) {
      return;
    }

    void loadCalendarEvents(true);
    const intervalId = window.setInterval(() => {
      void loadCalendarEvents(true);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [calendarIntegrations.length, loadCalendarEvents, selectedCalendarIntegrationId]);

  if (loading) {
    return <div className="integration-manager loading">Loading integrations...</div>;
  }

  return (
    <div className="integration-manager">
      <div className="integration-header">
        <h1>Integrations</h1>
        <p>Connect your favorite tools and services to ELIXI</p>
      </div>

      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="integration-sections">
        {/* Connected Integrations */}
        <section className="connected-section">
          <h2>Connected Services</h2>
          {integrations.length === 0 ? (
            <p className="empty-state">No integrations connected yet</p>
          ) : (
            <div className="integration-grid">
              {integrations.map((integration) => (
                <div key={integration.id} className={`integration-card ${integration.status}`}>
                  <div className="integration-header-card">
                    <h3>{integration.displayName}</h3>
                    <span className={`status-badge ${integration.status}`}>
                      {integration.status}
                    </span>
                  </div>

                  {integration.lastSync && (
                    <p className="last-sync">
                      Last synced: {new Date(integration.lastSync).toLocaleDateString()}
                    </p>
                  )}

                  {integration.error && (
                    <p className="error">{integration.error}</p>
                  )}

                  <div className="integration-actions">
                    {integration.status === 'connected' && (
                      <>
                        <button onClick={() => handleSync(integration.id)}>
                          Sync Now
                        </button>
                        <button
                          onClick={() => handleDisconnect(integration.id)}
                          className="danger"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Available Integrations */}
        <section className="available-section">
          <h2>Available Services</h2>
          <div className="integration-grid">
            {availableProviders.map((provider) => {
              const isConnected = integrations.some(
                (i) => i.type === provider.type && i.status === 'connected'
              );

              return (
                <div
                  key={provider.type}
                  className={`provider-card ${isConnected ? 'connected' : ''}`}
                >
                  <div className="provider-icon">{provider.icon}</div>
                  <h3>{provider.displayName}</h3>
                  <p>{provider.description}</p>

                  {isConnected ? (
                    <p className="already-connected">✓ Connected</p>
                  ) : (
                    <button
                      onClick={() => handleConnect(provider.type)}
                      disabled={connectingType === provider.type}
                      className="connect-button"
                    >
                      {connectingType === provider.type ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="live-actions-section">
          <h2>Live Actions</h2>
          <div className="action-panel-grid">
            <div className="action-panel">
              <div className="action-panel-header">
                <h3>Browser Control</h3>
                <span className={`panel-badge ${browserHealth === 'available' ? 'ok' : 'warn'}`}>{browserHealth}</span>
              </div>

              {browserIntegrations.length === 0 ? (
                <p className="panel-empty">Connect a Browser integration to control tabs.</p>
              ) : (
                <>
                  <label className="panel-label">Integration</label>
                  <select
                    className="panel-input"
                    value={selectedBrowserIntegrationId}
                    onChange={(event) => setSelectedBrowserIntegrationId(event.target.value)}
                  >
                    {browserIntegrations.map((integration) => (
                      <option key={integration.id} value={integration.id}>
                        {integration.displayName} ({integration.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>

                  <div className="panel-actions-row">
                    <button onClick={() => { void loadBrowserStatus(); }} disabled={browserBusy}>Refresh Tabs</button>
                  </div>

                  <div className="panel-inline-form">
                    <input
                      className="panel-input"
                      placeholder="https://example.com"
                      value={browserUrl}
                      onChange={(event) => setBrowserUrl(event.target.value)}
                    />
                    <button onClick={handleOpenBrowserUrl} disabled={browserBusy || !browserUrl.trim()}>Open URL</button>
                  </div>

                  {browserError && <p className="panel-error">{browserError}</p>}

                  <div className="panel-list">
                    {browserTabs.slice(0, 8).map((tab) => (
                      <div key={tab.id} className={`panel-list-item ${selectedTabId === tab.id ? 'selected' : ''}`}>
                        <div className="panel-list-main">
                          <strong>{tab.title || '(Untitled tab)'}</strong>
                          <span>{tab.url}</span>
                        </div>
                        <div className="panel-list-actions">
                          <button onClick={() => handleActivateTab(tab.id)} disabled={browserBusy}>Activate</button>
                          <button onClick={() => handleCloseTab(tab.id)} disabled={browserBusy}>Close</button>
                        </div>
                      </div>
                    ))}
                    {browserTabs.length === 0 && <p className="panel-empty">No tabs loaded yet.</p>}
                  </div>

                  <div className="panel-inline-form">
                    <input
                      className="panel-input"
                      value={browserExpression}
                      onChange={(event) => setBrowserExpression(event.target.value)}
                      placeholder="document.title"
                    />
                    <button onClick={handleEvaluateExpression} disabled={browserBusy || !selectedTabId}>Run JS</button>
                  </div>
                  {browserEvalResult && <pre className="panel-pre">{browserEvalResult}</pre>}
                </>
              )}
            </div>

            <div className="action-panel">
              <div className="action-panel-header">
                <h3>Email Inbox Preview</h3>
                <span className="panel-badge neutral">{emailUnreadCount ?? '-'} unread</span>
              </div>

              {emailIntegrations.length === 0 ? (
                <p className="panel-empty">Connect an Email integration to preview inbox messages.</p>
              ) : (
                <>
                  <label className="panel-label">Integration</label>
                  <select
                    className="panel-input"
                    value={selectedEmailIntegrationId}
                    onChange={(event) => setSelectedEmailIntegrationId(event.target.value)}
                  >
                    {emailIntegrations.map((integration) => (
                      <option key={integration.id} value={integration.id}>
                        {integration.displayName} ({integration.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>

                  <div className="panel-actions-row">
                    <button onClick={() => { void loadEmailInbox(); }} disabled={emailBusy}>Load Inbox</button>
                  </div>

                  <div className="panel-inline-form">
                    <input
                      className="panel-input"
                      placeholder="Search emails..."
                      value={emailSearch}
                      onChange={(event) => setEmailSearch(event.target.value)}
                    />
                    <button onClick={handleEmailSearch} disabled={emailBusy}>Search</button>
                  </div>

                  {emailError && <p className="panel-error">{emailError}</p>}

                  <div className="panel-list">
                    {emailMessages.map((message) => (
                      <div key={message.id} className="panel-list-item stacked">
                        <div className="panel-list-main">
                          <strong>{message.subject || '(No subject)'}</strong>
                          <span>{message.from || 'Unknown sender'}</span>
                          <span>{message.snippet || 'No preview available'}</span>
                        </div>
                      </div>
                    ))}
                    {emailMessages.length === 0 && <p className="panel-empty">No messages loaded yet.</p>}
                  </div>
                </>
              )}
            </div>

            <div className="action-panel">
              <div className="action-panel-header">
                <h3>Calendar Event Creation</h3>
                <span className="panel-badge neutral">{calendarEvents.length} upcoming</span>
              </div>

              {calendarIntegrations.length === 0 ? (
                <p className="panel-empty">Connect a Calendar integration to create events.</p>
              ) : (
                <>
                  <label className="panel-label">Integration</label>
                  <select
                    className="panel-input"
                    value={selectedCalendarIntegrationId}
                    onChange={(event) => setSelectedCalendarIntegrationId(event.target.value)}
                  >
                    {calendarIntegrations.map((integration) => (
                      <option key={integration.id} value={integration.id}>
                        {integration.displayName} ({integration.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>

                  <div className="panel-actions-row">
                    <button onClick={() => { void loadCalendarEvents(); }} disabled={calendarBusy}>Load Upcoming</button>
                  </div>

                  <form className="panel-form" onSubmit={handleCreateCalendarEvent}>
                    <input
                      className="panel-input"
                      placeholder="Event title"
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value)}
                    />
                    <input
                      className="panel-input"
                      type="datetime-local"
                      value={eventStart}
                      onChange={(event) => setEventStart(event.target.value)}
                    />
                    <input
                      className="panel-input"
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(event) => setEventEnd(event.target.value)}
                    />
                    <input
                      className="panel-input"
                      placeholder="Location (optional)"
                      value={eventLocation}
                      onChange={(event) => setEventLocation(event.target.value)}
                    />
                    <textarea
                      className="panel-input"
                      rows={3}
                      placeholder="Description (optional)"
                      value={eventDescription}
                      onChange={(event) => setEventDescription(event.target.value)}
                    />
                    <button type="submit" disabled={calendarBusy}>Create Event</button>
                  </form>

                  {calendarError && <p className="panel-error">{calendarError}</p>}

                  <div className="panel-list">
                    {calendarEvents.slice(0, 8).map((calendarEvent) => (
                      <div key={calendarEvent.id} className="panel-list-item stacked">
                        <div className="panel-list-main">
                          <strong>{calendarEvent.title}</strong>
                          <span>{new Date(calendarEvent.start).toLocaleString()} - {new Date(calendarEvent.end).toLocaleString()}</span>
                          {calendarEvent.location && <span>{calendarEvent.location}</span>}
                        </div>
                      </div>
                    ))}
                    {calendarEvents.length === 0 && <p className="panel-empty">No upcoming events loaded yet.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default IntegrationManager;
