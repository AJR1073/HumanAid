import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AuthContext from '../contexts/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
const { resize } = vi.hoisted(() => ({ resize: vi.fn() }));
vi.mock('react-map-gl', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef(({ children, latitude, longitude }, ref) => {
      React.useImperativeHandle(ref, () => ({ resize }));
      return <div data-testid="mock-map" data-latitude={latitude} data-longitude={longitude}>{children}</div>;
    }),
    Marker: ({ children }) => <div>{children}</div>,
    Popup: ({ children }) => <div>{children}</div>
  };
});
const renderApp = async () => {
  vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-map-token');
  const { App } = await import('../App');
  return render(<HelmetProvider><AuthContext.Provider value={{ user: null, favorites: [], toggleFavorite: vi.fn(), isAdmin: false }}><App /></AuthContext.Provider></HelmetProvider>);
};
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resources: [], categories: [] }) });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllEnvs());
describe('App and mobile search/map behavior', () => {
  it('renders and fetches initial resources and categories', async () => {
    await renderApp();
    expect(screen.getByText('HumanAid')).toBeInTheDocument();
    expect(screen.getByText('I Need Help')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/categories?mode=need_help'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/resources'));
    });
  });
  it('preserves the volunteer mode filter', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('I Want to Help'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('mode=want_help')));
  });
  it('collapses mobile filters and resizes the map after the layout changes', async () => {
    const { container } = await renderApp();
    // JSDOM does not apply viewport media queries; expose the mobile controls.
    container.querySelector('.mobile-global-search').style.display = 'flex';
    await waitFor(() => expect(resize).toHaveBeenCalled());
    resize.mockClear();
    const toggle = screen.getByRole('button', { name: 'Toggle search filters' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.search-container')).toHaveClass('mobile-hidden');
    await waitFor(() => expect(resize).toHaveBeenCalled());
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.search-container')).not.toHaveClass('mobile-hidden');
  });
  it('centers the map on a resource selected from mobile global search', async () => {
    fetch.mockImplementation(async url => ({ ok: true, json: async () => url.includes('/search?q=')
      ? { results: [{ id: 7, name: 'Pantry match', city: 'Alton', state: 'IL', latitude: 38.9, longitude: -90.1 }] }
      : { resources: [], categories: [] } }));
    const { container } = await renderApp();
    container.querySelector('.mobile-global-search').style.display = 'flex';
    fireEvent.change(screen.getByPlaceholderText('Search resources, cities, or support...'), { target: { value: 'Pantry' } });
    fireEvent.click(await screen.findByRole('button', { name: /Pantry match/ }));
    await waitFor(() => expect(screen.getByTestId('mock-map')).toHaveAttribute('data-latitude', '38.9'));
    expect(screen.getByTestId('mock-map')).toHaveAttribute('data-longitude', '-90.1');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
