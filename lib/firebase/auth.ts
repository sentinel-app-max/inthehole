import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type UserCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<void> {
  return signInWithRedirect(auth, googleProvider);
}

export async function handleRedirectResult(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  return cred;
}

export async function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}
