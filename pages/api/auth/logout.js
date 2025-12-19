export default async function handler(req, res) {
    // Verwijder de cookie door de verloopperiode in het verleden te zetten
    res.setHeader('Set-Cookie', 'skye_auth_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
    return res.status(200).json({ success: true });
}
