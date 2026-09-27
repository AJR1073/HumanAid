import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import UserMenu from '../UserMenu';
import AuthContext from '../../contexts/AuthContext';
it('lets an existing email account request verification without granting admin access', async () => {
  const verifyEmail = vi.fn().mockResolvedValue({ error: null });
  render(<AuthContext.Provider value={{ user: { email: 'member@example.test', emailVerified: false }, isAdmin: false, verifyEmail }}><UserMenu /></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Verification email sent');
  expect(verifyEmail).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
});
