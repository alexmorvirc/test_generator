import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { enviroment } from '../../environments/environment';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminPanelComponent {
  nombreCompleto = '';
  esAdmin = false;
  mensaje = '';

  private app = initializeApp(enviroment);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  async crearUsuario() {
    try {
      const iniciales = this.generarIniciales(this.nombreCompleto);
      const baseEmail = `${iniciales}@generador.com`.toLowerCase();
      const email = await this.obtenerEmailDisponible(baseEmail);
      const password = this.generarPassword();

      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(this.db, 'users', uid), {
        nombre: this.nombreCompleto,
        isAdmin: this.esAdmin
      });

      this.mensaje = `Usuario creado:\nCorreo: ${email}\nContraseña: ${password}`;
    } catch (error: any) {
      console.error(error);
      this.mensaje = `Error: ${error.message}`;
    }
  }

  async obtenerEmailDisponible(baseEmail: string): Promise<string> {
    let email = baseEmail;
    let contador = 1;

    while (true) {
      const métodos = await fetchSignInMethodsForEmail(this.auth, email);
      if (métodos.length === 0) {
        return email;
      }
      email = baseEmail.replace('@', `${contador}@`);
      contador++;
    }
  }

  generarIniciales(nombreCompleto: string): string {
    const partes = nombreCompleto.trim().split(' ');
    const nombre = partes[0] || '';
    const apellidos = partes.slice(1).join(' ');
    const inicialNombre = nombre.charAt(0);
    const inicialApellido = apellidos.split(' ').map(a => a.charAt(0)).join('');
    return (inicialNombre + inicialApellido).toLowerCase();
  }

  generarPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
    return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }
}
