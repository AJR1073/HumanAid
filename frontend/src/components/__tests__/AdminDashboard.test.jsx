import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '../AdminDashboard';
import AuthContext from '../../contexts/AuthContext';
import { auth } from '../../firebase';
const saveErrors = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('../AnalyticsDashboard', () => ({ default: () => <div>Analytics panel</div> }));
vi.mock('../AdminResourceModal', () => ({ default: ({ isOpen, resource, onSave, onClose }) => isOpen ? <div><span>Editing {resource.name}</span><button onClick={() => onSave(resource.id, { name: 'Corrected pantry' }).catch(saveErrors.handle)}>Save edit</button><button onClick={onClose}>Close editor</button></div> : null }));
const response = data => ({ ok: true, json: async () => data });
const renderAdmin = (isAdmin = true) => render(<AuthContext.Provider value={{ isAdmin, user: { email: 'admin@example.test' } }}><AdminDashboard /></AuthContext.Provider>);
beforeEach(() => {
  saveErrors.handle.mockClear();
  auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-admin-token') };
  global.fetch = vi.fn(async (url) => {
    if (url.includes('/categories')) return response({ categories: [] });
    if (url.endsWith('/admin/reports')) return response([{ id: 3, resource_id: 7, resource_name: 'Pantry', issue_type: 'incorrect_info', description: 'Wrong hours', city: 'Alton', state: 'IL' }]);
    if (url.endsWith('/resources/7')) return response({ id: 7, name: 'Pantry' });
    return response({ success: true });
  });
});
describe('administrative reports', () => {
  it('renders populated administrator management and hides removal for the current user', async () => {
    const normalFetch = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, options) => url.endsWith('/admin/list')
      ? response({ admins: [
        { id: 1, email: 'admin@example.test', display_name: 'Current Admin' },
        { id: 2, email: 'other@example.test', display_name: 'Other Admin' }
      ] })
      : normalFetch(url, options));
    renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/ }));
    expect(await screen.findByText('admin@example.test')).toBeInTheDocument();
    expect(screen.getByText('other@example.test')).toBeInTheDocument();
    const remove = screen.getByRole('button', { name: 'Remove' });
    expect(remove.closest('.submission-card')).toHaveTextContent('other@example.test');
  });
  it('does not load admin endpoints when frontend access is denied', () => {
    renderAdmin(false);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps report resolution retryable when saving the resource succeeds but resolving fails', async () => {
    const normalFetch = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, options) => url.endsWith('/admin/reports/3/resolve')
      ? { ok: false, status: 503 }
      : normalFetch(url, options));
    renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Reports/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit & Resolve' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save edit' }));
    await waitFor(() => expect(saveErrors.handle).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('report is still open') })));
    expect(screen.getByText('Editing Pantry')).toBeInTheDocument();
    fetch.mockImplementation(normalFetch);
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }));
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.endsWith('/admin/reports/3/resolve'))).toHaveLength(2));
  });
  it('edits and resolves reports with bearer tokens and safely closes the editor', async () => {
    renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Reports/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit & Resolve' }));
    expect(await screen.findByText('Editing Pantry')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith('/admin/reports/3/resolve'))).toBe(true));
    for (const [, options] of fetch.mock.calls) expect(options.headers.get('Authorization')).toBe('Bearer test-admin-token');
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    expect(screen.queryByText('Editing Pantry')).not.toBeInTheDocument();
  });
});
