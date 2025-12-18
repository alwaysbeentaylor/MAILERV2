import nodemailer from "nodemailer";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { smtpConfig, testEmail } = req.body;

    if (!smtpConfig || !testEmail) {
        return res.status(400).json({
            error: "smtpConfig en testEmail zijn verplicht"
        });
    }

    try {
        // Create transporter with provided config
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: parseInt(smtpConfig.port) || 587,
            secure: parseInt(smtpConfig.port) === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            },
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 10000
        });

        // Verify connection
        await transporter.verify();
        console.log(`✅ SMTP verbinding OK: ${smtpConfig.host}`);

        // Send test email
        const info = await transporter.sendMail({
            from: smtpConfig.fromName
                ? `"${smtpConfig.fromName}" <${smtpConfig.user}>`
                : smtpConfig.user,
            to: testEmail,
            subject: "✅ SKYE SMTP Test - Configuratie Werkt!",
            text: `Dit is een test email van SKYE Mail Agent.\n\nSMTP Server: ${smtpConfig.host}\nGebruiker: ${smtpConfig.user}\n\nAls je dit ontvangt, werkt je SMTP configuratie correct!`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00A4E8;">✅ SMTP Test Geslaagd!</h2>
          <p>Dit is een test email van <strong>SKYE Mail Agent</strong>.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>SMTP Server:</strong> ${smtpConfig.host}</p>
            <p style="margin: 5px 0;"><strong>Poort:</strong> ${smtpConfig.port}</p>
            <p style="margin: 5px 0;"><strong>Gebruiker:</strong> ${smtpConfig.user}</p>
          </div>
          <p style="color: #16a34a;">Als je dit ontvangt, werkt je SMTP configuratie correct! 🎉</p>
        </div>
      `
        });

        console.log(`✅ Test email verzonden naar ${testEmail}: ${info.messageId}`);

        return res.status(200).json({
            success: true,
            messageId: info.messageId,
            message: `Test email verzonden naar ${testEmail}`
        });

    } catch (err) {
        console.error("❌ SMTP Test Error:", err);

        // Provide helpful error messages
        let errorMessage = err.message;
        if (err.code === 'ECONNREFUSED') {
            errorMessage = `Kan niet verbinden met ${smtpConfig.host}:${smtpConfig.port}. Controleer host en poort.`;
        } else if (err.code === 'EAUTH') {
            errorMessage = `Authenticatie mislukt. Controleer gebruikersnaam en wachtwoord.`;
        } else if (err.code === 'ETIMEDOUT') {
            errorMessage = `Verbinding timeout. Server reageert niet.`;
        }

        return res.status(400).json({
            success: false,
            error: errorMessage,
            code: err.code
        });
    }
}
