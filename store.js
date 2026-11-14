// Stockage : Firebase (comptes + Firestore partagé, hors ligne compris) ou, tant que
// firebase-config.js n'est pas rempli, stockage local sur le téléphone.
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const configured = !!firebaseConfig && !!firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("VOTRE");

const clean = o => JSON.parse(JSON.stringify(o));
const COLLS = ["tickets", "zones", "subzones", "reports"];

const AUTH_ERRORS = {
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/user-not-found": "Aucun compte avec cette adresse.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/invalid-login-credentials": "E-mail ou mot de passe incorrect.",
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse. Connectez-vous.",
  "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
  "auth/too-many-requests": "Trop de tentatives. Patientez quelques minutes.",
  "auth/network-request-failed": "Pas de connexion internet. Réessayez quand le réseau revient.",
  "auth/missing-password": "Saisissez le mot de passe.",
  "permission-denied": "Vous n'avez pas le droit de faire cette modification.",
  "unavailable": "Serveur injoignable pour le moment. La saisie sera envoyée au retour du réseau.",
};
export const errorText = e => AUTH_ERRORS[e && e.code] || (e && e.message) || "Une erreur est survenue.";

/* ================= Firebase ================= */
async function firebaseStore(){
  const [appMod, authMod, fs] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  let db;
  try { db = fs.initializeFirestore(app, {localCache: fs.persistentLocalCache({tabManager: fs.persistentMultipleTabManager()})}); }
  catch (e) { db = fs.getFirestore(app); }
  let unsubs = [];

  return {
    mode: "firebase",
    onAuth: cb => authMod.onAuthStateChanged(auth, u => cb(u ? {uid: u.uid, email: u.email, nom: u.displayName || ""} : null)),
    signIn: (email, pw) => authMod.signInWithEmailAndPassword(auth, email, pw),
    async signUp(nom, email, pw){
      const cred = await authMod.createUserWithEmailAndPassword(auth, email, pw);
      try { await authMod.updateProfile(cred.user, {displayName: nom}); } catch (e) {}
      await fs.setDoc(fs.doc(db, "users", cred.user.uid), {nom, email, role: "attente", createdAt: Date.now()});
    },
    reset: email => authMod.sendPasswordResetEmail(auth, email),
    signOut: () => { unsubs.forEach(u => u()); unsubs = []; return authMod.signOut(auth); },
    watchProfile(user, cb){
      const ref = fs.doc(db, "users", user.uid);
      return fs.onSnapshot(ref, async snap => {
        if (!snap.exists()){
          // Compte créé ailleurs (console Firebase) : on crée le profil « en attente ».
          try { await fs.setDoc(ref, {nom: user.nom || user.email.split("@")[0], email: user.email, role: "attente", createdAt: Date.now()}); } catch (e) { cb(null, e); }
          return;
        }
        cb(Object.assign({uid: user.uid}, snap.data()));
      }, e => cb(null, e));
    },
    subscribe(onData, onSync, onError){
      unsubs.forEach(u => u()); unsubs = [];
      COLLS.forEach(c => unsubs.push(fs.onSnapshot(fs.collection(db, c), {includeMetadataChanges: c === "tickets"}, snap => {
        onData(c, snap.docs.map(d => Object.assign({id: d.id}, d.data())));
        if (c === "tickets") onSync({pending: snap.metadata.hasPendingWrites, cache: snap.metadata.fromCache});
      }, onError)));
      unsubs.push(fs.onSnapshot(fs.collection(db, "users"), snap => onData("users", snap.docs.map(d => Object.assign({uid: d.id}, d.data()))), () => {}));
      unsubs.push(fs.onSnapshot(fs.doc(db, "settings", "main"), snap => onData("settings", snap.exists() ? snap.data() : null), onError));
    },
    put: (coll, item) => fs.setDoc(fs.doc(db, coll, item.id), clean(item)),
    del: (coll, id) => fs.deleteDoc(fs.doc(db, coll, id)),
    putSettings: st => fs.setDoc(fs.doc(db, "settings", "main"), clean(st)),
    setUser: (uid, patch) => fs.updateDoc(fs.doc(db, "users", uid), clean(patch)),
    delUser: uid => fs.deleteDoc(fs.doc(db, "users", uid)),
  };
}

/* ================= Local (sans Firebase) ================= */
function localStore(){
  const KEY = "mct:local:v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  let st = Object.assign({tickets: [], zones: [], subzones: [], reports: [], settings: null}, load());
  let onData = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const emit = c => { if (onData) onData(c, c === "settings" ? st.settings : st[c].slice()); };
  const me = {uid: "local", email: "", nom: "Vous"};
  return {
    mode: "local",
    onAuth: cb => { setTimeout(() => cb(me), 0); return () => {}; },
    signIn: async () => {}, signUp: async () => {}, reset: async () => {}, signOut: async () => {},
    watchProfile: (user, cb) => { setTimeout(() => cb({uid: "local", nom: "Vous", role: "admin"}), 0); return () => {}; },
    subscribe(fn, onSync){ onData = fn; COLLS.forEach(emit); emit("settings"); fn("users", [{uid: "local", nom: "Vous", role: "admin"}]); onSync({pending: false, cache: false}); },
    async put(coll, item){ const a = st[coll]; const i = a.findIndex(x => x.id === item.id); if (i >= 0) a[i] = clean(item); else a.push(clean(item)); save(); emit(coll); },
    async del(coll, id){ st[coll] = st[coll].filter(x => x.id !== id); save(); emit(coll); },
    async putSettings(s){ st.settings = clean(s); save(); emit("settings"); },
    async setUser(){}, async delUser(){},
  };
}

export async function createStore(){
  if (!configured) return localStore();
  return firebaseStore();
}
