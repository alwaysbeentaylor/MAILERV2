// Delete inbound email - hide from list (Resend doesn't support actual deletion)
export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Email ID is required' });
    }

    // Note: Resend API doesn't support deleting inbound emails
    // We return success so the frontend can hide it locally
    res.status(200).json({
        success: true,
        message: 'Email marked as deleted',
        id
    });
}
