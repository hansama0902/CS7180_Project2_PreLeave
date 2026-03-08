import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import HomePage from './HomePage';

describe('HomePage', () => {
    it('renders the header and user profile link', () => {
        render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );

        expect(screen.getByText('PreLeave')).toBeInTheDocument();

        // The link should have aria-label="User Profile"
        const profileLink = screen.getByRole('link', { name: /user profile/i });
        expect(profileLink).toBeInTheDocument();
        expect(profileLink).toHaveAttribute('href', '/profile');
    });

    it('renders the empty state message', () => {
        render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );

        expect(screen.getByText('Welcome to PreLeave')).toBeInTheDocument();
        expect(screen.getByText('Your upcoming trips will appear here.')).toBeInTheDocument();
    });
});
