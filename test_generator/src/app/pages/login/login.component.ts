import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { group } from 'console';
import { CommonModule } from '@angular/common';
import {RouterModule} from '@angular/router';
import {AuthService} from '../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './login.component.html',
  standalone: true,
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  passwordVisible: boolean = false;
  message: string = '';
  type: string = '';
  loadinglogin : boolean = false;
  constructor(private authservice : AuthService, private router: Router) {}

  login() {
    if (this.email === '' || this.password === '' ) {
      this.message = "Error : Introduzca un correo o contraseña.";
      this.type = "danger";
    } else {
      this.loadinglogin = true;
      this.authservice.login(this.email, this.password)
        .then(()=> {
          this.loadinglogin = false;
          this.router.navigate(['/generator']);
        })
        .catch((error)=> {
           if (error.message === 'auth/email-not-verified') {
             this.router.navigate(['/generator']);
             this.type = "warning";
           } else {
             this.message = " Error: Cuenta no registrada "  ;
             this.type = "danger";
           }
           this.loadinglogin= false;
        })
    }
  }



  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onLogin() {
//López, aquí puedes poner la lógica de auth si quieres.
  if (this.email === 'admin' && this.password === 'admin') {
    //Redirige al home
    this.router.navigate(['/home']);
  }  else {

  }
  }

}


