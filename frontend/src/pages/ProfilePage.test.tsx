import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import ProfilePage from './ProfilePage';

describe('ProfilePage', () => {
    it('renders the header and back button', () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        expect(screen.getByText('PreLeave')).toBeInTheDocument();

        // The link should have aria-label="Back to Home"
        const backLink = screen.getByRole('link', { name: /back to home/i });
        expect(backLink).toBeInTheDocument();
        expect(backLink).toHaveAttribute('href', '/homepage');
    });

    it('renders the user profile information', () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Logged in as')).toBeInTheDocument();
        expect(screen.getByText('NiceguyLang')).toBeInTheDocument();
    });

    it('renders trip history with reuse and delete buttons', () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        expect(screen.getByText('Trip History')).toBeInTheDocument();

        // Check for some mock data
        expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
        expect(screen.getByText(/456 Market St/)).toBeInTheDocument();

        const reuseButtons = screen.getAllByRole('button', { name: /reuse/i });
        expect(reuseButtons.length).toBeGreaterThan(0);

        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        expect(deleteButtons.length).toBeGreaterThan(0);
    });
});
