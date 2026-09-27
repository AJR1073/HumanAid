import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportInfoModal from '../ReportInfoModal';

beforeEach(() => {
  global.fetch = vi.fn();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
describe('resource reporting', () => {
  it('preserves anonymous reporting and submits the selected resource and details', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const close = vi.fn();
    render(<ReportInfoModal isOpen onClose={close} resource={{ id: 42, name: 'Community pantry' }} />);
    fireEvent.change(screen.getByLabelText("What's wrong?"), { target: { value: 'closed' } });
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'The provider reports that this location closed.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/resources/42/reports');
    expect(JSON.parse(options.body)).toMatchObject({ issue_type: 'closed' });
    expect(options.headers.has('Authorization')).toBe(false);
  });
  it('keeps the report open on a rejected request', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Please try again later.' }) });
    const close = vi.fn();
    render(<ReportInfoModal isOpen onClose={close} resource={{ id: 42, name: 'Community pantry' }} />);
    fireEvent.change(screen.getByLabelText("What's wrong?"), { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'Details to verify.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(close).not.toHaveBeenCalled();
  });
});
