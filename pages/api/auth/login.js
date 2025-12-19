export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { password } = req.body;
    const CORRECT_PASSWORD = process.env.APP_PASSWORD || 'Cassanova19205!';

    if (password === CORRECT_PASSWORD) {
        // Zet een cookie die 30 dagen geldig is
        res.setHeader('Set-Cookie', 'skye_auth_session=authenticated; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax');
        return res.status(200).json({ success: true });
    }

    return res.status(401).json({ success: false, message: 'Ongeldig wachtwoord' });
}
