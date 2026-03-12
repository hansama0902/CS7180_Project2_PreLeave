import { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const HERE_API_KEY = process.env.HERE_API_KEY;

export const getSuggestions = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;

        // Add a minimum query length check (at least 3 characters) to avoid unnecessary API calls
        if (!q || typeof q !== 'string' || q.length < 3) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        if (!HERE_API_KEY) {
            console.error('HERE_API_KEY is missing');
            res.status(500).json({ success: false, error: 'Server configuration error' });
            return;
        }

        const url = new URL('https://autocomplete.search.hereapi.com/v1/autocomplete');
        url.searchParams.append('q', q);
        url.searchParams.append('limit', '5');
        url.searchParams.append('apiKey', HERE_API_KEY);

        const response = await fetch(url.toString());

        if (!response.ok) {
            console.error(`Autocomplete HERE API failed: ${response.statusText}`);
            // Return empty array on HERE API failure so frontend silently fails gracefully
            res.status(200).json({ success: true, data: [] });
            return;
        }

        const data = await response.json();

        // Return the list of suggestions (each with label and address fields)
        const suggestions = data.items?.map((item: any) => ({
            label: item.address.label || item.title,
            address: item.address
        })) || [];

        res.status(200).json({ success: true, data: suggestions });
    } catch (error) {
        console.error('Autocomplete error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
