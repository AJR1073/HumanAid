import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SubmitResourceModal from '../SubmitResourceModal';
import AuthContext from '../../contexts/AuthContext';

// Mock AuthContext
const mockUseAuth = {
    user: { email: 'test@example.com', displayName: 'Test User', uid: '123' }
};

const renderWithAuth = (component, authValue = mockUseAuth) => {
    return render(
        <AuthContext.Provider value={authValue}>
            {component}
        </AuthContext.Provider>
    );
};

global.fetch = vi.fn();

describe('SubmitResourceModal', () => {
    const mockOnClose = vi.fn();
    const categories = [
        { id: 1, name: 'Food', slug: 'food', icon: '🍔' },
        { id: 2, name: 'Housing', slug: 'housing', icon: '🏠' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnClose.mockClear();
    });

    it('should not render when isOpen is false', () => {
        renderWithAuth(<SubmitResourceModal isOpen={false} onClose={mockOnClose} categories={categories} />);
        expect(screen.queryByText('Submit a Resource')).not.toBeInTheDocument();
    });

    it('should render correct fields when open', () => {
        renderWithAuth(<SubmitResourceModal isOpen={true} onClose={mockOnClose} categories={categories} />);

        expect(screen.getByText('Submit a Resource')).toBeInTheDocument();
        expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Street Address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/ZIP Code/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    });

    it('should validate required fields before submission', async () => {
        renderWithAuth(<SubmitResourceModal isOpen={true} onClose={mockOnClose} categories={categories} />);

        const submitBtn = screen.getByRole('button', { name: /submit resource/i });
        fireEvent.click(submitBtn);

        // Browser validation usually stops form submission, but let's check if fetch was NOT called
        await waitFor(() => {
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    it('should submit successfully with valid data', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
        });

        renderWithAuth(<SubmitResourceModal isOpen={true} onClose={mockOnClose} categories={categories} />);

        await userEvent.type(screen.getByLabelText(/Organization Name/i), 'Test Org');
        await userEvent.type(screen.getByLabelText(/Description/i), 'Helping people');
        await userEvent.type(screen.getByLabelText(/Street Address/i), '123 Test St');
        await userEvent.type(screen.getByLabelText(/City/i), 'Test City');
        await userEvent.type(screen.getByLabelText(/ZIP Code/i), '62298');
        await userEvent.selectOptions(screen.getByLabelText(/Category/i), '1');

        const submitBtn = screen.getByRole('button', { name: /submit resource/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/submissions'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('Test Org')
                })
            );
        });

        expect(await screen.findByText('Thank You!')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Server error' })
        });

        renderWithAuth(<SubmitResourceModal isOpen={true} onClose={mockOnClose} categories={categories} />);

        await userEvent.type(screen.getByLabelText(/Organization Name/i), 'Test Org');
        await userEvent.type(screen.getByLabelText(/Description/i), 'Helping people');
        await userEvent.type(screen.getByLabelText(/Street Address/i), '123 Test St');
        await userEvent.type(screen.getByLabelText(/City/i), 'Test City');
        await userEvent.type(screen.getByLabelText(/ZIP Code/i), '62298');
        await userEvent.selectOptions(screen.getByLabelText(/Category/i), '1');

        const submitBtn = screen.getByRole('button', { name: /submit resource/i });
        fireEvent.click(submitBtn);

        expect(await screen.findByText('Server error')).toBeInTheDocument();
    });

    it('should populate form from URL scan', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                title: 'Scanned Org',
                description: 'Scanned Desc',
                suggestedCategory: 'food'
            })
        });

        renderWithAuth(<SubmitResourceModal isOpen={true} onClose={mockOnClose} categories={categories} />);

        const urlInput = screen.getByPlaceholderText('https://example.org');
        await userEvent.type(urlInput, 'https://test.org');

        const scanBtn = screen.getByRole('button', { name: /auto-fill/i });
        fireEvent.click(scanBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/scan-url'),
                expect.anything()
            );
        });

        expect(await screen.findByDisplayValue('Scanned Org')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('Scanned Desc')).toBeInTheDocument();

        // Check if category was auto-selected (Food has ID 1 and slug 'food')
        expect(screen.getByLabelText(/Category/i).value).toBe('1');
    });
});
