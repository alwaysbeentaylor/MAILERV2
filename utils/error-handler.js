// Error Handler Utility
// Centrale error handling met Nederlandse, user-friendly meldingen

// Error categorieën
export const ERROR_CODES = {
    // SMTP Errors
    SMTP_CONNECTION: 'SMTP_001',
    SMTP_AUTH: 'SMTP_002',
    SMTP_TIMEOUT: 'SMTP_003',
    SMTP_REJECTED: 'SMTP_004',
    SMTP_NOT_CONFIGURED: 'SMTP_005',
    SMTP_RATE_LIMITED: 'SMTP_006',

    // AI Errors
    AI_TIMEOUT: 'AI_001',
    AI_QUOTA: 'AI_002',
    AI_INVALID_RESPONSE: 'AI_003',
    AI_NOT_CONFIGURED: 'AI_004',

    // Scraping Errors
    SCRAPE_UNREACHABLE: 'SCRAPE_001',
    SCRAPE_TIMEOUT: 'SCRAPE_002',
    SCRAPE_BLOCKED: 'SCRAPE_003',
    SCRAPE_INVALID_URL: 'SCRAPE_004',

    // Validation Errors
    VALIDATION_MISSING_FIELDS: 'VAL_001',
    VALIDATION_INVALID_EMAIL: 'VAL_002',
    VALIDATION_INVALID_URL: 'VAL_003',

    // Network Errors
    NETWORK_OFFLINE: 'NET_001',
    NETWORK_TIMEOUT: 'NET_002',

    // Unknown
    UNKNOWN: 'ERR_999'
};

// User-friendly error messages met hints
const ERROR_MESSAGES = {
    [ERROR_CODES.SMTP_CONNECTION]: {
        icon: '📧',
        title: 'SMTP Verbinding Mislukt',
        message: 'Kan niet verbinden met de email server.',
        hint: 'Check of de SMTP host en poort correct zijn in Settings.',
        action: 'settings'
    },
    [ERROR_CODES.SMTP_AUTH]: {
        icon: '🔑',
        title: 'SMTP Login Mislukt',
        message: 'De email server accepteert je inloggegevens niet.',
        hint: 'Controleer gebruikersnaam en wachtwoord. Voor Gmail: gebruik een App Password.',
        action: 'settings'
    },
    [ERROR_CODES.SMTP_TIMEOUT]: {
        icon: '⏱️',
        title: 'SMTP Timeout',
        message: 'De email server reageert te langzaam.',
        hint: 'Probeer opnieuw of check je internetverbinding.',
        action: 'retry'
    },
    [ERROR_CODES.SMTP_REJECTED]: {
        icon: '🚫',
        title: 'Email Geweigerd',
        message: 'De email server heeft de email geweigerd.',
        hint: 'Check of het ontvanger email adres geldig is.',
        action: null
    },
    [ERROR_CODES.SMTP_NOT_CONFIGURED]: {
        icon: '⚙️',
        title: 'Geen Email Account',
        message: 'Er is geen SMTP account ingesteld.',
        hint: 'Configureer eerst een email account in Settings.',
        action: 'settings'
    },
    [ERROR_CODES.SMTP_RATE_LIMITED]: {
        icon: '🚦',
        title: 'Rate Limit Bereikt',
        message: 'Je hebt te veel emails verstuurd met dit account.',
        hint: 'Wacht tot het volgende uur of gebruik een ander account.',
        action: null
    },

    [ERROR_CODES.AI_TIMEOUT]: {
        icon: '🤖',
        title: 'AI Timeout',
        message: 'De AI is even bezig en reageert niet.',
        hint: 'Probeer opnieuw. Als het blijft falen, is de AI mogelijk overbelast.',
        action: 'retry'
    },
    [ERROR_CODES.AI_QUOTA]: {
        icon: '💳',
        title: 'AI Limiet Bereikt',
        message: 'Je AI quota is op.',
        hint: 'Check je OpenAI API dashboard voor limieten.',
        action: null
    },
    [ERROR_CODES.AI_INVALID_RESPONSE]: {
        icon: '🤖',
        title: 'AI Fout',
        message: 'De AI gaf een ongeldig antwoord.',
        hint: 'Probeer opnieuw. De email wordt met een fallback template verstuurd.',
        action: 'retry'
    },
    [ERROR_CODES.AI_NOT_CONFIGURED]: {
        icon: '🔧',
        title: 'AI Niet Geconfigureerd',
        message: 'De OPENAI_API_KEY ontbreekt.',
        hint: 'Voeg je OpenAI API key toe aan de environment variables.',
        action: null
    },

    [ERROR_CODES.SCRAPE_UNREACHABLE]: {
        icon: '🌐',
        title: 'Website Niet Bereikbaar',
        message: 'De website kan niet worden geladen.',
        hint: 'Controleer of de URL correct is en de website online is.',
        action: null
    },
    [ERROR_CODES.SCRAPE_TIMEOUT]: {
        icon: '⏳',
        title: 'Website Timeout',
        message: 'De website reageert te langzaam.',
        hint: 'De website is mogelijk traag. Probeer later opnieuw.',
        action: 'retry'
    },
    [ERROR_CODES.SCRAPE_BLOCKED]: {
        icon: '🛡️',
        title: 'Website Geblokkeerd',
        message: 'De website blokkeert onze analyse.',
        hint: 'Sommige websites blokkeren scrapers. De email wordt zonder analyse verstuurd.',
        action: null
    },
    [ERROR_CODES.SCRAPE_INVALID_URL]: {
        icon: '🔗',
        title: 'Ongeldige URL',
        message: 'De website URL is niet geldig.',
        hint: 'Check of de URL begint met http:// of https://',
        action: null
    },

    [ERROR_CODES.VALIDATION_MISSING_FIELDS]: {
        icon: '📝',
        title: 'Velden Ontbreken',
        message: 'Niet alle verplichte velden zijn ingevuld.',
        hint: 'Vul alle velden met een * in.',
        action: null
    },
    [ERROR_CODES.VALIDATION_INVALID_EMAIL]: {
        icon: '📧',
        title: 'Ongeldig Email Adres',
        message: 'Het email adres is niet geldig.',
        hint: 'Check of het email adres correct is gespeld.',
        action: null
    },
    [ERROR_CODES.VALIDATION_INVALID_URL]: {
        icon: '🔗',
        title: 'Ongeldige Website',
        message: 'De website URL is niet geldig.',
        hint: 'Voer een complete URL in (bijv. https://example.com)',
        action: null
    },

    [ERROR_CODES.NETWORK_OFFLINE]: {
        icon: '📡',
        title: 'Geen Internet',
        message: 'Je bent niet verbonden met internet.',
        hint: 'Check je internetverbinding en probeer opnieuw.',
        action: 'retry'
    },
    [ERROR_CODES.NETWORK_TIMEOUT]: {
        icon: '⏱️',
        title: 'Netwerk Timeout',
        message: 'De verbinding duurde te lang.',
        hint: 'Check je internetverbinding of probeer later opnieuw.',
        action: 'retry'
    },

    [ERROR_CODES.UNKNOWN]: {
        icon: '❓',
        title: 'Onbekende Fout',
        message: 'Er is iets misgegaan.',
        hint: 'Probeer opnieuw. Als het probleem aanhoudt, neem contact op.',
        action: 'retry'
    }
};

