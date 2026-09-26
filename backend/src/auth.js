// Auth0 access-token checking.
//
// The frontend signs the user in with Auth0 and sends the access token as
// "Authorization: Bearer ...". We verify the signature against Auth0's public keys,
// so a forged token can't get through. No password ever reaches this server.

import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks = null;

function keys()
{
    if (!jwks)
    {
        if (!process.env.AUTH0_DOMAIN) throw new Error("AUTH0_DOMAIN is not set");
        jwks = createRemoteJWKSet(new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`));
    }
    return jwks;
}

export const authEnabled = () => Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE);

export async function verifyToken(token)
{
    const { payload } = await jwtVerify(token, keys(), {
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        audience: process.env.AUTH0_AUDIENCE,
    });
    return payload;
}

// Attaches req.user when a valid token is present. Never rejects.
export async function readUser(req, _res, next)
{
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token && authEnabled())
    {
        try
        {
            req.user = await verifyToken(token);
        }
        catch
        {
            // An expired or bad token just means signed out.
        }
    }
    next();
}

// Use on routes that act on someone's account.
export function requireUser(req, res, next)
{
    if (!authEnabled()) return res.status(501).json({ error: "Sign-in isn't configured on this server." });
    if (!req.user) return res.status(401).json({ error: "Sign in to continue." });
    next();
}
