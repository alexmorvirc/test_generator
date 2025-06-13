import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { HistoryComponent } from './pages/history/history.component';
import { GeneratorComponent } from './pages/generator/generator.component';
import {AdminPanelComponent} from './pages/admin/admin.component';
import {adminGuard} from './Guards/AdminGuard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'home', component: HomeComponent },
    { path: 'history', component: HistoryComponent },
    { path: 'generator', component: GeneratorComponent },
  {path: 'admin', component: AdminPanelComponent, canActivate: [adminGuard]},
    { path: '', redirectTo: 'home', pathMatch: 'full'}

];
