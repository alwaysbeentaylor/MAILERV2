// Test Amazon SES SMTP Connection - Multiple Regions
// Run with: node test-ses.js

const nodemailer = require('nodemailer');

// Test configurations
const configs = [
    {
        name: "EU-NORTH-1 (Stockholm)",
        host: 'email-smtp.eu-north-1.amazonaws.com',
        port: 587,
        auth: {
            user: 'AKIAWFOWJDPWCOKXCTFO',
            pass: 'BFPmv14gkodszJryIIZ9vQ5b7wIKQk5gilu9e9scJEN1'
        }
    },
    {
        name: "EU-WEST-1 (Ireland)",
        host: 'email-smtp.eu-west-1.amazonaws.com',
        port: 587,
        auth: {
            user: 'AKIAWFOWJDPWCOKXCTFO',
            pass: 'BFPmv14gkodszJryIIZ9vQ5b7wIKQk5gilu9e9scJEN1'
        }
    }
];

async function testConfig(config) {
    console.log(`\n📍 Testen: ${config.name}...`);
    console.log(`   Host: ${config.host}:${config.port}`);

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: false,
        auth: config.auth,
        connectionTimeout: 15000,
        greetingTimeout: 15000
    });

    try {
        await transporter.verify();
        console.log(`   ✅ Verbinding succesvol!`);
        return { success: true, config, transporter };
    } catch (error) {
        console.log(`   ❌ Mislukt: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function sendTestEmail(transporter, configName) {
    console.log(`\n📧 Test email versturen via ${configName}...`);

    try {
        const info = await transporter.sendMail({
            from: '"SKYE" <info@skye-unlimited.be>',
            to: 'develop.json@gmail.com',
            subject: `🚀 SES Test - ${configName} - Het werkt!`,
            text: 'Amazon SES SMTP Test - Je configuratie is correct!',
            html: `
        <html>
        <body style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <h1 style="color: #2d3748; margin-bottom: 20px;">🎉 Amazon SES SMTP Werkt!</h1>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              Gefeliciteerd! Je Amazon SES SMTP integratie is correct geconfigureerd.
            </p>
            <div style="background: linear-gradient(135deg, #00f3ff 0%, #667eea 100%); border-radius: 10px; padding: 20px; margin: 20px 0;">
              <p style="color: white; font-weight: bold; margin: 0;">
                ✅ Config: ${configName}<br>
                ✅ SMTP Connection: OK<br>
                ✅ Email Sending: Working
              </p>
            </div>
            <p style="color: #718096; font-size: 14px;">
              Verstuurd via AWS SES SMTP - ${new Date().toLocaleString('nl-NL')}
            </p>
          </div>
        </body>
        </html>
      `
        });

        console.log(`   ✅ Email verstuurd!`);
        console.log(`   - Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`   ❌ Send Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Run tests
async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("   🚀 Amazon SES SMTP Multi-Region Test");
    console.log("═══════════════════════════════════════════");

    let workingConfig = null;

    for (const config of configs) {
        const result = await testConfig(config);
        if (result.success) {
            workingConfig = result;
            break;
        }
    }

    if (workingConfig) {
        await sendTestEmail(workingConfig.transporter, workingConfig.config.name);
        console.log(`\n💡 Werkende configuratie: ${workingConfig.config.name}`);
        console.log(`   Update ses-client.js met host: ${workingConfig.config.host}`);
    } else {
        console.log("\n❌ Geen werkende configuratie gevonden.");
        console.log("\n💡 Mogelijke oorzaken:");
        console.log("   1. Het afzender emailadres (info@skye-unlimited.be) is niet geverifieerd in SES");
        console.log("   2. Je SES account is nog in sandbox mode");
        console.log("   3. De SMTP credentials zijn onjuist of verlopen");
        console.log("\n📋 Controleer in AWS SES Console:");
        console.log("   - Verified identities: is info@skye-unlimited.be geverifieerd?");
        console.log("   - SMTP credentials: kloppen de credentials?");
        console.log("   - Account status: is je account uit sandbox?");
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("   Test voltooid!");
    console.log("═══════════════════════════════════════════");
}

main().catch(console.error);
