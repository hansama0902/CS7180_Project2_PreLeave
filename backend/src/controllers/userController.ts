import { Request, Response } from 'express';

export const getProfile = async (req: Request, res: Response) => {
    // Mocked out response since we don't have a DB connection / complete auth setup yet
    // but we want to fulfill the PRD format: { success, data, error }
    res.json({
        success: true,
        data: {
            username: 'NiceguyLang',
            email: 'niceguy@example.com',
            trips: [
                {
                    id: '1',
                    startAddress: '123 Main St',
                    destAddress: '456 Market St',
                    arrivalTime: '2026-03-08T10:00:00Z',
                    recommendedTransit: 'bus',
                },
                {
                    id: '2',
                    startAddress: '789 Oak Ave',
                    destAddress: '321 Pine Rd',
                    arrivalTime: '2026-03-09T14:30:00Z',
                    recommendedTransit: 'uber',
                }
            ]
        }
    });
};
