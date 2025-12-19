import { NextResponse } from 'next/server';

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // 1. Vrijgestelde routes (publiek of voor externe systemen)
    const isAuthPage = pathname === '/login';
    const isAuthApi = pathname.startsWith('/api/auth');
    const isStatic = pathname.match(/\.(.*)$/) || pathname.startsWith('/_next');

    // QStash / Webhook routes moeten toegankelijk blijven zonder cookie
    const isWebhookApi = pathname === '/api/process-campaign-email' ||
        pathname === '/api/process-scheduled-email' ||
        pathname === '/api/process-warmup-email' ||
        pathname === '/api/send-email' ||
        pathname === '/api/qstash-status' ||
        pathname === '/api/track' ||
        pathname === '/api/scan-replies';

    if (isAuthPage || isAuthApi || isStatic || isWebhookApi) {
        return NextResponse.next();
    }

    // 2. Controleer op auth cookie
    const authCookie = request.cookies.get('skye_auth_session');

    // Eenvoudige verificatie: bestaat de cookie en is de waarde 'true'? 
    // (In een echte app zou dit een JWT of sessie-ID zijn, maar voor dit doel is dit effectief)
    if (!authCookie || authCookie.value !== 'authenticated') {
        const loginUrl = new URL('/login', request.url);
        // Onthoud waar de gebruiker heen wilde
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Pas middleware toe op alle routes behalve static files
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