/**
 * Custom Error class voor gestructureerde errors
 */
export class AppError extends Error {
    constructor(code, originalError = null, context = {}) {
        const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN];
        super(errorInfo.message);

        this.code = code;
        this.icon = errorInfo.icon;
        this.title = errorInfo.title;
        this.hint = errorInfo.hint;
        this.action = errorInfo.action;
        this.originalError = originalError;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                icon: this.icon,
                title: this.title,
                message: this.message,
                hint: this.hint,
                action: this.action,
                context: this.context,
                timestamp: this.timestamp
            }
        };
    }
}

/**
 * Detecteer error type op basis van error message/code
 */
export function detectErrorCode(error) {
    const errorStr = (error.message || error.toString()).toLowerCase();
    const errorCode = error.code?.toLowerCase() || '';

    // SMTP errors
    if (errorStr.includes('econnrefused') || errorStr.includes('connection refused')) {
        return ERROR_CODES.SMTP_CONNECTION;
    }
    if (errorStr.includes('invalid login') || errorStr.includes('authentication') ||
        errorStr.includes('auth') || errorCode === 'eauth') {
        return ERROR_CODES.SMTP_AUTH;
    }
    if (errorStr.includes('etimedout') || errorStr.includes('timeout')) {
        if (errorStr.includes('smtp') || errorStr.includes('mail')) {
            return ERROR_CODES.SMTP_TIMEOUT;
        }
        return ERROR_CODES.NETWORK_TIMEOUT;
    }
    if (errorStr.includes('rejected') || errorStr.includes('550')) {
        return ERROR_CODES.SMTP_REJECTED;
    }

    // Network errors
    if (errorStr.includes('enotfound') || errorStr.includes('dns')) {
        return ERROR_CODES.SCRAPE_UNREACHABLE;
    }
    if (errorStr.includes('network') || errorStr.includes('offline')) {
        return ERROR_CODES.NETWORK_OFFLINE;
    }

    // AI errors
    if (errorStr.includes('quota') || errorStr.includes('rate limit') || errorStr.includes('429')) {
        return ERROR_CODES.AI_QUOTA;
    }
    if (errorStr.includes('openai') || errorStr.includes('generate') || errorStr.includes('chat.completions')) {
        return ERROR_CODES.AI_INVALID_RESPONSE;
    }

    // Scraping errors
    if (errorStr.includes('blocked') || errorStr.includes('403') || errorStr.includes('forbidden')) {
        return ERROR_CODES.SCRAPE_BLOCKED;
    }

    return ERROR_CODES.UNKNOWN;
}

/**
 * Wrap een error in een user-friendly AppError
 */
export function wrapError(error, fallbackCode = ERROR_CODES.UNKNOWN, context = {}) {
    if (error instanceof AppError) {
        return error;
    }

    const code = detectErrorCode(error) || fallbackCode;
    return new AppError(code, error, context);
}

/**
 * Format error voor API response
 */
export function formatErrorResponse(error, context = {}) {
    const appError = wrapError(error, ERROR_CODES.UNKNOWN, context);
    return appError.toJSON();
}

/**
 * Log error met context (voor debugging)
 */
export function logError(error, step = 'unknown') {
    const timestamp = new Date().toISOString();
    const errorInfo = error instanceof AppError ? error : wrapError(error);

    console.error(`\n❌ [${timestamp}] Error in ${step}:`);
    console.error(`   Code: ${errorInfo.code}`);
    console.error(`   Title: ${errorInfo.title}`);
    console.error(`   Message: ${errorInfo.message}`);
    if (errorInfo.originalError) {
        console.error(`   Original: ${errorInfo.originalError.message}`);
    }
    if (Object.keys(errorInfo.context).length > 0) {
        console.error(`   Context:`, errorInfo.context);
    }
}
