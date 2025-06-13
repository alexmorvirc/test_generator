import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { enviroment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private app = initializeApp(enviroment);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  private currentUser: User | null = null;
  private isAdminUser: boolean = false;

  constructor(private router: Router) {
    onAuthStateChanged(this.auth, async user => {
      this.currentUser = user;
      if (user) {
        const docSnap = await getDoc(doc(this.db, 'users', user.uid));
        this.isAdminUser = docSnap.exists() && docSnap.data()['isAdmin'] === true;
      } else {
        this.isAdminUser = false;
      }
    });
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      const uid = result.user.uid;
      const docSnap = await getDoc(doc(this.db, 'users', uid));
      this.isAdminUser = docSnap.exists() && docSnap.data()['isAdmin'] === true;

      this.router.navigate(['/home']);
    } catch (error) {
      throw error;
    }
  }

  logout(): void {
    this.auth.signOut();
    this.isAdminUser = false;
    this.router.navigate(['/home']);
  }

  isAdmin(): boolean {
    return this.isAdminUser;
  }

  getUser(): User | null {
    return this.currentUser;
  }
}
