import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { users } from './db';
import { getDb, COLLECTIONS, generateId } from './firestore';

const ALLOWED_EMAILS = ['justin.c.casey@gmail.com'];

/**
 * Custom Firestore adapter for NextAuth v5.
 * Replaces PrismaAdapter — stores auth data in Firestore collections.
 */
function FirestoreAdapter() {
    return {
        async createUser(data: any) {
            const id = generateId();
            const user = {
                id,
                name: data.name || null,
                email: data.email || null,
                emailVerified: data.emailVerified || null,
                image: data.image || null,
                role: 'user',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await getDb().collection(COLLECTIONS.users).doc(id).set(user);
            return user;
        },

        async getUser(id: string) {
            const doc = await getDb().collection(COLLECTIONS.users).doc(id).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        },

        async getUserByEmail(email: string) {
            const snap = await getDb()
                .collection(COLLECTIONS.users)
                .where('email', '==', email)
                .limit(1)
                .get();
            if (snap.empty) return null;
            const doc = snap.docs[0];
            return { id: doc.id, ...doc.data() };
        },

        async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
            const snap = await getDb()
                .collection(COLLECTIONS.accounts)
                .where('provider', '==', provider)
                .where('providerAccountId', '==', providerAccountId)
                .limit(1)
                .get();
            if (snap.empty) return null;
            const account = snap.docs[0].data();
            const userDoc = await getDb().collection(COLLECTIONS.users).doc(account.userId).get();
            if (!userDoc.exists) return null;
            return { id: userDoc.id, ...userDoc.data() };
        },

        async updateUser(data: any) {
            const { id, ...update } = data;
            await getDb().collection(COLLECTIONS.users).doc(id).update({
                ...update,
                updatedAt: new Date(),
            });
            const doc = await getDb().collection(COLLECTIONS.users).doc(id).get();
            return { id: doc.id, ...doc.data() };
        },

        async deleteUser(id: string) {
            const batch = getDb().batch();

            // Delete user's accounts
            const accountSnap = await getDb()
                .collection(COLLECTIONS.accounts)
                .where('userId', '==', id)
                .get();
            accountSnap.docs.forEach((doc: any) => batch.delete(doc.ref));

            // Delete user's sessions
            const sessionSnap = await getDb()
                .collection(COLLECTIONS.sessions)
                .where('userId', '==', id)
                .get();
            sessionSnap.docs.forEach((doc: any) => batch.delete(doc.ref));

            // Delete the user
            batch.delete(getDb().collection(COLLECTIONS.users).doc(id));
            await batch.commit();
        },

        async linkAccount(data: any) {
            const id = generateId();
            await getDb().collection(COLLECTIONS.accounts).doc(id).set({
                id,
                ...data,
            });
            return { id, ...data };
        },

        async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
            const snap = await getDb()
                .collection(COLLECTIONS.accounts)
                .where('provider', '==', provider)
                .where('providerAccountId', '==', providerAccountId)
                .limit(1)
                .get();
            if (!snap.empty) {
                await snap.docs[0].ref.delete();
            }
        },

        async createSession(data: any) {
            const id = generateId();
            const session = { id, ...data };
            await getDb().collection(COLLECTIONS.sessions).doc(id).set(session);
            return session;
        },

        async getSessionAndUser(sessionToken: string) {
            const snap = await getDb()
                .collection(COLLECTIONS.sessions)
                .where('sessionToken', '==', sessionToken)
                .limit(1)
                .get();
            if (snap.empty) return null;

            const session = { id: snap.docs[0].id, ...snap.docs[0].data() };
            const userDoc = await getDb().collection(COLLECTIONS.users).doc((session as any).userId).get();
            if (!userDoc.exists) return null;

            return { session, user: { id: userDoc.id, ...userDoc.data() } };
        },

        async updateSession(data: any) {
            const snap = await getDb()
                .collection(COLLECTIONS.sessions)
                .where('sessionToken', '==', data.sessionToken)
                .limit(1)
                .get();
            if (snap.empty) return null;

            await snap.docs[0].ref.update(data);
            return { id: snap.docs[0].id, ...snap.docs[0].data(), ...data };
        },

        async deleteSession(sessionToken: string) {
            const snap = await getDb()
                .collection(COLLECTIONS.sessions)
                .where('sessionToken', '==', sessionToken)
                .limit(1)
                .get();
            if (!snap.empty) {
                await snap.docs[0].ref.delete();
            }
        },

        async createVerificationToken(data: any) {
            const id = `${data.identifier}_${data.token}`;
            await getDb().collection(COLLECTIONS.verificationTokens).doc(id).set(data);
            return data;
        },

        async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
            const id = `${identifier}_${token}`;
            const doc = await getDb().collection(COLLECTIONS.verificationTokens).doc(id).get();
            if (!doc.exists) return null;

            const data = doc.data();
            await doc.ref.delete();
            return data;
        },
    };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: FirestoreAdapter() as any,
    callbacks: {
        async signIn({ user }) {
            // Only allow specific emails to sign in
            if (!user.email || !ALLOWED_EMAILS.includes(user.email)) {
                return false;
            }
            return true;
        },
        async jwt({ token, user }) {
            // Always refresh role from Firestore so changes take effect immediately
            if (token.email) {
                const dbUser = await users.findByEmail(token.email);
                if (dbUser) {
                    token.role = dbUser.role;
                    token.userId = dbUser.id;
                }
            }
            if (user && !token.userId) {
                token.userId = user.id;
                token.role = 'user';
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
                session.user.id = token.userId as string;
            }
            return session;
        },
    },
});
