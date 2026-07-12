import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// import { HasPermissionDirective } from "./core/auth/permission.directive";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

}
