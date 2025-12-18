// Get single INBOUND email details by ID
import { getInboundEmail } from '../../../utils/resend-client';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Email ID is required' });
    }

    try {
        const email = await getInboundEmail(id);

        res.status(200).json({
            success: true,
            email
        });
    } catch (error) {
        console.error('Get inbound email error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
