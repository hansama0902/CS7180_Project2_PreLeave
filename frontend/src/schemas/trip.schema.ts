import { z } from 'zod';

export const planTripSchema = z.object({
    startAddress: z.string().min(5, 'Please enter a complete address').regex(/^(?=.*[a-zA-Z])(?=.*[0-9]).+$/, 'Please enter a valid street address (e.g., 123 Main St)'),
    destAddress: z.string().min(5, 'Please enter a complete address').regex(/^(?=.*[a-zA-Z])(?=.*[0-9]).+$/, 'Please enter a valid street address (e.g., 123 Main St)'),
    arrivalDate: z.string().min(1, 'Arrival date is required'),
    arrivalTime: z.string().min(1, 'Arrival time is required'),
}).superRefine((data, ctx) => {
    const combined = new Date(`${data.arrivalDate}T${data.arrivalTime}`);
    if (isNaN(combined.getTime()) || combined.getTime() <= new Date().getTime()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Arrival time must be in the future',
            path: ['arrivalTime']
        });
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Arrival time must be in the future',
            path: ['arrivalDate']
        });
    }
});

export type PlanTripFormData = z.infer<typeof planTripSchema>;
