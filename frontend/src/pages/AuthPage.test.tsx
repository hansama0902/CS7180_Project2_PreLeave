import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthPage from './AuthPage.tsx';
import api from '../services/api';

vi.mock('../services/api');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...(actual as object),
        useNavigate: () => mockNavigate,
    };
});

describe('AuthPage Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    const renderAuthPage = () => {
        return render(
            <BrowserRouter>
                <AuthPage />
            </BrowserRouter>
        );
    };

    it('should render the login form by default', () => {
        renderAuthPage();
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
        expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
    });

    it('should toggle between login and signup', () => {
        renderAuthPage();

        // Switch to Sign Up
        const toggleLink = screen.getByRole('button', { name: /sign up/i });
        fireEvent.click(toggleLink);

        expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();

        // Switch back to Login
        const loginLink = screen.getByRole('button', { name: /login/i });
        fireEvent.click(loginLink);

        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });

    it('should display validation errors for empty submissions', async () => {
        renderAuthPage();

        const submitBtn = screen.getByRole('button', { name: /login/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Invalid email address')).toBeInTheDocument();
            expect(screen.getByText('Password is required')).toBeInTheDocument();
        });
    });

    it('should display generic error message on invalid credentials', async () => {
        renderAuthPage();

        const emailInput = screen.getByLabelText(/email address/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitBtn = screen.getByRole('button', { name: /login/i });

        fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

        // Mock the API response to throw an error 
        vi.mocked(api.post).mockRejectedValueOnce({
            response: { data: { error: 'Invalid credentials' } }
        });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
        });
    });

    it('should successfully submit and navigate to homepage', async () => {
        renderAuthPage();

        const emailInput = screen.getByLabelText(/email address/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitBtn = screen.getByRole('button', { name: /login/i });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/login', {
                email: 'test@example.com',
                password: 'password123'
            });
            expect(mockNavigate).toHaveBeenCalledWith('/homepage');
        });
    });

    it('should require terms agreement on signup', async () => {
        renderAuthPage();

        // Switch to Sign Up
        fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

        const emailInput = screen.getByLabelText(/email address/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitBtn = screen.getByRole('button', { name: /sign up/i });

        fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Submit without checking the box
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('You must agree to the terms to proceed')).toBeInTheDocument();
        });

        // Check the box and submit
        const checkbox = screen.getByLabelText(/agree to the terms/i);
        fireEvent.click(checkbox);

        vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/register', {
                email: 'new@example.com',
                password: 'password123'
            });
            expect(mockNavigate).toHaveBeenCalledWith('/homepage');
        });
    });
});
