import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminResourceModal from '../AdminResourceModal';

describe('AdminResourceModal', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });
    const mockCategories = [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Health' }
    ];
    const mockResource = {
        id: 123,
        name: 'Test Resource',
        address: '123 Test St',
        city: 'Test City',
        state: 'IL',
        zip_code: '12345',
        phone: '555-0199',
        email: 'test@example.com',
        website: 'https://example.com',
        description: 'A test description',
        hours: 'Mon-Fri 9-5',
        primary_category_id: 1,
        is_active: true
    };

    it('renders nothing when not open', () => {
        render(<AdminResourceModal isOpen={false} onClose={mockOnClose} resource={mockResource} categories={mockCategories} onSave={mockOnSave} />);
        expect(screen.queryByText('Edit Resource')).not.toBeInTheDocument();
    });

    it('renders core fields when open', () => {
        render(<AdminResourceModal isOpen={true} onClose={mockOnClose} resource={mockResource} categories={mockCategories} onSave={mockOnSave} />);

        expect(screen.getByText('Edit Resource')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Resource')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument(); // Verify new email field
        expect(screen.getByDisplayValue('555-0199')).toBeInTheDocument();
        expect(screen.getByDisplayValue('12345')).toBeInTheDocument();
    });

    it('updates form state on input change', () => {
        render(<AdminResourceModal isOpen={true} onClose={mockOnClose} resource={mockResource} categories={mockCategories} onSave={mockOnSave} />);

        const nameInput = screen.getByDisplayValue('Test Resource');
        fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
        expect(nameInput.value).toBe('Updated Name');

        const emailInput = screen.getByDisplayValue('test@example.com');
        fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
        expect(emailInput.value).toBe('new@example.com');
    });

    it('calls onSave with updated data when submitted', async () => {
        render(<AdminResourceModal isOpen={true} onClose={mockOnClose} resource={mockResource} categories={mockCategories} onSave={mockOnSave} />);

        // Change a value
        fireEvent.change(screen.getByDisplayValue('Test Resource'), { target: { value: 'Saved Name' } });

        // Submit
        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledTimes(1);
            expect(mockOnSave).toHaveBeenCalledWith(123, expect.objectContaining({
                name: 'Saved Name',
                email: 'test@example.com' // Should keep original if not changed
            }));
        });
    });

    it('closes when Cancel is clicked', () => {
        render(<AdminResourceModal isOpen={true} onClose={mockOnClose} resource={mockResource} categories={mockCategories} onSave={mockOnSave} />);

        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});
