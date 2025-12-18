// Domain Verification API Endpoint
// Verifies that a domain/website is reachable using check-host.net

import { verifyDomain, verifyWebsiteDomain, getDomainFromUrl } from '../../utils/domainVerification';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { domain, websiteUrl, quick = false } = req.body;

    if (!domain && !websiteUrl) {
        return res.status(400).json({
            error: 'Domein of websiteUrl is verplicht'
        });
    }

    try {
        let result;

        if (websiteUrl) {
            // Extract domain from URL and verify
            const extractedDomain = getDomainFromUrl(websiteUrl);
            if (!extractedDomain) {
                return res.status(400).json({
                    valid: false,
                    error: 'Ongeldige website URL'
                });
            }
            result = await verifyDomain(extractedDomain);
            result.originalUrl = websiteUrl;
        } else {
            // Direct domain verification
            result = await verifyDomain(domain);
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Domain verification error:', error);
        return res.status(500).json({
            valid: false,
            error: `Verificatie mislukt: ${error.message}`
        });
    }
}
