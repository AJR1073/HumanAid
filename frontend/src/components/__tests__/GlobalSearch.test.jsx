import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GlobalSearch from '../GlobalSearch';

global.fetch = vi.fn();

describe('GlobalSearch', () => {
    const mockOnResourceSelect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnResourceSelect.mockClear();
    });

    it('should render search input', () => {
        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        expect(screen.getByPlaceholderText(/Search resources/i)).toBeInTheDocument();
    });

    it('should show results dropdown when searching', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                results: [
                    { id: 1, name: 'Food Bank', city: 'Alton', state: 'IL', primary_category: 'Food' },
                    { id: 2, name: 'Shelter', city: 'Alton', state: 'IL', primary_category: 'Housing' }
                ]
            })
        });

        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        const input = screen.getByPlaceholderText(/Search resources/i);

        await userEvent.type(input, 'Food');

        // Wait for debounce/fetch
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/search?q=Food'), expect.objectContaining({ signal: expect.any(AbortSignal) })
            );
        });

        expect(await screen.findByText('Food Bank')).toBeInTheDocument();
        expect(screen.getByText('Shelter')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Failed' })
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        const input = screen.getByPlaceholderText(/Search resources/i);

        await userEvent.type(input, 'Error');

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });

        // Should not crash, maybe show empty or nothing
        expect(screen.queryByText('Food Bank')).not.toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it('should clear search on selection', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                results: [
                    { id: 1, name: 'Selected Resource', city: 'Alton', state: 'IL' }
                ]
            })
        });

        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        const input = screen.getByPlaceholderText(/Search resources/i);

        await userEvent.type(input, 'Select');
        const resultItem = await screen.findByText('Selected Resource');

        fireEvent.click(resultItem);

        expect(mockOnResourceSelect).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Selected Resource' })
        );
        expect(input.value).toBe('');
    });

    it('debounces rapid query changes before requesting results', async () => {
        vi.useFakeTimers();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        fireEvent.change(screen.getByPlaceholderText(/Search resources/i), { target: { value: 'Food' } });

        expect(global.fetch).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(249); });
        expect(global.fetch).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('/search?q=Food');
        vi.useRealTimers();
    });

    it('cancels prior requests and ignores late stale responses', async () => {
        vi.useFakeTimers();
        let resolveOld;
        let resolveNew;
        global.fetch
            .mockImplementationOnce((_url, options) => new Promise(resolve => {
                resolveOld = resolve;
                options.signal.addEventListener('abort', () => {});
            }))
            .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve; }));
        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        const input = screen.getByPlaceholderText(/Search resources/i);

        fireEvent.change(input, { target: { value: 'Old' } });
        await act(async () => { vi.advanceTimersByTime(250); });
        const oldSignal = global.fetch.mock.calls[0][1].signal;
        fireEvent.change(input, { target: { value: 'New' } });
        expect(oldSignal.aborted).toBe(true);
        await act(async () => { vi.advanceTimersByTime(250); });

        await act(async () => {
            resolveNew({ ok: true, json: async () => ({ results: [{ id: 2, name: 'New Result', city: 'Alton', state: 'IL' }] }) });
            await Promise.resolve();
        });
        expect(screen.getByText('New Result')).toBeInTheDocument();

        await act(async () => {
            resolveOld({ ok: true, json: async () => ({ results: [{ id: 1, name: 'Stale Result', city: 'Alton', state: 'IL' }] }) });
            await Promise.resolve();
        });
        expect(screen.getByText('New Result')).toBeInTheDocument();
        expect(screen.queryByText('Stale Result')).not.toBeInTheDocument();
        vi.useRealTimers();
    });

    it('supports keyboard activation and labels the clear control', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ results: [{ id: 3, name: 'Keyboard Result', city: 'Alton', state: 'IL' }] })
        });
        render(<GlobalSearch onResourceSelect={mockOnResourceSelect} />);
        await userEvent.type(screen.getByPlaceholderText(/Search resources/i), 'Key');
        const result = await screen.findByRole('button', { name: /Keyboard Result/ });
        expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
        fireEvent.keyDown(result, { key: ' ' });
        expect(mockOnResourceSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Keyboard Result' }));
    });
});
